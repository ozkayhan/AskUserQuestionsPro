'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Bridge, DEFAULT_DETACHED_TTL_MS, terminalReason } = require('./bridge.js');
const { RoundStore } = require('../lib/round-store.cjs');
const APP_ID = require('../lib/app-id.cjs');
const Settings = require('../lib/settings.js');
const { log } = require('../lib/log.cjs');
const { createLifecycle } = require('../lib/round-lifecycle.cjs');
const { validQuestions } = require('../lib/question-contract.cjs');
const { readBody, sendJson, sendJsonAndObserve } = require('./http-io.cjs');
const { createSettingsRoutes } = require('./settings-routes.cjs');
const { createRoundRoutes } = require('./round-routes.cjs');

const PORT = process.env.ASKUSER_PORT ? Number(process.env.ASKUSER_PORT) : 4517;
const WEB_DIR = path.join(__dirname, '..', 'web');
const runtimeSettings = () => Settings.inspect().effective;
const settingsStatus = Settings.inspect();
const configuredDetachedTtl = Number(process.env.ASKUSER_DETACHED_ROUND_TTL_MS);
const configuredSettings = runtimeSettings();
const settingsRoutes = createSettingsRoutes({
  Settings,
  Schema: require('../web/settings-schema.js'),
  readBody,
  sendJson,
});
const bridge = new Bridge({
  detachedTtlMs: Number.isFinite(configuredSettings.recovery?.retentionMs)
    ? configuredSettings.recovery.retentionMs
    : Number.isFinite(configuredDetachedTtl)
      ? configuredDetachedTtl
      : DEFAULT_DETACHED_TTL_MS,
  store: new RoundStore(),
  settings: configuredSettings,
});
// Retention is enforced both before recovery hydration and periodically while
// the daemon is idle. The interval is bounded and unref'd so it never keeps a
// CLI process alive.
const cleanupTimer = setInterval(() => bridge._store?.cleanupExpired(), 60 * 1000);
cleanupTimer.unref?.();
bridge._store?.cleanupExpired();
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const roundRoutes = createRoundRoutes({
  bridge,
  createLifecycle,
  lifecycleSettings: settingsStatus.status === 'current' ? configuredSettings : undefined,
  validQuestions,
  terminalReason,
  readBody,
  sendJson,
  sendJsonAndObserve,
});

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
  const status = Settings.inspect();
  const legacy =
    status.status === 'current'
      ? require('../web/settings-schema.js').browserToLegacy(status.effective.browser)
      : Settings.read();
  const tag = `<script>window.__ASKUSER_SETTINGS__=${JSON.stringify(legacy)}</script><script>window.__ASKUSER_SETTINGS_V2__=${JSON.stringify(settingsRoutes.readSettings())}</script>`;
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
  if (await roundRoutes.handle(req, res, url)) return;

  if (await settingsRoutes.handle(req, res, url)) return;

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(404);
  res.end();
}

function handleRequestError(res, error) {
  log('server', error);
  const ownerId = res.__askuserRoundId;
  if (ownerId != null && bridge.cancel('server error', ownerId)) roundRoutes.broadcastCurrent();
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
