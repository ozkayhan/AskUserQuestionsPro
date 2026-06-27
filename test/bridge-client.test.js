'use strict';
// bridge-client.mjs ESM modülü olduğundan dynamic import() kullanılır.
const test = require('node:test');
const assert = require('node:assert');
const { server } = require('../server/server.js');

let base;
let bridgeClient;

test.before(async () => {
  // Rastgele boş port bul (port 0).
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
  process.env.ASKUSER_PORT = String(port);

  // ESM modülünü dinamik olarak içe aktar (CommonJS'den).
  bridgeClient = await import('../lib/bridge-client.mjs');
});

test.after(() => {
  server.close();
  delete process.env.ASKUSER_PORT;
});

test('ensureServer() sunucu zaten çalışıyorken true döner', async () => {
  const result = await bridgeClient.ensureServer();
  assert.strictEqual(result, true, 'ensureServer() true döndürmeli');
});

test('askBridge() soruları gönderir, eşzamanlı /answer ile resolve olur', async () => {
  const question = 'Renk tercihiniz?';
  const label = 'Mavi';
  const questions = [{ question, header: 'Test', options: [{ label }], multiSelect: false }];

  // askBridge ve /answer eşzamanlı çalışsın.
  const bridgePromise = bridgeClient.askBridge(questions, { timeoutMs: 5000 });

  // Biraz bekle (sunucunun /ask isteğini aldığından emin ol).
  await new Promise((r) => setTimeout(r, 60));

  // /answer ile cevap gönder.
  const answerRes = await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { [question]: label } }),
  });
  assert.strictEqual(answerRes.status, 200, '/answer 200 dönmeli');

  const answers = await bridgePromise;
  assert.deepStrictEqual(
    answers,
    { [question]: label },
    'askBridge() doğru answers nesnesini döndürmeli'
  );
});
