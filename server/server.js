'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Bridge } = require('./bridge.js');

const PORT = process.env.ASKUSER_PORT ? Number(process.env.ASKUSER_PORT) : 4517;
const WEB_DIR = path.join(__dirname, '..', 'web');
const bridge = new Bridge();
const sseClients = new Set();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function broadcastCurrent() {
  const payload = JSON.stringify({ questions: bridge.getCurrent() });
  for (const res of sseClients) res.write(`data: ${payload}\n\n`);
}

function serveStatic(req, res) {
  const rel = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(WEB_DIR, path.normalize(rel));
  if (!file.startsWith(WEB_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/health') return sendJson(res, 200, { ok: true });
  if (req.method === 'GET' && url === '/current')
    return sendJson(res, 200, { questions: bridge.getCurrent() });

  if (req.method === 'GET' && url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ questions: bridge.getCurrent() })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'POST' && url === '/ask') {
    const body = await readBody(req);
    let questions;
    try { questions = JSON.parse(body).questions; } catch { return sendJson(res, 400, { error: 'bad json' }); }
    try {
      const answersPromise = bridge.submitQuestions(questions);
      broadcastCurrent();
      const answers = await answersPromise;
      return sendJson(res, 200, { answers });
    } catch (e) {
      return sendJson(res, 409, { error: e.message });
    }
  }

  if (req.method === 'POST' && url === '/answer') {
    const body = await readBody(req);
    let answers;
    try { answers = JSON.parse(body).answers; } catch { return sendJson(res, 400, { error: 'bad json' }); }
    try {
      bridge.provideAnswers(answers);
      broadcastCurrent();
      return sendJson(res, 200, { ok: true });
    } catch (e) {
      return sendJson(res, 409, { error: e.message });
    }
  }

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(404); res.end();
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () =>
    console.error(`[askuser] bridge on http://127.0.0.1:${PORT}`));
}

module.exports = { server, bridge };
