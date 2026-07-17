'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Bridge, DEFAULT_DETACHED_TTL_MS, terminalReason } = require('./bridge.js');
const APP_ID = require('../lib/app-id.cjs');
const Settings = require('../lib/settings.js');
const { log } = require('../lib/log.cjs');
const { createLifecycle } = require('../lib/round-lifecycle.cjs');
const { validQuestions: validateQuestionSet } = require('../lib/question-contract.cjs');

const PORT = process.env.ASKUSER_PORT ? Number(process.env.ASKUSER_PORT) : 4517;
const WEB_DIR = path.join(__dirname, '..', 'web');
const configuredDetachedTtl = Number(process.env.ASKUSER_DETACHED_ROUND_TTL_MS);
const bridge = new Bridge({
  detachedTtlMs: Number.isFinite(configuredDetachedTtl)
    ? configuredDetachedTtl
    : DEFAULT_DETACHED_TTL_MS,
});
const sseClients = new Set();
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const MAX_BODY = 8e6; // 8 MB sert tavan.

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false; // tek-atislik settle: cift-reject/resolve'i engeller.
    const fail = (msg) => {
      if (done) return;
      done = true;
      reject(new Error(msg));
      req.destroy(); // 'data' akisini durdur; close-yarisini deterministik kapat.
    };
    const ok = () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    req.on('data', (c) => {
      size += c.length;
      // Asimda destroy'dan ÖNCE senkron reject — buffered 'data'/'end' kismi gövdeyi
      // sessizce resolve edemez (boyut guard'i atlanmaz).
      if (size > MAX_BODY) return fail('request body too large');
      chunks.push(c);
    });
    req.on('end', ok);
    req.on('error', (e) => fail(e.message));
    // destroy 'close' garantilemese de (socket zaten dead ise) 'data'/'end'/'error'
    // yollarindan biri done'i set eder; bu yol yalniz erken kopuslarda calisir.
    req.on('close', () => {
      if (!req.readableEnded) fail('connection closed');
    });
  });
}

function validQuestions(q) {
  return validateQuestionSet(q);
}

