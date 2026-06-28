'use strict';
// bridge-client.mjs ESM modülü olduğundan dynamic import() kullanılır.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
// settings disk I/O'yu izole tmp'ye yönlendir (gerçek ~/.config kirlenmesin).
// server require'ından ÖNCE set edilmeli — lib/settings DIR'i load anında okur.
process.env.XDG_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-bc-'));
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

// /current poll loop — setTimeout busy-wait yerine deterministik bekleme (Contract R id'sini de okur).
async function waitForPending(deadlineMs = 2000) {
  const start = Date.now();
  for (;;) {
    const cur = await (await fetch(`${base}/current`)).json();
    if (cur && cur.id != null && cur.questions) return cur;
    if (Date.now() - start > deadlineMs) throw new Error('pending /ask kaydedilmedi');
    await new Promise((r) => setTimeout(r, 10));
  }
}

test('askBridge() soruları gönderir, eşzamanlı /answer ile resolve olur', async () => {
  const question = 'Renk tercihiniz?';
  const label = 'Mavi';
  const questions = [{ question, header: 'Test', options: [{ label }], multiSelect: false }];
  const answersArray = [{ question, value: label }];

  // askBridge ve /answer eşzamanlı çalışsın.
  const bridgePromise = bridgeClient.askBridge(questions, { timeoutMs: 5000 });

  // Sunucu /ask'i kaydedene kadar bekle ve Contract R round id'sini al.
  const { id } = await waitForPending();

  // /answer ile cevap gönder (Contract R: {id, answers} ve answers Array olmalı).
  const answerRes = await fetch(`${base}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, answers: answersArray }),
  });
  assert.strictEqual(answerRes.status, 200, '/answer 200 dönmeli');

  const answers = await bridgePromise;
  assert.deepStrictEqual(answers, answersArray, 'askBridge() doğru answers değerini döndürmeli');
});

// --- Regression: waitForPending() — L-8 openBrowser race guard ---
test('waitForPending() tur kaydedilince true, kayıt yokken false döner', async () => {
  // Başta pending yok → kısa timeout ile false (best-effort, akışı bloke etmez).
  const noPending = await bridgeClient.waitForPending({ timeoutMs: 150, intervalMs: 20 });
  assert.strictEqual(noPending, false, 'pending yokken false dönmeli');

  // Bir tur aç; waitForPending true dönmeli (browser ancak bundan sonra açılmalı).
  const bridgePromise = bridgeClient.askBridge(
    [{ question: 'Hazır mı?', header: 'H', options: [{ label: 'a' }] }],
    { timeoutMs: 5000 }
  );
  try {
    const seen = await bridgeClient.waitForPending({ timeoutMs: 2000, intervalMs: 20 });
    assert.strictEqual(seen, true, 'tur kaydedilince true dönmeli');
    // Turu temizle: /current'tan id alıp /answer ile çöz.
    const { id } = await waitForPending();
    await fetch(`${base}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, answers: [{ question: 'Hazır mı?', answer: 'a' }] }),
    });
    await bridgePromise;
  } catch (e) {
    // Beklenmedik hata: turu iptal etmeyi dene, sonra fırlat.
    await bridgePromise.catch(() => {});
    throw e;
  }
});

// --- Regression: ensureServer false (daemon başlatılamadı) yolu ---
test('ensureServer() başlatılamayan portta false döner', async () => {
  // Boş/erişilmez bir porta yönlendir; spawn edilen server bu portu dinleyemez/sağlık vermez.
  // server.js gerçek server'ı spawn etse de sağlık doğrulaması kısa sürede başarısız olur.
  const savedPort = process.env.ASKUSER_PORT;
  process.env.ASKUSER_PORT = '1'; // ayrıcalıklı/bağlanamaz port → isUp hep false
  // bridge-client PORT'u modül yüklenirken okuduğundan taze bir kopya import et.
  const fresh = await import(`../lib/bridge-client.mjs?p=${Date.now()}`);
  try {
    const result = await fresh.ensureServer();
    assert.strictEqual(result, false, 'sağlık doğrulanamayınca false dönmeli');
  } finally {
    if (savedPort === undefined) delete process.env.ASKUSER_PORT;
    else process.env.ASKUSER_PORT = savedPort;
  }
});

// --- Regression: askBridge kısa timeout → TimeoutError ---
test('askBridge() kısa timeout sonrası TimeoutError fırlatır', async () => {
  // Soru gönderilir ama /answer hiç gelmez → AbortController tetiklenir → TimeoutError.
  await assert.rejects(
    () =>
      bridgeClient.askBridge([{ question: 'X?', header: 'H', options: [{ label: 'a' }] }], {
        timeoutMs: 30,
      }),
    (e) => e.name === 'TimeoutError' && /timed out after 30ms/.test(e.message),
    'AbortError TimeoutError olarak yüzeye çıkmalı'
  );
});

// --- Regression: askBridge geçersiz JSON → açık hata (timeout gibi görünmemeli) ---
test('askBridge() geçersiz JSON gövdesinde açık hata fırlatır', async () => {
  // 200 OK ama JSON olmayan gövde dönen geçici bir sunucu kur.
  const http = require('node:http');
  const bad = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html>error</html>');
  });
  await new Promise((r) => bad.listen(0, '127.0.0.1', r));
  const { port } = bad.address();
  const saved = process.env.ASKUSER_PORT;
  process.env.ASKUSER_PORT = String(port); // fresh import'tan ÖNCE set et (BASE modül yükünde okunur)
  const fresh = await import(`../lib/bridge-client.mjs?j=${Date.now()}`);
  try {
    await assert.rejects(
      () =>
        fresh.askBridge([{ question: 'X?', header: 'H', options: [{ label: 'a' }] }], {
          timeoutMs: 2000,
        }),
      (e) => /invalid JSON/.test(e.message) && e.name !== 'TimeoutError',
      'JSON parse hatası timeout gibi görünmemeli'
    );
  } finally {
    if (saved === undefined) delete process.env.ASKUSER_PORT;
    else process.env.ASKUSER_PORT = saved;
    bad.close();
  }
});
