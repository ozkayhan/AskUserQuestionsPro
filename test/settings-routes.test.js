'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Schema = require('../web/settings-schema.js');
const { createSettingsRoutes } = require('../server/settings-routes.cjs');

function request(method, body) {
  return { method, body: body === undefined ? '' : JSON.stringify(body) };
}

function response() {
  return {
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = '') {
      this.body = body;
    },
    json() {
      return JSON.parse(this.body);
    },
  };
}

function settingsFixture() {
  let status = {
    status: 'current',
    revision: 'r0',
    effective: Schema.envelopeDefaults(),
    migration: { needed: false, backup: false },
  };
  let sequence = 0;
  return {
    inspect: () => status,
    inspectReadOnly: () => status,
    doctorProjection: (input) => ({ status: input.status, revision: input.revision }),
    write(patch) {
      return { ok: true, value: { _v: 1, ...Schema.validate(patch) } };
    },
    mutateCompareAndSwap(expectedRevision, mutator) {
      if (expectedRevision !== undefined && expectedRevision !== status.revision)
        return { ok: false, code: 'STALE_REVISION' };
      const value = mutator(status.effective);
      sequence += 1;
      status = { ...status, revision: `r${sequence}`, effective: value };
      return { ok: true, value };
    },
  };
}

function harness({ now = () => 1000 } = {}) {
  const Settings = settingsFixture();
  const routes = createSettingsRoutes({
    Settings,
    Schema,
    readBody: async (req) => req.body,
    sendJson(res, status, value) {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    },
    randomBytes: () => ({ toString: () => 'preview-id' }),
    now,
  });
  return { routes, Settings };
}

test('settings route factory keeps legacy POST results and owns its settings cache', async () => {
  const { routes } = harness();
  const res = response();

  assert.equal(await routes.handle(request('POST', { theme: 'paper' }), res, '/settings'), true);
  assert.equal(res.status, 200);
  assert.equal(res.json().ok, true);
  assert.equal(res.json().settings.theme, 'paper');
  assert.equal('_v' in res.json().settings, false);
  assert.equal(routes.readSettings().browser.theme, 'paper');
});

test('settings route factory preserves export, doctor, preview/apply/reset, and preview expiry', async () => {
  let currentTime = 1000;
  const { routes, Settings } = harness({ now: () => currentTime });

  const exported = response();
  assert.equal(await routes.handle(request('GET'), exported, '/settings/export'), true);
  assert.equal(exported.status, 200);
  assert.deepEqual(exported.headers, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': 'attachment; filename="askuserquestionspro-settings-v2.json"',
    'Cache-Control': 'no-store',
  });
  assert.equal(exported.body, JSON.stringify(Settings.inspect().effective, null, 2) + '\n');

  const doctor = response();
  assert.equal(await routes.handle(request('GET'), doctor, '/settings/doctor'), true);
  assert.deepEqual(doctor.json(), { status: 'current', revision: 'r0' });

  const candidate = Schema.envelopeDefaults();
  candidate.browser.theme = 'paper';
  const previewRes = response();
  assert.equal(
    await routes.handle(
      request('POST', { payload: candidate, baselineRevision: 'r0' }),
      previewRes,
      '/settings/preview'
    ),
    true
  );
  const preview = previewRes.json();
  assert.deepEqual(
    { previewId: preview.previewId, valid: preview.valid, canApply: preview.canApply },
    { previewId: 'preview-id', valid: true, canApply: true }
  );

  const applyRes = response();
  assert.equal(
    await routes.handle(
      request('POST', {
        previewId: preview.previewId,
        payload: candidate,
        baselineRevision: preview.baselineRevision,
      }),
      applyRes,
      '/settings/apply'
    ),
    true
  );
  assert.equal(applyRes.status, 200);
  assert.equal(applyRes.json().settings.browser.theme, 'paper');
  assert.equal(routes.readSettings().browser.theme, 'paper');

  const resetRes = response();
  assert.equal(
    await routes.handle(
      request('POST', { namespace: 'browser', baselineRevision: 'r1' }),
      resetRes,
      '/settings/reset'
    ),
    true
  );
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.json().settings.browser.theme, Schema.namespaceDefaults().browser.theme);

  const expiringPreview = response();
  assert.equal(
    await routes.handle(
      request('POST', { payload: candidate, baselineRevision: 'r2' }),
      expiringPreview,
      '/settings/preview'
    ),
    true
  );
  currentTime += 10 * 60 * 1000 + 1;
  const expired = response();
  await routes.handle(
    request('POST', {
      previewId: expiringPreview.json().previewId,
      payload: candidate,
      baselineRevision: 'r2',
    }),
    expired,
    '/settings/apply'
  );
  assert.deepEqual(
    { status: expired.status, body: expired.json() },
    {
      status: 409,
      body: { error: 'preview expired' },
    }
  );
});

test('settings route factory declines paths outside its ownership', async () => {
  const { routes } = harness();
  assert.equal(await routes.handle(request('GET'), response(), '/current'), false);
});
