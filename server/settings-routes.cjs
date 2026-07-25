'use strict';

const { randomBytes: defaultRandomBytes } = require('node:crypto');

function createSettingsRoutes({
  Settings,
  Schema,
  readBody,
  sendJson,
  randomBytes = defaultRandomBytes,
  now = Date.now,
}) {
  let settingsCache = null;
  let settingsCacheRevision = null;
  const settingsPreviews = new Map();

  function readSettings() {
    const status = Settings.inspect();
    if (settingsCache === null || settingsCacheRevision !== status.revision) {
      settingsCache = status.effective;
      settingsCacheRevision = status.revision;
    }
    return settingsCache;
  }

  function invalidateSettings(value) {
    settingsCache = value || null;
    settingsCacheRevision = value ? Settings.inspect().revision : null;
  }

  async function handle(req, res, url) {
    if (req.method === 'POST' && url === '/settings') {
      let body;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: 'read error' });
        return true;
      }
      let patch;
      try {
        patch = JSON.parse(body);
      } catch {
        sendJson(res, 400, { error: 'bad json' });
        return true;
      }
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        sendJson(res, 400, { error: 'invalid settings' });
        return true;
      }
      const current = Settings.inspect();
      const result =
        current.status === 'current'
          ? Settings.mutateCompareAndSwap(undefined, (envelope) => ({
              ...envelope,
              browser: Schema.mergeBrowserLegacy(envelope.browser, patch),
            }))
          : Settings.write(patch);
      if (!result.ok) {
        sendJson(res, result.code === 'STALE_REVISION' ? 409 : 500, {
          error: (result.error && result.error.message) || result.code || 'settings write failed',
        });
        return true;
      }
      invalidateSettings(result.value);
      const clientSettings =
        result.value._v === 2
          ? Schema.browserToLegacy(result.value.browser)
          : (() => {
              const { _v, ...legacy } = result.value;
              return legacy;
            })();
      sendJson(res, 200, { ok: true, settings: clientSettings });
      return true;
    }

    if (req.method === 'GET' && url === '/settings/export') {
      const status = Settings.inspect();
      const body = JSON.stringify(status.effective, null, 2) + '\n';
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="askuserquestionspro-settings-v2.json"',
        'Cache-Control': 'no-store',
      });
      res.end(body);
      return true;
    }

    if (req.method === 'GET' && url === '/settings/doctor') {
      sendJson(res, 200, Settings.doctorProjection(Settings.inspectReadOnly()));
      return true;
    }

    if (
      req.method !== 'POST' ||
      (url !== '/settings/preview' && url !== '/settings/apply' && url !== '/settings/reset')
    ) {
      return false;
    }

    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'bad json' });
      return true;
    }
    const status = Settings.inspect();
    if (url === '/settings/preview') {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !payload.payload ||
        payload.baselineRevision === undefined
      ) {
        sendJson(res, 400, { error: 'payload and baselineRevision are required' });
        return true;
      }
      const candidate = payload.payload;
      const checked = Schema.inspectEnvelope(candidate);
      const details = checked.valid ? [] : [{ field: '_v', error: checked.status }];
      const id = randomBytes(12).toString('hex');
      if (payload.baselineRevision !== status.revision) {
        sendJson(res, 409, { error: 'baseline changed', baselineRevision: status.revision });
        return true;
      }
      settingsPreviews.set(id, {
        revision: status.revision,
        candidate: checked.envelope,
        payload: candidate,
        expiresAt: now() + 10 * 60 * 1000,
      });
      sendJson(res, 200, {
        previewId: id,
        baselineRevision: status.revision,
        status: checked.status,
        valid: checked.valid,
        errors: details,
        migration: checked.migrated,
        ignored: checked.ignored || { count: 0, truncated: false },
        canApply: checked.valid && checked.status !== 'unsupported-future',
      });
      return true;
    }

    if (url === '/settings/reset') {
      const namespace = payload.namespace;
      const defaults = Schema.namespaceDefaults();
      if (!Object.prototype.hasOwnProperty.call(defaults, namespace)) {
        sendJson(res, 400, { error: 'invalid namespace' });
        return true;
      }
      const result = Settings.mutateCompareAndSwap(payload.baselineRevision, (current) => ({
        ...current,
        [namespace]: defaults[namespace],
      }));
      if (!result.ok) {
        sendJson(res, 409, { error: result.code });
        return true;
      }
      invalidateSettings(result.value);
      sendJson(res, 200, { ok: true, settings: result.value });
      return true;
    }

    if (
      !payload ||
      typeof payload.previewId !== 'string' ||
      !payload.payload ||
      payload.baselineRevision === undefined
    ) {
      sendJson(res, 400, { error: 'previewId, payload and baselineRevision are required' });
      return true;
    }
    const preview = settingsPreviews.get(payload.previewId);
    if (!preview || preview.expiresAt < now()) {
      sendJson(res, 409, { error: 'preview expired' });
      return true;
    }
    if (
      payload.baselineRevision !== preview.revision ||
      JSON.stringify(payload.payload) !== JSON.stringify(preview.payload)
    ) {
      sendJson(res, 409, { error: 'preview payload mismatch' });
      return true;
    }
    const checked = Schema.inspectEnvelope(payload.payload);
    if (!checked.valid || checked.status === 'unsupported-future') {
      sendJson(res, 400, { error: 'invalid import', status: checked.status });
      return true;
    }
    const result = Settings.mutateCompareAndSwap(preview.revision, () => checked.envelope);
    if (!result.ok) {
      sendJson(res, 409, { error: result.code });
      return true;
    }
    settingsPreviews.delete(payload.previewId);
    invalidateSettings(result.value);
    sendJson(res, 200, { ok: true, settings: result.value });
    return true;
  }

  return { handle, readSettings };
}

module.exports = { createSettingsRoutes };