function broadcastCurrent() {
  const current = bridge.peek();
  const payload = JSON.stringify(current ? { ...current, lifecycle: bridge.getSnapshot() } : { id: null, questions: null, lifecycle: bridge.getSnapshot() });
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

// Ayarlar bellek cache'i: her index.html / POST /settings'te fs.readFileSync ile
// event loop'u bloke etmemek için. write yolundan invalidate edilir.
let settingsCache = null;
function readSettings() {
  if (settingsCache === null) settingsCache = Settings.read();
  return settingsCache;
}
function invalidateSettings(value) {
  settingsCache = value || null; // value verilirse direkt cache'le, yoksa lazy re-read.
}

// index.html taban HTML'i ilk istekte cache'lenir (UTF-8 decode bir kez). Ayar
// inject'i her istekte yapılır ama disk okuması/decode tekrarlanmaz.
let indexBaseHtml = null;

function serveStatic(req, res) {
  let rel = req.url.split('?')[0];
  if (rel === '/' || rel === '') rel = '/index.html';
  const isIndex = rel === '/index.html';
  const file = path.join(WEB_DIR, path.normalize(rel));
  // Sınır duyarlı kontrol: WEB_DIR'in kendisi veya altı olmalı.
  if (file !== WEB_DIR && !file.startsWith(WEB_DIR + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  // index.html: ayarları DOM'a inject et (flash yok). Taban HTML cache'lenir;
  // dinamik ayar inject'i nedeniyle ETag verilmez (gövde her istekte değişebilir).
  if (isIndex) {
    if (indexBaseHtml !== null) return sendIndex(res, indexBaseHtml);
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      indexBaseHtml = buf.toString('utf8');
      sendIndex(res, indexBaseHtml);
    });
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    // İçerikten zayıf ETag: değişmemiş asset'te 304 → tarayıcı cache'i kullanır.
    const etag = `W/"${buf.length.toString(16)}-${hashBuf(buf)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      ETag: etag,
      'Cache-Control': 'no-cache', // her zaman revalidate et (ETag ile ucuz).
    });
    res.end(buf);
  });
}

function sendIndex(res, baseHtml) {
  const tag = `<script>window.__ASKUSER_SETTINGS__=${JSON.stringify(readSettings())}</script>`;
  const html = baseHtml.replace('</head>', tag + '</head>');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// ponytail: zero-dep hızlı içerik hash'i (DJB2). Kriptografik değil; yalnızca
// ETag revalidation için "değişti mi" ayrımına yeter, çakışma riski önemsiz.
function hashBuf(buf) {
  let h = 5381;
  for (let i = 0; i < buf.length; i++) h = ((h << 5) + h + buf[i]) >>> 0;
  return h.toString(16);
}

async function handleRequest(req, res) {
  const url = req.url.split('?')[0];

  // app kimliği: eski/yabancı bir server'ın bu portu kapıp /health'e ok demesini ayırt etmek için
  if (req.method === 'GET' && url === '/health')
    return sendJson(res, 200, { ok: true, app: APP_ID });
  if (req.method === 'GET' && url === '/current') {
    const requestId = new URL(req.url, 'http://127.0.0.1').searchParams.get('requestId');
    const current = bridge.peek(requestId || undefined);
    return sendJson(res, 200, current ? { ...current, lifecycle: bridge.getSnapshot() } : { id: null, questions: null, lifecycle: bridge.getSnapshot() });
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
    const current = bridge.peek();
    res.write(`data: ${JSON.stringify(current ? { ...current, lifecycle: bridge.getSnapshot() } : { id: null, questions: null, lifecycle: bridge.getSnapshot() })}\n\n`);
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
    return;
  }

  if (req.method === 'POST' && url === '/ask') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: 'read error' });
    }
    let questions;
    let requestId;
    try {
      const payload = JSON.parse(body);
      questions = payload.questions;
      requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
    } catch {
      return sendJson(res, 400, { error: 'bad json' });
    }
    const vq = validQuestions(questions);
    if (!vq.ok) return sendJson(res, 400, { error: vq.error });
    // Senkron erken 409: zaten pending varsa close handler kaydetmeden çık. Aksi
    // halde reddedilmiş istek, sahiplenmediği turu (gec onClose ile) iptal edebilir.
    if (bridge.peek())
      return sendJson(res, 409, {
        error: 'A question set is already pending',
        reason: 'round_in_progress',
      });
    const lifecycle = createLifecycle({
      adapter: 'http',
      requestId,
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
      if (preserved || cancelled) {
        broadcastCurrent();
      }
    };
    res.on('close', onClose);
    broadcastCurrent();
    try {
      const answers = await answersPromise;
      settled = true;
      if (res.destroyed || !res.writable) return;
      return sendJson(res, 200, { answers });
    } catch (e) {
      settled = true;
      lifecycle.finish('bridge_error');
      return sendJson(res, 409, {
        error: e.message,
        reason: e.code || 'bridge_error',
        roundId: e.roundId,
      });
    } finally {
      res.off('close', onClose);
      delete res.__askuserRoundId;
    }
  }

  if (req.method === 'POST' && url === '/resume') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: 'read error' });
    }
    let requestId;
    try {
      const payload = body ? JSON.parse(body) : {};
      if (payload.requestId !== undefined && typeof payload.requestId !== 'string') {
        return sendJson(res, 400, { error: 'invalid requestId' });
      }
      requestId = payload.requestId;
    } catch {
      return sendJson(res, 400, { error: 'bad json' });
    }

    const waiter = bridge.waitForAnswers(requestId);
    let settled = false;
    const onClose = () => {
      if (!settled) waiter.cancel();
    };
    res.on('close', onClose);
    try {
      const answers = await waiter.promise;
      settled = true;
      if (res.destroyed || !res.writable) return;
      return sendJson(res, 200, { answers });
    } catch (e) {
      settled = true;
      return sendJson(res, 409, {
        error: e.message,
        reason: e.code || 'bridge_error',
        roundId: e.roundId,
      });
    } finally {
      res.off('close', onClose);
    }
  }

  if (req.method === 'POST' && url === '/answer') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: 'read error' });
    }
    let id, answers, capability;
    try {
      ({ id, answers, capability } = JSON.parse(body));
    } catch {
      return sendJson(res, 400, { error: 'bad json' });
    }
    // Contract R: answers plain object olmalı (null/array/primitif değil); aksi 400.
    if (!answers || typeof answers !== 'object' || Array.isArray(answers))
      return sendJson(res, 400, { error: 'invalid answers' });
    // Contract R: id eşleşen pending turu resolve eder; eşleşmezse (stale/yok) 409.
    if (typeof capability !== 'string' || !bridge.provideAnswers(id, answers, capability)) {
      return sendJson(res, 409, {
        error: 'no matching pending question set',
        reason: 'ownership_conflict',
      });
    }
    broadcastCurrent();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url === '/cancel') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: 'read error' });
    }
    let id, capability;
    let reason = 'user cancelled';
    try {
      const payload = JSON.parse(body);
      id = payload.id;
      capability = payload.capability;
      if (payload.reason !== undefined) reason = payload.reason;
    } catch {
      return sendJson(res, 400, { error: 'bad json' });
    }
    if (!Number.isInteger(id) || id < 1 || typeof reason !== 'string' || typeof capability !== 'string') {
      return sendJson(res, 400, { error: 'invalid cancel request' });
    }
    const knownReason = new Set([
      'user cancelled',
      'host cancelled',
      'browser disconnected',
      'timeout',
    ]);
    if (!knownReason.has(reason)) {
      return sendJson(res, 400, { error: 'invalid cancel reason' });
    }
    if (!bridge.cancel(reason, id, capability)) {
      return sendJson(res, 409, {
        error: 'no matching pending question set',
        reason: 'ownership_conflict',
      });
    }
    broadcastCurrent();
    return sendJson(res, 200, { ok: true, reason: terminalReason(reason) });
  }

  if (req.method === 'POST' && url === '/settings') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return sendJson(res, 400, { error: 'read error' });
    }
    let patch;
    try {
      patch = JSON.parse(body);
    } catch {
      return sendJson(res, 400, { error: 'bad json' });
    }
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
      return sendJson(res, 400, { error: 'invalid settings' });
    // Contract W: write → {ok,value,error?}. Settings.write zaten validate eder.
    const r = Settings.write(patch);
    if (!r.ok)
      return sendJson(res, 500, {
        error: (r.error && r.error.message) || 'settings write failed',
      });
    invalidateSettings(r.value); // bellek cache'i taze değerle güncelle.
    const { _v, ...clientSettings } = r.value; // _v disk formatı; tarayıcıya sızdırma
    return sendJson(res, 200, { ok: true, settings: clientSettings });
  }

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(404);
  res.end();
}

function handleRequestError(res, error) {
  log('server', error);
  const ownerId = res.__askuserRoundId;
  if (ownerId != null && bridge.cancel('server error', ownerId)) broadcastCurrent();
  if (res.headersSent) {
    if (!res.writableEnded) res.destroy();
    return;
  }
  sendJson(res, 500, { error: 'internal server error', reason: 'bridge_error' });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => handleRequestError(res, error));
});

// Node'un varsayılan requestTimeout'u 5 dk (300000ms) — /ask isteği cevabı
// beklerken bu süre dolunca soketi kapatır ve pending iptal olur. Bekleme
// süresini istemci (hook/MCP) AbortController ile yönetir, sunucu sınırı koymaz.
// ponytail: requestTimeout=0 ile devre dışı; gerçek deadline istemci tarafında.
server.requestTimeout = 0;

// Daemon olarak başlatılırken port doluysa (eşzamanlı spawn yarışı) sessizce çekil.
// Diğer hatalar: detached/stdio:'ignore' süreçte 'throw' stack'siz/sessiz kaybolur;
// onun yerine stderr'e logla + exit(1) ile deterministik başarısız ol (orphan yok).
server.on('error', (e) => {
  if (e && e.code === 'EADDRINUSE') process.exit(0);
  log('server', e);
  process.exit(1);
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () =>
    console.error(`[askuser] bridge on http://127.0.0.1:${PORT}`)
  );
}

module.exports = { server, bridge };
