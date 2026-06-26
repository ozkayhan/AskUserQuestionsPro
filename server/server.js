'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Bridge } = require('./bridge.js');
const APP_ID = require('../lib/app-id.cjs');
const Settings = require('../lib/settings.js');

const PORT = process.env.ASKUSER_PORT ? Number(process.env.ASKUSER_PORT) : 4517;
const WEB_DIR = path.join(__dirname, '..', 'web');
const bridge = new Bridge();
const sseClients = new Set();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.map': 'application/json' };

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 8e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
    // req.destroy() (8 MB boyut aşımı) yalnızca 'close' yayar; promise'in asılı kalmaması için.
    req.on('close', () => { if (!req.readableEnded) reject(new Error('connection closed')); });
  });
}

// Geçerli soru tiplerini listele.
const VALID_TYPES = new Set(['single', 'multi', 'binary', 'scale', 'ranking', 'tree']);

// Tree derinliğini özyinelemeli hesapla.
function treeDepth(options, depth) {
  if (!Array.isArray(options) || options.length === 0) return depth;
  let max = depth;
  for (const opt of options) {
    if (opt.children && opt.children.length > 0) {
      max = Math.max(max, treeDepth(opt.children, depth + 1));
    }
  }
  return max;
}

// Soru setinin tipe özgü doğrulaması.
// Döner: {ok:true} | {ok:false, error:string}
function validQuestions(q) {
  if (!Array.isArray(q) || q.length === 0) {
    return { ok: false, error: 'questions must be a non-empty array' };
  }
  for (const it of q) {
    if (!it || typeof it.question !== 'string') {
      return { ok: false, error: 'each question must have a string "question" field' };
    }
    // tip kontrolü
    const t = it.type;
    if (t !== undefined && !VALID_TYPES.has(t)) {
      return { ok: false, error: `invalid type "${t}": must be one of single, multi, binary, scale, ranking, tree` };
    }
    // Etkin tip (type yoksa: multiSelect → multi, aksi single)
    const effectiveType = t || (it.multiSelect ? 'multi' : 'single');
    if (effectiveType === 'scale') {
      // scale: min/max sayı olmalı, min < max, step > 0
      if (typeof it.min !== 'number' || typeof it.max !== 'number') {
        return { ok: false, error: `scale question "${it.question}" requires numeric min and max` };
      }
      if (it.min >= it.max) {
        return { ok: false, error: `scale question "${it.question}" min must be less than max` };
      }
      if (it.step !== undefined && (typeof it.step !== 'number' || it.step <= 0)) {
        return { ok: false, error: `scale question "${it.question}" step must be a positive number` };
      }
    } else if (effectiveType === 'ranking') {
      // ranking: options dizisi, en az 2 öğe
      if (!Array.isArray(it.options) || it.options.length < 2) {
        return { ok: false, error: `ranking question "${it.question}" requires at least 2 options` };
      }
    } else if (effectiveType === 'binary') {
      // binary: options varsa tam 2 şık olmalı
      if (it.options !== undefined && (!Array.isArray(it.options) || it.options.length !== 2)) {
        return { ok: false, error: `binary question "${it.question}" must have exactly 2 options when options is provided` };
      }
    } else if (effectiveType === 'tree') {
      // tree: options boş olmamalı, children varsa array, derinlik ≤ 6
      if (!Array.isArray(it.options) || it.options.length === 0) {
        return { ok: false, error: `tree question "${it.question}" requires a non-empty options array` };
      }
      const depth = treeDepth(it.options, 1);
      if (depth > 6) {
        return { ok: false, error: `tree question "${it.question}" exceeds maximum depth of 6` };
      }
      // children'ların array olduğunu doğrula (özyinelemeli)
      function checkChildren(opts) {
        for (const opt of opts) {
          if (opt.children !== undefined && !Array.isArray(opt.children)) {
            return `tree option "${opt.label}" has invalid children (must be array)`;
          }
          if (Array.isArray(opt.children) && opt.children.length > 0) {
            const err = checkChildren(opt.children);
            if (err) return err;
          }
        }
        return null;
      }
      const childErr = checkChildren(it.options);
      if (childErr) return { ok: false, error: childErr };
    } else {
      // single / multi: options dizisi boş olmamalı
      if (!Array.isArray(it.options) || it.options.length === 0) {
        return { ok: false, error: `question "${it.question}" requires a non-empty options array` };
      }
    }
  }
  return { ok: true };
}

