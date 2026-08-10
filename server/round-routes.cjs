'use strict';

function createRoundRoutes({
  bridge,
  createLifecycle,
  lifecycleSettings,
  validQuestions,
  terminalReason,
  readBody,
  sendJson,
  sendJsonAndObserve,
}) {
  const sseClients = new Set();

  function currentPayload(requestId) {
    const current = bridge.peek(requestId);
    return current
      ? { ...current, lifecycle: bridge.getSnapshot() }
      : { id: null, questions: null, lifecycle: bridge.getSnapshot() };
  }

  function recoveryError(res, code) {
    const status =
      {
        invalid_selector: 400,
        ownership_conflict: 409,
        ambiguous_selection: 409,
        result_not_ready: 409,
        expired: 410,
        not_found: 404,
        recovery_error: 409,
        stale_round: 409,
      }[code] || 409;
    sendJson(res, status, { error: 'round recovery unavailable', reason: code });
  }

  function broadcastCurrent() {
    const payload = JSON.stringify(currentPayload());
    for (const res of sseClients) {
      // res.write() hatayı çoğu Node yolunda ASENKRON 'error' ile yayar; senkron
      // try/catch ölü soketi yakalamaz. writable kontrolü deterministik guard'dır;
      // gerçek temizlik /events 'close' listener'ında yapılır (zombi birikmez).
      if (!res.writable) {
        sseClients.delete(res);
        continue;
      }
      res.write(`data: ${payload}\n\n`);
    }
  }

  async function handle(req, res, url) {
    if (req.method === 'GET' && url === '/current') {
      const requestId = new URL(req.url, 'http://127.0.0.1').searchParams.get('requestId');
      sendJson(res, 200, currentPayload(requestId || undefined));
      return true;
    }

    if (req.method === 'GET' && url === '/rounds') {
      sendJson(res, 200, { rounds: bridge.listRecoverable() });
      return true;
    }

    const roundMatch = /^\/rounds\/([^/]+)(?:\/(result|ack|delete|cancel))?$/.exec(url);
    if (roundMatch && req.method === 'GET' && !roundMatch[2]) {
      const found = bridge.getDurable(roundMatch[1]);
      if (!found.ok) recoveryError(res, found.code);
      else {
        const {
          roundId,
          requestId,
          lifecycle,
          revision,
          createdAt,
          updatedAt,
          expiresAt,
          questions,
        } = found.record;
        sendJson(res, 200, {
          roundId,
          requestId,
          state: lifecycle.state,
          revision,
          createdAt,
          updatedAt,
          expiresAt,
          questionCount: questions.length,
        });
      }
      return true;
    }

    if (roundMatch && req.method === 'POST' && roundMatch[2] === 'delete') {
      const deleted = bridge.deleteRecoverable(roundMatch[1]);
      if (!deleted.ok) recoveryError(res, deleted.code);
      else {
        broadcastCurrent();
        sendJson(res, 200, { ok: true });
      }
      return true;
    }

    if (roundMatch && req.method === 'POST' && roundMatch[2] === 'cancel') {
      let reason = 'user cancelled';
      try {
        const body = await readBody(req);
        const payload = body ? JSON.parse(body) : {};
        if (payload.reason !== undefined) reason = payload.reason;
      } catch {
        sendJson(res, 400, { error: 'bad json' });
        return true;
      }
      const knownReason = new Set(['user cancelled', 'host cancelled', 'timeout']);
      if (typeof reason !== 'string' || !knownReason.has(reason)) {
        sendJson(res, 400, { error: 'invalid cancel reason' });
        return true;
      }
      const cancelled = bridge.cancelRecoverable(roundMatch[1], reason);
      if (!cancelled.ok) recoveryError(res, cancelled.code);
      else {
        broadcastCurrent();
        sendJson(res, 200, {
          ok: true,
          roundId: cancelled.roundId,
          reason: terminalReason(reason),
        });
      }
      return true;
    }

    if (
      roundMatch &&
      req.method === 'POST' &&
      (roundMatch[2] === 'result' || roundMatch[2] === 'ack')
    ) {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: 'read error' });
        return true;
      }
      let capability;
      try {
        ({ capability } = JSON.parse(body));
      } catch {
        sendJson(res, 400, { error: 'bad json' });
        return true;
      }
      if (typeof capability !== 'string') {
        recoveryError(res, 'invalid_selector');
        return true;
      }
      if (roundMatch[2] === 'result') {
        const result = bridge.getResult(roundMatch[1], capability);
        if (!result.ok) recoveryError(res, result.code);
        else sendJson(res, 200, { answers: result.result, revision: result.record.revision });
        return true;
      }
      const record = bridge.getDurable(roundMatch[1]);
      if (!record.ok) recoveryError(res, record.code);
      else if (record.record.capability !== capability) recoveryError(res, 'ownership_conflict');
      else if (!record.record.answers) recoveryError(res, 'result_not_ready');
      else if (!bridge.confirmDelivery(roundMatch[1])) recoveryError(res, 'recovery_error');
      else {
        const acknowledged = bridge.getDurable(roundMatch[1]);
        sendJson(res, 200, {
          acknowledgedAt: acknowledged.record.delivery.acknowledgedAt,
          revision: acknowledged.record.revision,
        });
      }
      return true;
    }

    if (req.method === 'GET' && url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      // Önce ekle, sonra ilk snapshot'ı yaz: add-write penceresinde araya giren bir
      // broadcast'i kaçırmamak için (eklenme-yazma sırasına kırılgan değil).
      sseClients.add(res);
      res.write(`data: ${JSON.stringify(currentPayload())}\n\n`);
      // 25 sn'de bir yorum-ping: bağlantı/proxy timeout'una karşı keepalive.
      const ping = setInterval(() => {
        if (!res.writable) {
          clearInterval(ping);
          sseClients.delete(res);
          return;
        }
        res.write(': ping\n\n');
      }, 25000);
      req.on('close', () => {
        clearInterval(ping);
        sseClients.delete(res);
      });
      return true;
    }

    if (req.method === 'POST' && url === '/ask') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: 'read error' });
        return true;
      }
      let questions;
      let requestId;
      try {
        const payload = JSON.parse(body);
        questions = payload.questions;
        requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
      } catch {
        sendJson(res, 400, { error: 'bad json' });
        return true;
      }
      const checkedQuestions = validQuestions(questions);
      if (!checkedQuestions.ok) {
        sendJson(res, 400, { error: checkedQuestions.error });
        return true;
      }
      // Senkron erken 409: zaten pending varsa close handler kaydetmeden çık. Aksi
      // halde reddedilmiş istek, sahiplenmediği turu (gec onClose ile) iptal edebilir.
      if (bridge.peek()) {
        sendJson(res, 409, {
          error: 'A question set is already pending',
          reason: 'round_in_progress',
        });
        return true;
      }
      const lifecycle = createLifecycle({
        adapter: 'http',
        requestId,
        settings: lifecycleSettings,
      });
      lifecycle.event('ask_received');
      const answersPromise = bridge.submitQuestions(questions, requestId, lifecycle);
      // Bu istek pending'i sahiplendi; submit'ten dönen id ile sahipliği işaretle.
      const myId = bridge.peek().id;
      res.__askuserRoundId = myId;
      lifecycle.setRoundId(myId);
      lifecycle.event('round_registered');
      // İstemci yanıttan önce giderse SADECE kendi turunu iptal et (Contract R:
      // expectedId). Yeni bir tur kurulmuşsa gec onClose onu iptal edemez.
      let settled = false;
      const onClose = () => {
        lifecycle.event('ask_response_closed');
        const preserved = !settled && requestId && bridge.detach('host disconnected', myId);
        const cancelled = !settled && !preserved && bridge.cancel('client disconnected', myId);
        if (preserved || cancelled) broadcastCurrent();
      };
      res.on('close', onClose);
      broadcastCurrent();
      try {
        const answers = await answersPromise;
        settled = true;
        const delivered = await sendJsonAndObserve(res, 200, { answers });
        const deliveryId = bridge.durableRoundId(myId) || myId;
        if (delivered) bridge.confirmDelivery(deliveryId);
        else bridge.markDeliveryUncertain(deliveryId);
      } catch (error) {
        settled = true;
        lifecycle.finish('bridge_error');
        sendJson(res, 409, {
          error: error.message,
          reason: error.code || 'bridge_error',
          roundId: error.roundId,
        });
      } finally {
        res.off('close', onClose);
        delete res.__askuserRoundId;
      }
      return true;
    }

    if (req.method === 'POST' && url === '/resume') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: 'read error' });
        return true;
      }
      let requestId;
      let roundId;
      try {
        const payload = body ? JSON.parse(body) : {};
        if (payload.requestId !== undefined && typeof payload.requestId !== 'string') {
          sendJson(res, 400, { error: 'invalid requestId' });
          return true;
        }
        if (
          payload.roundId !== undefined &&
          (typeof payload.roundId !== 'string' || !/^round_[A-Za-z0-9_-]+$/.test(payload.roundId))
        ) {
          sendJson(res, 400, { error: 'invalid roundId' });
          return true;
        }
        requestId = payload.requestId;
        roundId = payload.roundId;
      } catch {
        sendJson(res, 400, { error: 'bad json' });
        return true;
      }

      if (!roundId && !requestId) {
        recoveryError(res, 'invalid_selector');
        return true;
      }
      if (roundId) {
        const found = bridge.getDurable(roundId);
        if (!found.ok) {
          recoveryError(res, found.code);
          return true;
        }
        if (requestId && found.record.requestId !== requestId) {
          recoveryError(res, 'ownership_conflict');
          return true;
        }
        requestId = found.record.requestId;
      }
      const waiter = bridge.waitForAnswers({ requestId, roundId });
      let settled = false;
      const onClose = () => {
        if (!settled) waiter.cancel();
      };
      res.on('close', onClose);
      try {
        const answers = await waiter.promise;
        settled = true;
        const delivered = await sendJsonAndObserve(res, 200, { answers });
        const deliveryId = waiter.roundId;
        if (delivered) bridge.confirmDelivery(deliveryId);
        else bridge.markDeliveryUncertain(deliveryId);
      } catch (error) {
        settled = true;
        sendJson(res, 409, {
          error: error.message,
          reason: error.code || 'bridge_error',
          roundId: error.roundId,
        });
      } finally {
        res.off('close', onClose);
      }
      return true;
    }

    if (req.method === 'POST' && url === '/answer') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: 'read error' });
        return true;
      }
      let id;
      let answers;
      let capability;
      try {
        ({ id, answers, capability } = JSON.parse(body));
      } catch {
        sendJson(res, 400, { error: 'bad json' });
        return true;
      }
      // Contract R: answers plain object olmalı (null/array/primitif değil); aksi 400.
      if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        sendJson(res, 400, { error: 'invalid answers' });
        return true;
      }
      // Contract R: id eşleşen pending turu resolve eder; eşleşmezse (stale/yok) 409.
      if (typeof capability !== 'string' || !bridge.provideAnswers(id, answers, capability)) {
        sendJson(res, 409, {
          error: 'no matching pending question set',
          reason: 'ownership_conflict',
        });
        return true;
      }
      broadcastCurrent();
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (req.method === 'POST' && url === '/draft') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: 'read error' });
        return true;
      }
      let id;
      let answers;
      let capability;
      let revision;
      try {
        ({ id, answers, capability, revision } = JSON.parse(body));
      } catch {
        sendJson(res, 400, { error: 'bad json' });
        return true;
      }
      if (
        !Number.isInteger(id) ||
        !answers ||
        typeof answers !== 'object' ||
        Array.isArray(answers) ||
        typeof capability !== 'string' ||
        !Number.isInteger(revision) ||
        revision < 0
      ) {
        sendJson(res, 400, { error: 'invalid draft request' });
        return true;
      }
      const saved = bridge.saveDraft(id, answers, capability, revision);
      if (!saved.ok) recoveryError(res, saved.code);
      else {
        broadcastCurrent();
        sendJson(res, 200, {
          ok: true,
          revision: saved.record.revision,
          replayed: saved.replayed,
        });
      }
      return true;
    }

    if (req.method === 'POST' && url === '/cancel') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: 'read error' });
        return true;
      }
      let id;
      let capability;
      let reason = 'user cancelled';
      try {
        const payload = JSON.parse(body);
        id = payload.id;
        capability = payload.capability;
        if (payload.reason !== undefined) reason = payload.reason;
      } catch {
        sendJson(res, 400, { error: 'bad json' });
        return true;
      }
      if (
        !Number.isInteger(id) ||
        id < 1 ||
        typeof reason !== 'string' ||
        typeof capability !== 'string'
      ) {
        sendJson(res, 400, { error: 'invalid cancel request' });
        return true;
      }
      const knownReason = new Set([
        'user cancelled',
        'host cancelled',
        'browser disconnected',
        'timeout',
      ]);
      if (!knownReason.has(reason)) {
        sendJson(res, 400, { error: 'invalid cancel reason' });
        return true;
      }
      if (!bridge.cancel(reason, id, capability)) {
        sendJson(res, 409, {
          error: 'no matching pending question set',
          reason: 'ownership_conflict',
        });
        return true;
      }
      broadcastCurrent();
      sendJson(res, 200, { ok: true, reason: terminalReason(reason) });
      return true;
    }

    return false;
  }

  return { handle, broadcastCurrent };
}

module.exports = { createRoundRoutes };