function broadcastCurrent() {
  const payload = JSON.stringify(bridge.peek() || { id: null, questions: null });
  for (const res of sseClients) res.write(`data: ${payload}\n\n`);
}

function serveStatic(req, res) {
  let rel = req.url.split('?')[0];
  if (rel === '/' || rel === '') rel = '/index.html';
  const isIndex = rel === '/index.html';
  const file = path.join(WEB_DIR, path.normalize(rel));
  // Sınır duyarlı kontrol: WEB_DIR'in kendisi veya altı olmalı.
  if (file !== WEB_DIR && !file.startsWith(WEB_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    // index.html: ayarları DOM'a inject et (flash yok — değerler sayfa gelmeden hazır).
    if (isIndex) {
      const tag = `<script>window.__ASKUSER_SETTINGS__=${JSON.stringify(Settings.read())}</script>`;
      const html = buf.toString('utf8').replace('</head>', tag + '</head>');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // app kimliği: eski/yabancı bir server'ın bu portu kapıp /health'e ok demesini ayırt etmek için
  if (req.method === 'GET' && url === '/health') return sendJson(res, 200, { ok: true, app: APP_ID });
  if (req.method === 'GET' && url === '/current')
    return sendJson(res, 200, bridge.peek() || { id: null, questions: null });

  if (req.method === 'GET' && url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify(bridge.peek() || { id: null, questions: null })}\n\n`);
    // 25 sn'de bir yorum-ping: bağlantı/proxy timeout'una karşı keepalive.
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* yok say */ } }, 25000);
    sseClients.add(res);
    req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
    return;
  }

  if (req.method === 'POST' && url === '/ask') {
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'read error' }); }
    let questions;
    try { questions = JSON.parse(body).questions; } catch { return sendJson(res, 400, { error: 'bad json' }); }
    const vq = validQuestions(questions);
    if (!vq.ok) return sendJson(res, 400, { error: vq.error });
    let answersPromise;
    try {
      answersPromise = bridge.submitQuestions(questions);
    } catch (e) {
      return sendJson(res, 409, { error: e.message });
    }
    // Bu istek pending'i sahiplendi; istemci yanıttan önce giderse iptal et ki
    // sonraki sorular kilitlenmesin. Cancel sonrası UI'ı da bilgilendir (broadcast).
    let settled = false;
    const onClose = () => { if (!settled) { bridge.cancel('client disconnected'); broadcastCurrent(); } };
    res.on('close', onClose);
    broadcastCurrent();
    try {
      const answers = await answersPromise;
      settled = true;
      return sendJson(res, 200, { answers });
    } catch (e) {
      settled = true;
      return sendJson(res, 409, { error: e.message });
    } finally {
      res.off('close', onClose);
    }
  }

  if (req.method === 'POST' && url === '/answer') {
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'read error' }); }
    let answers;
    try { answers = JSON.parse(body).answers; } catch { return sendJson(res, 400, { error: 'bad json' }); }
    if (answers === null || typeof answers !== 'object' || Array.isArray(answers))
      return sendJson(res, 400, { error: 'invalid answers' });
    try {
      bridge.provideAnswers(answers);
      broadcastCurrent();
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 409, { error: e.message });
    }
  }

  if (req.method === 'POST' && url === '/settings') {
    let body;
    try { body = await readBody(req); } catch { return sendJson(res, 400, { error: 'read error' }); }
    let patch;
    try { patch = JSON.parse(body); } catch { return sendJson(res, 400, { error: 'bad json' }); }
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
      return sendJson(res, 400, { error: 'invalid settings' });
    // Settings.write zaten validate eder → kötü değer diske ulaşmaz.
    const { _v, ...clientSettings } = Settings.write(patch); // _v disk formatı; tarayıcıya sızdırma
    return sendJson(res, 200, { ok: true, settings: clientSettings });
  }

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(404); res.end();
});

// Daemon olarak başlatılırken port doluysa (eşzamanlı spawn yarışı) sessizce çekil.
server.on('error', (e) => {
  if (e && e.code === 'EADDRINUSE') process.exit(0);
  throw e;
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () =>
    console.error(`[askuser] bridge on http://127.0.0.1:${PORT}`));
}

module.exports = { server, bridge };
