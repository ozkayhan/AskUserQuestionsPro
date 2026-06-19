# askuserquestionspro — "Mükemmelleştirme v1" Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Her task BAĞIMSIZ ve kendi kendine yeterlidir; subagent yalnızca task metnini + adı geçen dosyaları okur. Gereksiz dosya taramayın — token tasarrufu.

**Goal:** `BUG-REPORT.md`'deki 18 hatanın tamamını gidermek, gelecekteki hata sınıflarını önleyen savunma katmanları eklemek, ön-yüz runtime'ını yerelleştirip hızlandırmak, Vercel marka izlerini kaldırıp özgün marka koymak ve projeyi GitHub'da yayınlanmaya hazır, cilalı bir 1.0 haline getirmek.

**Architecture:** Üç süreç (hook ↔ server/bridge ↔ web) korunur. Düzeltmeler katman katman: (1) server/bridge/hook çekirdek sağlamlığı, (2) web karar mantığı, (3) yerel vendored runtime (React production + Babel, uzak servis yok), (4) marka/görsel, (5) kurulum/dağıtım, (6) dokümanlar. Mevcut "saf mantık + sıfır build + güvenli fallback" ilkeleri bozulmaz; testler `node --test` ile sıfır-bağımlılık kalır.

**Tech Stack:** Node ≥18 (`http`, `fs`, `child_process`, global `fetch`), tarayıcıda React 18 (production UMD, **yerel**) + Babel standalone (**yerel**), saf CSS custom property tema sistemi. Test: `node --test`.

**Claude Code hook sözleşmesi (context7 ile doğrulandı):** PreToolUse çıktısı `{ hookSpecificOutput: { hookEventName:"PreToolUse", permissionDecision:"allow|deny|ask", permissionDecisionReason, updatedInput }, suppressOutput?, systemMessage?, continue? }`. Exit 0 = stdout transcript'e yansır; **geçersiz/yarım JSON → picker atlanmaz**. Stdin: `tool_input.questions`. Bu sözleşme (allow + updatedInput.answers) korunacak.

---

## Dosya yapısı (neyin nerede değişeceği)

| Dosya | Eylem | Sorumluluk değişikliği |
|-------|-------|------------------------|
| `server/bridge.js` | Modify | Tur kimliği (`id`) eklenir; `peek()` `{id,questions}` döner |
| `server/server.js` | Modify | cancel'da broadcast; SSE'de `id`; input validation; EADDRINUSE; SSE heartbeat; statik sınır sertleştirme |
| `hooks/askuserquestionspro-bridge.mjs` | Modify | stdout flush; cross-platform openBrowser + error yutma; top-level catch; uncaught guard |
| `hooks/hook-output.js` | Modify | `suppressOutput:true` eklenir |
| `web/answer-map.js` | Modify | `savePopupState` saf helper (custom kaldırma); değişiklik yok diğer mantık |
| `web/live.js` | Modify | `useLiveQuestions` `{id,questions}` döner; reconnect timeout temizliği; `postAnswers` hata fırlatır |
| `web/app.js` | Modify | Flow key=round id; submit hata kurtarma + boş-submit guard + double-submit guard; progress sel-tabanlı |
| `web/views.js` | Modify | Vercel üçgeni → özgün marka; CustomPopup "Remove"; Submit disabled; hint range fix |
| `web/ui-kit.js` | Modify | Yeni `Brand` ikon bileşeni |
| `web/index.html` | Modify | Yerel vendored scriptler; favicon; title/meta; production React |
| `web/styles.css` | Modify | Default accent de-Vercel; küçük cila |
| `web/vendor/` | Create | `react.production.min.js`, `react-dom.production.min.js`, `babel.min.js` (yerel) |
| `bin/install.js` | Modify | Hook yolu tırnaklanır |
| `install.sh` | Modify | curl\|bash kalıcı dizine kopyalar; idempotent jq; yol tırnaklanır |
| `package.json` | Modify | repository/bugs/homepage/author; version 1.0.0; files'a vendor |
| `LICENSE` | Create | MIT tam metin |
| `.github/workflows/ci.yml` | Create | `node --test` CI |
| `README.md` | Rewrite | Cilalı, doğru kurulum, özellikler, tema galerisi, sorun giderme |
| `living_docs/*`, `CODEMAP.md` | Modify | Yeni davranışlar + dürüst "yerel" iddiası |
| `BUG-REPORT.md` | Modify | Her bug'a "✅ Çözüldü (Task N)" notu |
| `test/*` | Modify/Create | Tüm yeni davranışlara regresyon testi |

---

## Yürütme kuralları (her subagent için)

1. **TDD:** Mümkün olan her yerde önce başarısız test, sonra minimal kod, sonra yeşil. Saf mantık (`bridge.js`, `answer-map.js`, `hook-output.js`, `install.js`) tam test edilir.
2. **İzole port:** Server testleri/manuel denemeler `ASKUSER_PORT` ile değil, `server.listen(0)` ile rastgele portta (mevcut testlerdeki gibi). Prod 4517'ye dokunma.
3. **`cat` YASAK:** Bu ortamda `cat` ANSI renk kodu enjekte eder ve dosyaları bozar. Dosya oluşturmak/okumak için **yalnızca Read/Write/Edit** araçları; içerik görüntülemek için Read.
4. **Her task sonunda:** `node --test` çalıştır (hepsi yeşil olmalı), sonra commit.
5. **Commit formatı:** `<type>: <özet>` (feat/fix/docs/refactor/test/chore). Türkçe özet.
6. **Doğrulama kanıtı:** "Geçti" demeden önce komutu çalıştır ve çıktıyı gör.

---

## Task 0: Çalışma dalı oluştur

**Files:** (git)

- [ ] **Step 1: Dal oluştur**

Run:
```bash
cd /Users/oka/Documents/work/projects/askuseroz
git checkout -b perfect/v1
git status
```
Expected: `Switched to a new branch 'perfect/v1'`, temiz ağaç (BUG-REPORT.md ve bu plan untracked olabilir — onları da ekleyeceğiz).

- [ ] **Step 2: Mevcut rapor + planı işle (baz commit)**

Run:
```bash
git add BUG-REPORT.md docs/superpowers/plans/2026-06-11-perfection-v1.md
git commit -m "docs: kapsamli hata raporu + mukemmellestirme plani"
```

---

# FAZ A — Çekirdek sağlamlık (server / bridge / hook)

## Task 1: Bridge'e tur kimliği (round id) ekle — B10 temeli

**Files:**
- Modify: `server/bridge.js`
- Test: `test/bridge.test.js`

- [ ] **Step 1: Failing test ekle** (`test/bridge.test.js` sonuna ekle)

```js
test('her submit artan benzersiz id verir; peek {id,questions} doner', () => {
  const b = new Bridge();
  assert.strictEqual(b.peek(), null);
  b.submitQuestions([{ question: 'Q1' }]);
  const p1 = b.peek();
  assert.ok(typeof p1.id === 'number');
  assert.deepStrictEqual(p1.questions, [{ question: 'Q1' }]);
  b.cancel('x');
  b.submitQuestions([{ question: 'Q2' }]);
  const p2 = b.peek();
  assert.ok(p2.id > p1.id, 'id artmali');
});
```

- [ ] **Step 2: Testi çalıştır, kırmızı gör**

Run: `node --test test/bridge.test.js`
Expected: FAIL — `b.peek is not a function`.

- [ ] **Step 3: `server/bridge.js`'i güncelle**

`constructor`'ı ve metotları şu hale getir (tam dosya içeriği):

```js
'use strict';

// Tek-uçuş randevu: bir soru seti kaydedilir, cevap gelene dek promise açık tutulur.
// Her tur monoton artan bir `id` taşır (UI'ın tur başına remount kararı için).
class Bridge {
  constructor() {
    this._pending = null; // { id, questions, resolve, reject }
    this._seq = 0;
  }

  // Hook tarafı: soru setini kaydet, cevap promise'i al.
  submitQuestions(questions) {
    if (this._pending) {
      return Promise.reject(new Error('A question set is already pending'));
    }
    const id = ++this._seq;
    return new Promise((resolve, reject) => {
      this._pending = { id, questions, resolve, reject };
    });
  }

  // UI tarafı: o an bekleyen soru seti (yoksa null) — yan etkisiz.
  getCurrent() {
    return this._pending ? this._pending.questions : null;
  }

  // UI tarafı: o an bekleyen { id, questions } (yoksa null).
  peek() {
    return this._pending ? { id: this._pending.id, questions: this._pending.questions } : null;
  }

  // UI tarafı: cevapları ver, bekleyen submitQuestions promise'ini resolve et.
  provideAnswers(answers) {
    if (!this._pending) throw new Error('No pending question set');
    const p = this._pending;
    this._pending = null;
    p.resolve(answers);
    return true;
  }

  // Timeout/iptal.
  cancel(reason) {
    if (!this._pending) return false;
    const p = this._pending;
    this._pending = null;
    p.reject(new Error(reason || 'cancelled'));
    return true;
  }
}

module.exports = { Bridge };
```

- [ ] **Step 4: Tüm bridge testleri yeşil**

Run: `node --test test/bridge.test.js`
Expected: PASS (eski 4 + yeni 1).

- [ ] **Step 5: Commit**

```bash
git add server/bridge.js test/bridge.test.js
git commit -m "feat(bridge): tur kimligi (id) + peek() — UI remount temeli"
```

---

## Task 2: Server — cancel'da broadcast (B3), SSE'de id (B10), EADDRINUSE, heartbeat, statik sertleştirme (B15)

**Files:**
- Modify: `server/server.js`
- Test: `test/server.test.js`

- [ ] **Step 1: Failing testler ekle** (`test/server.test.js` sonuna)

```js
test('/current ve /events payload {id, questions} icerir', async () => {
  const questions = [{ question: 'QID?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  await new Promise((r) => setTimeout(r, 50));
  const cur = await (await fetch(`${base}/current`)).json();
  assert.ok(typeof cur.id === 'number', 'id alani olmali');
  assert.deepStrictEqual(cur.questions, questions);
  await fetch(`${base}/answer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'QID?': 'A' } }),
  });
  await askPromise;
});

test('/ask gecersiz questions (dizi degil) -> 400', async () => {
  const r = await fetch(`${base}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: 'oops' }),
  });
  assert.strictEqual(r.status, 400);
});

test('istemci /ask kopusunda SSE null push edilir (olu soru temizlenir)', async () => {
  // SSE dinle
  const sse = await fetch(`${base}/events`);
  const reader = sse.body.getReader();
  const dec = new TextDecoder();
  const events = [];
  (async () => { while (true) { const { value, done } = await reader.read(); if (done) break;
    for (const l of dec.decode(value).split('\n')) if (l.startsWith('data:')) events.push(l.slice(5).trim()); } })();
  await new Promise((r) => setTimeout(r, 30));
  const ac = new AbortController();
  const askP = fetch(`${base}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions: [{ question: 'BYE?', options: [{ label: 'A' }], multiSelect: false }] }),
    signal: ac.signal }).catch(() => {});
  await new Promise((r) => setTimeout(r, 50));
  ac.abort();           // hook öldü
  await askP;
  await new Promise((r) => setTimeout(r, 80));
  const last = events[events.length - 1];
  assert.match(last, /"questions":null/, 'cancel sonrasi son SSE olayi null olmali');
  reader.cancel().catch(() => {});
});
```

- [ ] **Step 2: Kırmızı gör**

Run: `node --test test/server.test.js`
Expected: yeni 3 test FAIL (id yok; 'oops' kabul edilip 409/timeout; cancel'da null gelmez).

- [ ] **Step 3: `server/server.js`'i güncelle**

Aşağıdaki tam dosyayla değiştir:

```js
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Bridge } = require('./bridge.js');

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
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
    // req.destroy() (boyut aşımı) yalnızca 'close' yayar; promise'in asılı kalmaması için.
    req.on('close', () => { if (!req.readableEnded) reject(new Error('connection closed')); });
  });
}

// Soru setinin temel şekil doğrulaması (kötü/eksik girdiyi 400'le geri çevir).
function validQuestions(q) {
  return Array.isArray(q) && q.length > 0 && q.every((it) =>
    it && typeof it.question === 'string' && Array.isArray(it.options));
}

function broadcastCurrent() {
  const payload = JSON.stringify(bridge.peek() || { id: null, questions: null });
  for (const res of sseClients) res.write(`data: ${payload}\n\n`);
}

function serveStatic(req, res) {
  let rel = req.url.split('?')[0];
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(WEB_DIR, path.normalize(rel));
  // Sınır duyarlı kontrol: WEB_DIR'in kendisi veya altı olmalı.
  if (file !== WEB_DIR && !file.startsWith(WEB_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
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
    if (!validQuestions(questions)) return sendJson(res, 400, { error: 'invalid questions' });
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
```

> Not: `validQuestions` boş `answers:{}`'i değil, **soru** şeklini doğrular. Boş cevap guard'ı web tarafında (Task 8) + hook tarafında (Task 5) ele alınır.

- [ ] **Step 4: Tüm server testleri yeşil**

Run: `node --test test/server.test.js`
Expected: PASS (eski 3 + yeni 3).

- [ ] **Step 5: Commit**

```bash
git add server/server.js test/server.test.js
git commit -m "fix(server): cancel'da SSE broadcast (B3), SSE id (B10), input validation, EADDRINUSE, heartbeat, statik sinir (B15)"
```

---

## Task 3: hook-output — `suppressOutput` ekle (transcript temizliği)

**Files:**
- Modify: `hooks/hook-output.js`
- Test: `test/hook-output.test.js`

- [ ] **Step 1: Failing test ekle** (`test/hook-output.test.js` mevcut testin içine assert ekle)

Mevcut test fonksiyonunun sonuna şu iki satırı ekle (assert bloğunun ardına):
```js
  assert.strictEqual(out.suppressOutput, true, 'JSON payload transcripte yansimasin');
  assert.strictEqual(hso.hookEventName, 'PreToolUse');
```

- [ ] **Step 2: Kırmızı gör**

Run: `node --test test/hook-output.test.js`
Expected: FAIL — `suppressOutput` undefined.

- [ ] **Step 3: `hooks/hook-output.js`'i güncelle**

Dönüş objesine `suppressOutput: true` ekle:
```js
function buildHookOutput(toolInput, answers) {
  return {
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Answered via custom AskUserQuestion UI',
      updatedInput: {
        questions: toolInput.questions,
        answers: answers,
      },
    },
  };
}
```

- [ ] **Step 4: Yeşil**

Run: `node --test test/hook-output.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/hook-output.js test/hook-output.test.js
git commit -m "feat(hook-output): suppressOutput ile transcript temizligi"
```

---

## Task 4: Hook — stdout flush (B5), cross-platform openBrowser + error yutma (B9), top-level catch (B13)

**Files:**
- Modify: `hooks/askuserquestionspro-bridge.mjs`

- [ ] **Step 1: `hooks/askuserquestionspro-bridge.mjs`'i tam olarak şu içerikle değiştir**

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { buildHookOutput } = require("./hook-output.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ASKUSER_PORT || "4517";
const BASE = `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = 5 * 60 * 1000;

// Her beklenmedik hata native picker'a düşmeli (ARCHITECTURE §7 değişmezi).
process.on("uncaughtException", () => process.exit(0));
process.on("unhandledRejection", () => process.exit(0));

function readStdin() {
  return new Promise((resolve) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
    process.stdin.on("error", () => resolve(d));
  });
}

async function isUp() {
  try { return (await fetch(`${BASE}/health`)).ok; } catch { return false; }
}

async function ensureServer() {
  if (await isUp()) return true;
  const child = spawn(process.execPath, [path.join(HERE, "..", "server", "server.js")], {
    detached: true, stdio: "ignore", env: process.env,
  });
  child.on("error", () => {}); // spawn başarısızsa aşağıdaki poll false döner
  child.unref();
  for (let i = 0; i < 30; i++) { if (await isUp()) return true; await delay(100); }
  return false;
}

// Tarayıcıyı platforma uygun komutla aç; başarısızlık AKIŞI BOZMASIN.
function openBrowser() {
  const plat = process.platform;
  const cmd = plat === "darwin" ? "open" : plat === "win32" ? "cmd" : "xdg-open";
  const args = plat === "win32" ? ["/c", "start", "", BASE] : [BASE];
  try {
    const c = spawn(cmd, args, { stdio: "ignore", detached: true });
    c.on("error", () => {}); // 'open'/'xdg-open' yoksa unhandled 'error' ile çökmesin
    c.unref();
  } catch { /* yok say — kullanıcı sekmeyi elle açabilir */ }
}

// stdout'u flush ederek çık: process.exit() bekleyen pipe yazımını kesebilir (B5).
function writeAndExit(payload) {
  process.exitCode = 0;
  process.stdout.write(payload, () => process.exit(0));
}

async function main() {
  const raw = await readStdin();
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); } // bozuk → native UI
  const toolInput = input.tool_input || {};
  if (!toolInput.questions) process.exit(0);

  if (!(await ensureServer())) process.exit(0); // köprü yok → native fallback

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let answers;
  try {
    const askPromise = fetch(`${BASE}/ask`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: toolInput.questions }), signal: controller.signal,
    });
    openBrowser();
    const r = await askPromise;
    if (!r.ok) throw new Error(`bridge returned ${r.status}`); // 409/4xx/5xx → native fallback
    answers = (await r.json()).answers;
  } catch {
    clearTimeout(timer);
    process.exit(0); // timeout/hata → native fallback
  }
  clearTimeout(timer);

  // Cevap yok ya da hiçbir soru cevaplanmamış ({}) → native picker'a düş.
  if (answers == null || (typeof answers === "object" && Object.keys(answers).length === 0)) {
    process.exit(0);
  }
  writeAndExit(JSON.stringify(buildHookOutput(toolInput, answers)));
}

main().catch(() => process.exit(0)); // her sapma → native fallback
```

- [ ] **Step 2: Sözdizimi/akış kontrolü (boş stdin → temiz exit 0)**

Run:
```bash
printf '' | node hooks/askuserquestionspro-bridge.mjs; echo "exit=$?"
```
Expected: `exit=0`, stdout boş (bozuk/boş JSON → native fallback).

- [ ] **Step 3: tool_input.questions yoksa exit 0**

Run:
```bash
printf '{"tool_name":"Bash","tool_input":{}}' | node hooks/askuserquestionspro-bridge.mjs; echo "exit=$?"
```
Expected: `exit=0`, stdout boş.

- [ ] **Step 4: Commit**

```bash
git add hooks/askuserquestionspro-bridge.mjs
git commit -m "fix(hook): stdout flush (B5), cross-platform+guvenli openBrowser (B9), top-level catch + uncaught guard (B13)"
```

---

# FAZ B — Web karar mantığı

## Task 5: answer-map — `savePopupState` saf helper (B4: custom kaldırma)

**Files:**
- Modify: `web/answer-map.js`
- Test: `test/answer-map.test.js`

- [ ] **Step 1: Failing testler ekle** (`test/answer-map.test.js` sonuna)

```js
const AM2 = require('../web/answer-map.js');

t2('savePopupState: bos metin custom secimi KALDIRIR (multiSelect deselect yolu)', () => {
  const a = { sel: [0, 2], customText: 'eski' };
  assert2.deepStrictEqual(AM2.savePopupState(a, 2, ''), { sel: [0], customText: '' });
});
t2('savePopupState: metin custom secimi EKLER/gunceller', () => {
  const a = { sel: [0], customText: '' };
  assert2.deepStrictEqual(AM2.savePopupState(a, 2, 'yeni'), { sel: [0, 2], customText: 'yeni' });
});
t2('savePopupState: zaten secili custom metin gunceller (cift eklemez)', () => {
  const a = { sel: [2], customText: 'a' };
  assert2.deepStrictEqual(AM2.savePopupState(a, 2, 'b'), { sel: [2], customText: 'b' });
});
```

- [ ] **Step 2: Kırmızı gör**

Run: `node --test test/answer-map.test.js`
Expected: FAIL — `AM2.savePopupState is not a function`.

- [ ] **Step 3: `web/answer-map.js`'e helper ekle**

Factory dönüş objesinden ÖNCE (decideActivate'den sonra) şu fonksiyonu ekle:
```js
  // Popup "kaydet" mantığı (saf): boş metin = custom seçimi kaldır, dolu = ekle/güncelle.
  // a: { sel:number[], customText }, optIdx: custom indeksi, text: trim'lenmiş metin
  function savePopupState(a, optIdx, text) {
    if (!text) {
      return { sel: a.sel.filter(function (i) { return i !== optIdx; }), customText: '' };
    }
    var sel = a.sel.indexOf(optIdx) === -1 ? a.sel.concat([optIdx]) : a.sel;
    return { sel: sel, customText: text };
  }
```
Ve `return { mapAnswers: ..., decideActivate: ... };` satırını şu yap:
```js
  return { mapAnswers: mapAnswers, decideActivate: decideActivate, savePopupState: savePopupState };
```

- [ ] **Step 4: Yeşil**

Run: `node --test test/answer-map.test.js`
Expected: PASS (tüm eski + yeni 3).

- [ ] **Step 5: Commit**

```bash
git add web/answer-map.js test/answer-map.test.js
git commit -m "feat(answer-map): savePopupState saf helper — custom secim kaldirma (B4)"
```

---

## Task 6: live.js — `{id,questions}` + reconnect temizliği (B14) + postAnswers hata (B6)

**Files:**
- Modify: `web/live.js`

- [ ] **Step 1: `web/live.js`'i tam olarak şu içerikle değiştir**

```js
/* global React */
/* askuseroz · live — köprüyle I/O: bekleyen soruları SSE ile al, cevabı POST et */
const { useState: useStateLive, useEffect: useEffectLive, useRef: useRefLive } = React;

// SSE ile bekleyen turu canlı al: { id, questions } (questions null = bekliyor).
function useLiveQuestions() {
  const [round, setRound] = useStateLive({ id: null, questions: null });
  const timerRef = useRefLive(null);
  useEffectLive(() => {
    let es;
    let closed = false;
    const connect = () => {
      es = new EventSource("/events");
      es.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          setRound({ id: d.id ?? null, questions: d.questions ?? null });
        } catch { /* ': ping' yorumları onmessage'a düşmez; yine de yut */ }
      };
      es.onerror = () => {
        es.close();
        if (!closed) timerRef.current = setTimeout(connect, 1000);
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timerRef.current); if (es) es.close(); };
  }, []);
  return round;
}

// Eşlenmiş cevapları köprüye gönder; başarısızlıkta THROW eder (UI kurtarsın).
async function postAnswers(answers) {
  const r = await fetch("/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!r.ok) throw new Error(`/answer ${r.status}`);
  return r.json();
}
```

- [ ] **Step 2: Sözdizimi kontrolü (Babel olmadan kaba parse)**

Run: `node --check web/live.js`
Expected: JSX olmadığı için (sadece bu dosya saf JS) hata yoksa sessiz çıkar. (Hata verirse düzelt.)

> Not: `app.js`/`views.js` JSX içerdiğinden `node --check` onlarda KULLANILMAZ; onları Task 9 sonunda tarayıcı/headless ile doğrularız.

- [ ] **Step 3: Commit**

```bash
git add web/live.js
git commit -m "fix(live): {id,questions} round + reconnect temizligi (B14) + postAnswers hata firlatir (B6)"
```

---

## Task 7: app.js — round-key remount (B10), submit hata kurtarma + boş/double guard (B6/B8/B17), popup kaldırma (B4), progress (B16), key (B11)

**Files:**
- Modify: `web/app.js`

- [ ] **Step 1: `web/app.js`'i tam olarak şu içerikle değiştir**

```jsx
/* global React, ReactDOM, AnswerMap, useLiveQuestions, postAnswers, fullOptions,
   Check, Waiting, Sidebar, Hints, QuestionCard, CustomPopup, Summary */
/* askuseroz · app — durum makinesi: soru akışı, klavye, gönderim. Sunum web/views.js'te. */
const { useState, useEffect, useRef, useCallback } = React;

function App() {
  const { id, questions } = useLiveQuestions();

  if (!questions || questions.length === 0) {
    return (
      <div className="app">
        <Waiting />
      </div>
    );
  }
  // key = tur kimliği: aynı metinli ardışık soru setleri bile temiz remount olur (B10).
  return <Flow questions={questions} key={id == null ? "q" : "round-" + id} />;
}

function Flow({ questions }) {
  const QUESTIONS = questions;
  const n = QUESTIONS.length;

  // answers[question] = { sel:number[], confirmed, customText }
  const [answers, setAnswers] = useState(() => {
    const a = {};
    QUESTIONS.forEach((q) => { a[q.question] = { sel: [], confirmed: false, customText: "" }; });
    return a;
  });
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState("right");
  const [popup, setPopup] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [sendError, setSendError] = useState(false);

  const isSummary = current >= n;
  const ref = useRef({});
  ref.current = { answers, current, popup, n, isSummary, submitted };

  const inputRef = useRef(null);
  useEffect(() => { if (popup && inputRef.current) inputRef.current.focus(); }, [popup]);

  const goTo = useCallback((idx, direction) => {
    setDir(direction);
    setCurrent(Math.max(0, Math.min(n, idx)));
  }, [n]);

  const advance = useCallback((from) => {
    if (from < n - 1) goTo(from + 1, "right");
    else goTo(n, "right");
  }, [goTo, n]);

  const goBack = useCallback(() => {
    const idx = QUESTIONS.findIndex((q) => !ref.current.answers[q.question].confirmed);
    goTo(idx === -1 ? n - 1 : idx, "left");
  }, [goTo, n, QUESTIONS]);

  const setQ = useCallback((qid, patch) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }, []);

  const activate = useCallback((qIndex, optIdx) => {
    const q = QUESTIONS[qIndex];
    const a = ref.current.answers[q.question];
    const action = AnswerMap.decideActivate(q, a, optIdx);
    switch (action.type) {
      case "noop":
        return;
      case "select":
      case "toggle":
        setQ(q.question, { sel: action.sel, confirmed: false });
        return;
      case "popup":
        setPopup({ qid: q.question, optIdx: action.optIdx, draft: action.draft });
        return;
      case "confirm":
        setQ(q.question, { confirmed: true });
        advance(qIndex);
        return;
    }
  }, [setQ, advance, QUESTIONS]);

  const confirmCurrent = useCallback(() => {
    const { current: cur } = ref.current;
    if (cur >= n) return;
    const q = QUESTIONS[cur];
    const a = ref.current.answers[q.question];
    if (a.sel.length === 0) return;
    const opts = fullOptions(q);
    const customIdx = opts.length - 1;
    if (a.sel.includes(customIdx) && !a.customText) {
      setPopup({ qid: q.question, optIdx: customIdx, draft: "" });
      return;
    }
    setQ(q.question, { confirmed: true });
    advance(cur);
  }, [n, setQ, advance, QUESTIONS]);

  const savePopup = useCallback(() => {
    const p = ref.current.popup;
    if (!p) return;
    const text = (p.draft || "").trim();
    setAnswers((prev) => {
      const a = prev[p.qid];
      const next = AnswerMap.savePopupState(a, p.optIdx, text); // boş metin = kaldır (B4)
      return { ...prev, [p.qid]: { ...a, sel: next.sel, customText: next.customText, confirmed: false } };
    });
    setPopup(null);
  }, []);

  // Custom popup'tan "Remove": seçimi kaldır (B4 — multiSelect Other deselect).
  const removeCustom = useCallback(() => {
    const p = ref.current.popup;
    if (!p) return;
    setAnswers((prev) => {
      const a = prev[p.qid];
      const next = AnswerMap.savePopupState(a, p.optIdx, "");
      return { ...prev, [p.qid]: { ...a, sel: next.sel, customText: next.customText, confirmed: false } };
    });
    setPopup(null);
  }, []);

  const mappedAnswers = useCallback(() => {
    const stateForMap = {};
    QUESTIONS.forEach((q) => {
      const a = ref.current.answers[q.question];
      stateForMap[q.question] = { sel: a.sel, customText: a.customText };
    });
    return AnswerMap.mapAnswers(QUESTIONS, stateForMap);
  }, [QUESTIONS]);

  const submit = useCallback(() => {
    if (ref.current.submitted) return;               // double-submit guard (B17)
    const mapped = mappedAnswers();
    if (Object.keys(mapped).length === 0) return;    // boş submit guard (B8)
    setSendError(false);
    setSubmitted(true);
    postAnswers(mapped).catch(() => {                // B6: hata → kilidi aç, uyar
      setSubmitted(false);
      setSendError(true);
    });
  }, [mappedAnswers]);

  useEffect(() => {
    const onKey = (e) => {
      const R = ref.current;
      if (R.popup || R.submitted) return;
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(Math.min(R.n, R.current + 1), "right"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(Math.max(0, R.current - 1), "left"); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (R.isSummary) { submit(); return; }
        confirmCurrent();
      } else if (R.isSummary && (e.key === "b" || e.key === "B")) { e.preventDefault(); goBack(); }
      else if (!R.isSummary && /^[1-9]$/.test(e.key)) { e.preventDefault(); activate(R.current, parseInt(e.key, 10) - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, confirmCurrent, activate, goBack, submit]);

  // "answered" = en az bir şık seçili (sel) — gönderimle tutarlı (B16).
  const answered = QUESTIONS.filter((q) => answers[q.question].sel.length > 0).length;
  const canSubmit = answered > 0;

  return (
    <div className="app" data-panel="left" data-align="center">
      <Sidebar QUESTIONS={QUESTIONS} answers={answers} current={current} n={n}
               answered={answered} isSummary={isSummary} submitted={submitted}
               goTo={goTo} />
      <main className="inspector">
        <div className="stage">
          {isSummary ? (
            <Summary answers={answers} QUESTIONS={QUESTIONS}
                     onEdit={(i) => goTo(i, "left")} onBack={goBack}
                     onSubmit={submit} submitted={submitted} canSubmit={canSubmit} />
          ) : (
            <QuestionCard key={QUESTIONS[current].question} q={QUESTIONS[current]}
                          qIndex={current} ans={answers[QUESTIONS[current].question]}
                          motion="slide" dir={dir} onActivate={activate} />
          )}
        </div>
        {!isSummary && <Hints q={QUESTIONS[current]} />}
      </main>
      {popup && (
        <CustomPopup q={QUESTIONS.find((q) => q.question === popup.qid)} draft={popup.draft}
                     selected={answers[popup.qid].sel.includes(popup.optIdx)}
                     inputRef={inputRef} onChange={(v) => setPopup((p) => ({ ...p, draft: v }))}
                     onSave={savePopup} onRemove={removeCustom} onCancel={() => setPopup(null)} />
      )}
      {submitted && (
        <div className="toast"><span className="ok"><Check c="var(--success)" /></span>
          Answers sent back to the agent.</div>
      )}
      {sendError && (
        <div className="toast toast--err">Couldn’t send — bridge unavailable. Press Enter to retry.</div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
```

- [ ] **Step 2: Commit** (görsel doğrulama Task 9'da toplu)

```bash
git add web/app.js
git commit -m "fix(app): round-key remount (B10), submit hata kurtarma/bos/double guard (B6/B8/B17), popup remove (B4), progress (B16)"
```

---

## Task 8: views.js — de-Vercel marka (logo), CustomPopup Remove + her zaman Save, Submit disabled, hint range fix

**Files:**
- Modify: `web/views.js`
- Modify: `web/ui-kit.js`

- [ ] **Step 1: `web/ui-kit.js`'e özgün `Brand` ikonu ekle**

`Kbd` tanımından sonra, `fullOptions`'tan önce ekle:
```jsx
/* Özgün marka: bir girdiden iki seçeneğe ayrılan "karar düğümü" (Vercel üçgeni DEĞİL) */
const Brand = ({ s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
    <path d="M6 10h3.5M9.5 10L13.5 6M9.5 10L13.5 14" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="5" cy="10" r="2" fill="var(--accent)" />
    <circle cx="14.5" cy="5.5" r="1.8" fill="var(--fg)" />
    <circle cx="14.5" cy="14.5" r="1.8" fill="var(--fg)" />
  </svg>
);
```

- [ ] **Step 2: `web/views.js` Sidebar brand mark'ını değiştir**

`web/views.js` içinde `<span className="brand__mark">...</span>` bloğunu (Vercel üçgeni SVG'si) şununla değiştir:
```jsx
          <span className="brand__mark"><Brand s={20} /></span>
```
(Eski `<svg ...><path d="M10 1.5L18.5 17H1.5L10 1.5z" .../></svg>` tamamen silinir.)

Ve dosya başındaki `/* global ... */` yorumuna `Brand` ekle:
```jsx
/* global React, Check, Kbd, Brand, fullOptions, Themes */
```

- [ ] **Step 3: `CustomPopup`'ı güncelle** (Remove butonu + her zaman kaydedilebilir/kaldırılabilir)

`web/views.js` içindeki `CustomPopup` fonksiyonunu tam olarak şu hale getir:
```jsx
function CustomPopup({ q, draft, selected, inputRef, onChange, onSave, onRemove, onCancel }) {
  const autosize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  useEffectView(() => { autosize(inputRef.current); }, [draft]);
  const trimmed = (draft || "").trim();
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="popup">
        <div className="popup__chip">{q.header} · Other</div>
        <div className="popup__title">{q.question}</div>
        <textarea ref={inputRef} className="popup__input" rows={1} value={draft}
                  placeholder="Type your own answer — write as much as you need…"
                  onChange={(e) => { onChange(e.target.value); autosize(e.target); }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); }
                    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
                  }} />
        <div className="popup__foot">
          <span className="popup__hint"><Kbd>↵</Kbd> Save · <Kbd>⇧↵</Kbd> New line · <Kbd>esc</Kbd> Cancel</span>
          <div className="popup__actions">
            {selected && <button className="btn btn--danger" onClick={onRemove}>Remove</button>}
            <button className="btn" onClick={onCancel}>Cancel</button>
            <button className="btn btn--primary" onClick={onSave} disabled={!selected && !trimmed}>
              {trimmed ? "Save answer" : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```
> Mantık: metin varsa "Save answer"; metin boş ama seçim varsa primary buton "Remove" olur ve `savePopupState('')` çağrısıyla kaldırır. `selected` iken ayrı kırmızı "Remove" da görünür.

- [ ] **Step 4: `Summary`'yi `canSubmit` ile güncelle**

`web/views.js` `Summary` imzasını ve Submit butonunu değiştir:
```jsx
function Summary({ answers, QUESTIONS, onEdit, onBack, onSubmit, submitted, canSubmit }) {
```
ve Submit butonu:
```jsx
        <button className="btn btn--lg btn--primary" onClick={onSubmit} disabled={!canSubmit || submitted}>
          {submitted ? "Submitted ✓" : canSubmit ? <>Submit answers <Kbd>↵</Kbd></> : "Answer at least one"}
        </button>
```

- [ ] **Step 5: `Hints` erişilebilir aralık düzeltmesi (B12)**

`web/views.js` `Hints` içindeki `<Kbd>{fullOptions(q).length}</Kbd>` ifadesini şu yap:
```jsx
        <span className="kbd-group"><Kbd>1</Kbd>–<Kbd>{Math.min(9, fullOptions(q).length)}</Kbd></span> Select
```

- [ ] **Step 6: Commit**

```bash
git add web/views.js web/ui-kit.js
git commit -m "feat(web): de-Vercel ozgun marka + CustomPopup Remove (B4) + Submit disabled (B8/B17) + hint range (B12)"
```

---

## Task 9: styles.css — hata/danger stilleri, de-Vercel accent, favicon-uyumu

**Files:**
- Modify: `web/styles.css`

- [ ] **Step 1: Default accent'i de-Vercel yap** (`:root` içinde)

`--accent: #0070f3;` satırını şu yap (Vercel'in birebir mavisinden farklı, daha canlı azur):
```css
  --accent: #4d8dff;
```
ve `--accent-soft`/`--accent-line`'ı uyumlu yap:
```css
  --accent-soft: rgba(77, 141, 255, 0.14);
  --accent-line: rgba(77, 141, 255, 0.55);
```
(Diğer 4 tema kendi accent'ini zaten override ediyor; sadece base AMOLED değişir.)

- [ ] **Step 2: Danger butonu + hata toast stilleri ekle** (dosya sonuna)

```css
/* danger / hata durumları */
.btn--danger { color: #ff6b6b; border-color: rgba(255,107,107,0.4); background: rgba(255,107,107,0.08); }
.btn--danger:hover { background: rgba(255,107,107,0.16); }
.toast--err {
  background: rgba(255,107,107,0.14);
  border-color: rgba(255,107,107,0.45);
  color: #ffd9d9;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/styles.css
git commit -m "feat(styles): de-Vercel accent + danger/hata toast stilleri"
```

---

# FAZ C — Performans + tam yerel runtime (uzak servis yok)

## Task 10: React + ReactDOM (production) + Babel'i yerelleştir

**Files:**
- Create: `web/vendor/react.production.min.js`
- Create: `web/vendor/react-dom.production.min.js`
- Create: `web/vendor/babel.min.js`
- Modify: `web/index.html`
- Modify: `package.json` (files'a `web/vendor/` zaten `web/` ile kapsanır — ek gerekmez)

- [ ] **Step 1: Vendor dosyalarını indir** (curl ile; `cat` KULLANMA)

Run:
```bash
mkdir -p web/vendor
curl -fsSL https://unpkg.com/react@18.3.1/umd/react.production.min.js -o web/vendor/react.production.min.js
curl -fsSL https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js -o web/vendor/react-dom.production.min.js
curl -fsSL https://unpkg.com/@babel/standalone@7.29.0/babel.min.js -o web/vendor/babel.min.js
ls -l web/vendor/
```
Expected: üç dosya da >0 byte (react ~10KB, react-dom ~130KB, babel ~1.5MB).

- [ ] **Step 2: `web/index.html`'i güncelle** (yerel scriptler + production React + favicon + meta)

`web/index.html`'i tam olarak şu içerikle değiştir:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ask · Agent</title>
  <meta name="description" content="A calm, full-screen local UI for Claude Code's AskUserQuestion — answer the agent's questions in style." />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M6 10h3.5M9.5 10L13.5 6M9.5 10L13.5 14' stroke='%234d8dff' stroke-width='1.6' stroke-linecap='round' fill='none'/%3E%3Ccircle cx='5' cy='10' r='2' fill='%234d8dff'/%3E%3Ccircle cx='14.5' cy='5.5' r='1.8' fill='%23ededed'/%3E%3Ccircle cx='14.5' cy='14.5' r='1.8' fill='%23ededed'/%3E%3C/svg%3E" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="root"></div>
  <!-- Tam yerel runtime: production React + Babel, uzak CDN'e bağımlı değil (offline çalışır) -->
  <script src="vendor/react.production.min.js"></script>
  <script src="vendor/react-dom.production.min.js"></script>
  <script src="vendor/babel.min.js"></script>
  <script src="answer-map.js"></script>
  <script src="themes.js"></script>
  <script type="text/babel" src="ui-kit.js"></script>
  <script type="text/babel" src="live.js"></script>
  <script type="text/babel" src="views.js"></script>
  <script type="text/babel" src="app.js"></script>
</body>
</html>
```
> Not: Yazı tipleri hâlâ Google Fonts'tan ama `--font-sans`/`--font-mono` `system-ui` fallback'i taşıdığından çevrimdışı da okunur kalır. Fonksiyonel runtime (React/Babel) artık %100 yereldir.

- [ ] **Step 3: Doğrula — sayfa yereli kullanıyor, uzak script yok**

Run:
```bash
grep -n "unpkg\|cdn\|development.js" web/index.html || echo "OK: uzak script kalmadi"
```
Expected: `OK: uzak script kalmadi`.

- [ ] **Step 4: Server ile statik servis dumanı**

Run:
```bash
ASKUSER_PORT=4599 node server/server.js & SRV=$!; sleep 0.5
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4599/vendor/react.production.min.js
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4599/
kill $SRV
```
Expected: iki istek de `200`.

- [ ] **Step 5: Commit**

```bash
git add web/vendor web/index.html
git commit -m "perf: React(production)+Babel yerellestirildi — uzak CDN yok, offline + hizli"
```

---

# FAZ D — Görsel doğrulama (headless)

## Task 11: Headless render dumanı (tüm web JS hatasız yükleniyor mu)

**Files:** (geçici doğrulama; kalıcı dosya bırakma)

- [ ] **Step 1: Headless Chrome ile konsol-hata kontrolü**

Amaç: React+Babel yerel yüklenince app gerçekten render oluyor mu, JSX derleme hatası var mı. Server'ı izole portta başlat, bir test sorusu enjekte et, headless Chrome'la aç, konsol hatalarını yakala.

Run (Chrome yolu macOS):
```bash
ASKUSER_PORT=4601 node server/server.js & SRV=$!; sleep 0.5
# bekleyen bir soru oluştur (long-poll arka planda)
( curl -s -X POST http://127.0.0.1:4601/ask -H 'Content-Type: application/json' \
    -d '{"questions":[{"question":"Renk?","header":"UI","multiSelect":false,"options":[{"label":"Mavi","description":"x"},{"label":"Yesil","description":"y"}]}]}' & )
sleep 0.3
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox --dump-dom --virtual-time-budget=4000 \
  --host-resolver-rules="MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9" \
  http://127.0.0.1:4601/ 2>/tmp/chrome.err | grep -o 'qcard__q[^<]*' | head -1
echo "--- konsol/stderr (script/render hatasi olmamali) ---"
grep -iE "error|uncaught|is not defined|unexpected token" /tmp/chrome.err | grep -v zshenv | head -20 || echo "temiz"
kill $SRV 2>/dev/null; rm -f /tmp/chrome.err
```
Expected: DOM çıktısında soru başlığı (`Renk?`) görünür; stderr'de `is not defined`/`Unexpected token`/render hatası **yok**. (Font host'ları 127.0.0.1:9'a map'lendiği için ağ stall'ı olmaz — THEMES.md'deki yöntem.)

> Chrome yoksa veya farklı platformda: bu adımı atla ama **mutlaka** `node --check web/live.js` (JSX'siz dosyalar) + manuel gözle kod incelemesi yap ve PR notuna "headless atlandı" yaz.

- [ ] **Step 2: Tema dumanı (opsiyonel hızlı)**

Aynı komutu `http://127.0.0.1:4601/?theme=phosphor` ile tekrarla; DOM'da `data-theme="phosphor"` görünmeli (themes.js render öncesi uygular).

- [ ] **Step 3: Not** — Bu task commit üretmez (doğrulama). Sorun bulursan ilgili Task'a dön, düzelt, yeniden çalıştır.

---

# FAZ E — Kurulum / dağıtım

## Task 12: install.js — hook yolunu tırnakla (B7)

**Files:**
- Modify: `bin/install.js`
- Modify: `test/install.test.js`

- [ ] **Step 1: Test beklentisini güncelle** (`test/install.test.js`)

`const CMD = \`node ${HOOK}\`;` satırını şu yap:
```js
const CMD = `node "${HOOK}"`;
```

- [ ] **Step 2: Kırmızı gör**

Run: `node --test test/install.test.js`
Expected: FAIL (üretilen komut tırnaksız, beklenen tırnaklı).

- [ ] **Step 3: `bin/install.js` `hookCommand`'i güncelle**

```js
function hookCommand(hookAbsPath) {
  return `node "${hookAbsPath}"`;
}
```
> `isOurEntry` zaten `command.includes(hookAbsPath)` ile eşleştiği için tırnak eklenmesi mevcut/temizlik mantığını bozmaz (yol hâlâ substring).

- [ ] **Step 4: Yeşil**

Run: `node --test test/install.test.js`
Expected: PASS (8 test).

- [ ] **Step 5: Commit**

```bash
git add bin/install.js test/install.test.js
git commit -m "fix(install): hook yolu tirnaklandi — bosluklu kurulum yolu (B7)"
```

---

## Task 13: install.sh — curl|bash kalıcı dizine kopyalar (B1), idempotent (B2), yol tırnaklı (B7)

**Files:**
- Modify: `install.sh`

- [ ] **Step 1: `install.sh`'i tam olarak şu içerikle değiştir**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Kalıcı kurulum dizini (curl | bash dalında repo buraya kopyalanır; hook buradan çalışır).
INSTALL_DIR="${ASKUSER_HOME:-$HOME/.local/share/askuserquestionspro}"

# Lokal çalıştırma: DIR = script dizini. curl | bash: GitHub'dan indir → kalıcı dizine kopyala.
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  echo "📥 askuserquestionspro indiriliyor…"
  curl -fsSL "https://github.com/ozkayhan/AskUserQuestionsPro/archive/refs/heads/main.zip" -o "$TMP/repo.zip"
  unzip -q "$TMP/repo.zip" -d "$TMP"
  SRC="$TMP/AskUserQuestionsPro-main"
  rm -rf "$INSTALL_DIR"
  mkdir -p "$INSTALL_DIR"
  cp -R "$SRC/." "$INSTALL_DIR/"
  DIR="$INSTALL_DIR"   # ← kalıcı; trap yalnızca $TMP'i siler, hook silinmez
fi

SETTINGS="$HOME/.claude/settings.json"
HOOK="$DIR/hooks/askuserquestionspro-bridge.mjs"
CMD="node \"$HOOK\""

mkdir -p "$HOME/.claude"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

if command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  # Idempotent: bizim komutumuz zaten varsa ekleme; başka AskUserQuestion hook'u varsa uyar ama dokunma.
  jq --arg cmd "$CMD" '
    .hooks //= {} | .hooks.PreToolUse //= [] |
    if any(.hooks.PreToolUse[]?; (.hooks // [])[]?.command == $cmd) then .
    elif any(.hooks.PreToolUse[]?; .matcher == "AskUserQuestion") then
      ( . + { "_askuserquestionspro_conflict": true } )
    else
      .hooks.PreToolUse += [{ "matcher": "AskUserQuestion",
        "hooks": [{ "type": "command", "command": $cmd, "timeout": 360 }] }]
    end
  ' "$SETTINGS" > "$tmp"
  if grep -q '"_askuserquestionspro_conflict"' "$tmp"; then
    echo "UYARI: settings.json'da BAŞKA bir AskUserQuestion PreToolUse hook'u var."
    echo "Tek hook olmalı (issue #15897). Elle kontrol edin: $SETTINGS — değişiklik YAPILMADI."
    rm -f "$tmp"
    exit 1
  fi
  mv "$tmp" "$SETTINGS"
  echo "Hook kuruldu → $SETTINGS"
  echo "Kurulum dizini: $DIR"
else
  cat <<EOF
jq bulunamadı. $SETTINGS dosyasına elle ekleyin:

  "hooks": {
    "PreToolUse": [
      { "matcher": "AskUserQuestion",
        "hooks": [{ "type": "command", "command": "$CMD", "timeout": 360 }] }
    ]
  }
EOF
fi
echo "Bitti. Yeni bir 'claude' oturumu açın; AskUserQuestion artık özel arayüzde açılır."
```
> Kural-3 (`cat` yasağı) sadece bu Claude oturumundaki dosya I/O'su için; install.sh içindeki `cat <<EOF` heredoc'u son kullanıcının kabuğunda çalışır, sorun değil — dokunma.

- [ ] **Step 2: Statik kontrol** (idempotent jq + kalıcı kopya mantığı yerinde mi)

Run:
```bash
bash -n install.sh && echo "syntax OK"
grep -n "INSTALL_DIR\|cp -R\|any(.hooks.PreToolUse" install.sh | grep -v zshenv
```
Expected: `syntax OK`; kalıcı kopya + idempotent jq satırları görünür.

- [ ] **Step 3: İzole idempotency dumanı** (gerçek settings'e dokunmadan)

Run:
```bash
T="$(mktemp)"; echo '{}' > "$T"
CMD='node "/x/hooks/askuserquestionspro-bridge.mjs"'
applyonce() { tmp="$(mktemp)"; jq --arg cmd "$CMD" '
  .hooks //= {} | .hooks.PreToolUse //= [] |
  if any(.hooks.PreToolUse[]?; (.hooks // [])[]?.command == $cmd) then .
  else .hooks.PreToolUse += [{ "matcher":"AskUserQuestion","hooks":[{"type":"command","command":$cmd,"timeout":360}]}] end
' "$T" > "$tmp" && mv "$tmp" "$T"; }
applyonce; applyonce; applyonce
echo "entry sayisi (1 beklenir):"; jq '[.hooks.PreToolUse[]|select(.matcher=="AskUserQuestion")]|length' "$T"
rm -f "$T"
```
Expected: `entry sayisi (1 beklenir): 1`.

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "fix(install.sh): curl|bash kalici dizine kopyalar (B1), idempotent (B2), yol tirnakli (B7)"
```

---

## Task 14: package.json metadata + LICENSE

**Files:**
- Modify: `package.json`
- Create: `LICENSE`

- [ ] **Step 1: `package.json`'ı tam olarak şu içerikle değiştir**

```json
{
  "name": "askuserquestionspro",
  "version": "1.0.0",
  "description": "A calm, full-screen local UI for Claude Code's AskUserQuestion — replaces the built-in picker via a zero-dependency local bridge. Offline, themeable, keyboard-first.",
  "type": "commonjs",
  "bin": {
    "askuserquestionspro": "bin/cli.js"
  },
  "files": [
    "bin/",
    "hooks/",
    "server/",
    "web/",
    "install.sh",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "test": "node --test",
    "serve": "node server/server.js",
    "install-hook": "node bin/cli.js install",
    "doctor": "node bin/cli.js doctor"
  },
  "engines": {
    "node": ">=18"
  },
  "keywords": [
    "claude",
    "claude-code",
    "askuserquestion",
    "hook",
    "cli",
    "amoled",
    "tui",
    "prompt-ui",
    "local"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ozkayhan/AskUserQuestionsPro.git"
  },
  "homepage": "https://github.com/ozkayhan/AskUserQuestionsPro#readme",
  "bugs": {
    "url": "https://github.com/ozkayhan/AskUserQuestionsPro/issues"
  },
  "author": "ozkayhan",
  "license": "MIT"
}
```

- [ ] **Step 2: `LICENSE` oluştur** (MIT tam metin)

```
MIT License

Copyright (c) 2026 ozkayhan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Doğrula**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json valid')" | grep -v zshenv
test -f LICENSE && echo "LICENSE var"
```
Expected: `package.json valid` ve `LICENSE var`.

- [ ] **Step 4: Commit**

```bash
git add package.json LICENSE
git commit -m "chore: package.json 1.0.0 metadata + MIT LICENSE"
```

---

## Task 15: CI workflow (node --test)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: `.github/workflows/ci.yml` oluştur**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: node --test
```

- [ ] **Step 2: Doğrula** (YAML temel sözdizimi)

Run:
```bash
node -e "const s=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(!/node --test/.test(s)) throw new Error('eksik'); console.log('ci.yml OK')" | grep -v zshenv
```
Expected: `ci.yml OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: node --test matrisi (18/20/22)"
```

---

# FAZ F — Dokümanlar (yayın cilası)

## Task 16: README'yi baştan yaz (cilalı, doğru, 10k-star vitrin)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: `README.md`'i tam olarak şu içerikle değiştir**

````markdown
<div align="center">

# askuserquestionspro

**A calm, full-screen local UI for Claude Code's `AskUserQuestion`.**
Answer the agent's clarifying questions in a beautiful AMOLED interface instead of the cramped terminal picker — fully local, zero-dependency, keyboard-first.

[Install](#install) · [How it works](#how-it-works) · [Themes](#themes) · [Keyboard](#keyboard) · [Troubleshooting](#troubleshooting)

</div>

---

When Claude Code needs to ask you a multiple-choice question, it calls its built-in
`AskUserQuestion` tool, which opens a small terminal picker. **askuserquestionspro** quietly
intercepts that picker and opens a rich full-screen UI in your browser instead. You
pick there; the answer flows back to the model — it never notices the difference.

Everything runs on `127.0.0.1`. The web runtime (React) is **vendored locally**, so it
works **offline** with no remote CDN. If the bridge is down or you close the tab, Claude
Code silently falls back to its native picker — **it can never lock you up.**

## Install

### One line (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/ozkayhan/AskUserQuestionsPro/main/install.sh | bash
```

Installs into `~/.local/share/askuserquestionspro` and wires the hook into
`~/.claude/settings.json`. Open a new `claude` session — that's it.

### With npm

```bash
npm install -g askuserquestionspro
askuserquestionspro install
```

### From a local clone

```bash
git clone https://github.com/ozkayhan/AskUserQuestionsPro.git
cd AskUserQuestionsPro
./install.sh
```

All three are **idempotent** — safe to re-run.

### CLI

| Command | What it does |
|---------|--------------|
| `askuserquestionspro install` | Wire the hook into `~/.claude/settings.json` |
| `askuserquestionspro uninstall` | Remove the hook |
| `askuserquestionspro serve` | Run the bridge in the foreground (debug, port 4517) |
| `askuserquestionspro doctor` | Check install + bridge health |

## How it works

```
Claude Code ──PreToolUse hook──► local bridge (port 4517) ──SSE──► browser UI
     ▲                                                                  │
     └───────────────── answers (permissionDecision: allow) ◄──────────┘
```

- A `PreToolUse` hook (`hooks/askuserquestionspro-bridge.mjs`) catches `AskUserQuestion`.
- The local bridge (`server/server.js`, zero-dependency) pushes the questions to the
  `web/` UI over Server-Sent Events.
- Your answer is returned via `permissionDecision: "allow"` + `updatedInput`, so the
  native picker never appears.

Three processes, one invariant: **askuserquestionspro never blocks Claude Code.** Every error
path falls back to the native picker.

## Themes

Ships with **5 fully-distinct themes** — not just colors, but fonts, shadows, corner
radius, texture, motion and glass/blur. Switch from the **Theme** picker at the bottom
of the sidebar; your choice is saved to `localStorage`.

| Theme | Vibe |
|-------|------|
| **AMOLED** | True-black, electric azure, crisp |
| **Paper** | Warm paper, serif display, terracotta, flat |
| **Phosphor** | CRT green, monospace, scanlines, glow |
| **Dusk** | Charcoal & amber, rounded, soft |
| **Aurora** | Indigo glass, violet, gradient, large radius |

Add `?theme=phosphor` to the URL to preview a theme via a shareable link.

## Keyboard

- `1`–`9` select · press the same key again (or `↵`) to confirm · `← →` to navigate
- `↵` on **Other** opens a growing textarea (`⇧↵` for a new line)
- On Review: `B` jump back to the first unanswered question · `↵` submit

## Requirements

- **Node ≥ 18** (uses the built-in global `fetch`)
- **macOS / Linux** for auto-opening the browser (`open` / `xdg-open`); on other
  platforms the UI still works — open `http://127.0.0.1:4517` manually.
- `jq` recommended for `install.sh` (falls back to printed manual instructions).

## Troubleshooting

- **The UI didn't open.** Run `askuserquestionspro doctor`. Open `http://127.0.0.1:4517`
  manually; the bridge starts automatically on the first question.
- **"Another AskUserQuestion hook exists."** Claude Code allows only one `PreToolUse`
  hook for `AskUserQuestion` (issue #15897). Open `~/.claude/settings.json` and keep
  just one.
- **Nothing happens / native picker shows.** That's the safe fallback. Check
  `askuserquestionspro doctor` and that you started a **new** `claude` session after install.

## Development

```bash
npm test                          # node --test, zero dependencies
npm run serve                     # bridge at http://127.0.0.1:4517
ASKUSER_PORT=4599 npm run serve   # isolated port (don't clash with prod 4517)
```

See [`CODEMAP.md`](CODEMAP.md) for the file map and [`living_docs/`](living_docs/) for
architecture and purpose.

## License

[MIT](LICENSE) © ozkayhan
````

- [ ] **Step 2: Doğrula** — eski yanlış iddialar gitti (Vercel/CDN bağımlılığı vurgusu doğru)

Run:
```bash
grep -niE "unpkg|development build|vercel" README.md | grep -v zshenv || echo "OK: eski/yanlis ifade yok"
```
Expected: `OK: eski/yanlis ifade yok`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README baştan yazildi — dogru kurulum, ozellikler, tema galerisi, sorun giderme"
```

---

## Task 17: living_docs + CODEMAP güncelle + BUG-REPORT çözüm notları

**Files:**
- Modify: `living_docs/PURPOSE.md`
- Modify: `living_docs/ARCHITECTURE.md`
- Modify: `CODEMAP.md`
- Modify: `BUG-REPORT.md`

- [ ] **Step 1: `living_docs/PURPOSE.md` — "uzak servis yok" iddiasını dürüstleştir**

`## 3` Kural 2 bloğundaki "Sıfır build adımı" maddesini şu hale getir (React artık yerel):
```markdown
- **Sıfır build adımı** — tarayıcıda React (production, **yerel vendored**) + Babel
  (yerel) JSX'i runtime'da derler. Fonksiyonel runtime tamamen yereldir; uzak CDN'e
  bağımlı değildir (yalnızca yazı tipleri opsiyonel olarak Google Fonts'tan, `system-ui`
  fallback ile).
```
Ve `## 5` macOS varsayımı maddesini şu yap:
```markdown
- **Tarayıcı açma:** macOS `open`, Linux `xdg-open`, Windows `start` denenir; biri yoksa
  akış bozulmadan devam eder (kullanıcı sekmeyi elle açabilir). Kurulum `bash`/`jq` ister.
```

- [ ] **Step 2: `living_docs/ARCHITECTURE.md` — yeni davranışlar**

`## 7. Hata modları` tablosundan SONRA şu notu ekle:
```markdown
> **v1 sağlamlık eklemeleri:** (a) İstemci kopuşunda `cancel` artık `broadcastCurrent()`
> ile SSE'ye `null` yayınlar → tarayıcı ölü soruyu göstermez. (b) Her tur monoton
> `id` taşır; UI `Flow`'u tur başına remount eder (özdeş ardışık sorularda eski durum
> sızmaz). (c) Hook stdout'u flush ederek çıkar (`process.exit` truncation'ı önlenir).
> (d) `openBrowser` cross-platform + hata yutar. (e) `/ask` soru şeklini, `/answer`
> cevap şeklini doğrular (400). (f) Web runtime yerel vendored (offline).
```
Ve `## 9` test tablosundaki "UI render'ı testlere dahil değildir" paragrafının sonuna:
```markdown
Sürüm 1'de `bridge.peek()`/round-id, `answer-map.savePopupState`, server input
validation ve cancel-broadcast için regresyon testleri eklendi. Görsel render headless
Chrome dumanı ile doğrulanır (THEMES.md yöntemi).
```

- [ ] **Step 3: `CODEMAP.md` — vendor + web/vendor satırı**

Klasör ağacında `web/` bloğuna şu satırı ekle (`└── app.js` satırından önce uygun yere):
```
│   ├── vendor/                 [YEREL RUNTIME] react.production, react-dom.production, babel (CDN yok)
```

- [ ] **Step 4: `BUG-REPORT.md` — her bug'a çözüm notu**

Şiddet özeti tablosunun hemen altına şu bloğu ekle:
```markdown
> **Çözüm durumu (Mükemmelleştirme v1):** B1–B18'in tamamı `docs/superpowers/plans/2026-06-11-perfection-v1.md`
> planıyla giderildi. Eşleme: B1/B2/B7→Task 12-13, B3/B10/B15→Task 2, B4→Task 5/7/8,
> B5/B9/B13→Task 4, B6→Task 6/7, B8/B17→Task 7/8, B11→Task 7 (round-key+index render),
> B12→Task 8, B14→Task 6, B16→Task 7, B18→Task 17. Ek: "uzak CDN bağımlılığı"
> (yerelleştirme, Task 10) ve de-Vercel marka (Task 8-9).
```

- [ ] **Step 5: Doğrula + Commit**

Run:
```bash
grep -c "yerel vendored\|broadcastCurrent" living_docs/PURPOSE.md living_docs/ARCHITECTURE.md | grep -v zshenv
git add living_docs/PURPOSE.md living_docs/ARCHITECTURE.md CODEMAP.md BUG-REPORT.md
git commit -m "docs: living docs + CODEMAP + BUG-REPORT v1 cozum notlari"
```

---

# FAZ G — Nihai doğrulama + entegrasyon

## Task 18: Tam test + uçtan uca duman + dalı main'e al

**Files:** (yok — doğrulama + git)

- [ ] **Step 1: Tüm test seti yeşil**

Run: `node --test 2>&1 | tail -12`
Expected: `pass` sayısı = toplam, `fail 0`. (Yeni testlerle ~48+ test.)

- [ ] **Step 2: Uçtan uca köprü dumanı (izole port)** — gerçek round-trip + cancel-broadcast

Run:
```bash
ASKUSER_PORT=4777 node server/server.js & SRV=$!; sleep 0.5
# health
curl -fsS http://127.0.0.1:4777/health
# ask + answer round-trip
( curl -s -X POST http://127.0.0.1:4777/ask -H 'Content-Type: application/json' \
   -d '{"questions":[{"question":"X?","header":"H","multiSelect":false,"options":[{"label":"A","description":"d"}]}]}' \
   -o /tmp/ask.json & )
sleep 0.3
curl -s -X POST http://127.0.0.1:4777/answer -H 'Content-Type: application/json' -d '{"answers":{"X?":"A"}}'
sleep 0.2
echo "--- /ask yaniti ---"; node -e "console.log(require('fs').readFileSync('/tmp/ask.json','utf8'))" | grep -v zshenv
kill $SRV 2>/dev/null; rm -f /tmp/ask.json
```
Expected: health `{"ok":true}`; `/ask` yanıtı `{"answers":{"X?":"A"}}`.

- [ ] **Step 3: Geçersiz girdi 400 dumanı**

Run:
```bash
ASKUSER_PORT=4778 node server/server.js & SRV=$!; sleep 0.5
curl -s -o /dev/null -w "ask-bad=%{http_code} " -X POST http://127.0.0.1:4778/ask -H 'Content-Type: application/json' -d '{"questions":"x"}'
curl -s -o /dev/null -w "answer-bad=%{http_code}\n" -X POST http://127.0.0.1:4778/answer -H 'Content-Type: application/json' -d '{"answers":[1]}'
kill $SRV 2>/dev/null
```
Expected: `ask-bad=400 answer-bad=400`.

- [ ] **Step 4: index.html'de uzak script kalmadı (son kontrol)**

Run: `grep -c "unpkg\|development.js" web/index.html | grep -v zshenv` → `0` beklenir (grep eşleşmezse `0`).

- [ ] **Step 5: Çalışma ağacı temiz, tüm commitler atıldı**

Run: `git status --short | grep -v zshenv && git log --oneline main..perfect/v1 | grep -v zshenv | head -30`
Expected: status temiz; commit listesi tüm task'ları gösterir.

- [ ] **Step 6: main'e fast-forward merge (YALNIZCA LOKAL — push YOK)**

Run:
```bash
git checkout main
git merge --no-ff perfect/v1 -m "release: askuserquestionspro v1.0.0 — tum buglar giderildi, yerel runtime, de-Vercel, yayin cilasi"
node --test 2>&1 | tail -4
git log --oneline -1
```
Expected: merge başarılı; `node --test` main'de de yeşil.

> **Push YAPMA.** Kullanıcı GitHub'a yayınlamaya hazır halde teslim istiyor; uzak push'u kullanıcı kendisi yapacak (`git push -u origin main`). Bunu raporla, çalıştırma.

---

## Plan tamamlandı — kapsam öz-denetimi

- **18 bug** → Task eşlemesi BUG-REPORT.md'de (Task 17/Step 4) + her ilgili task'ta bug no'su.
- **Gelecek hata sınıfları** → input validation (Task 2), uncaught/unhandled guard (Task 4), round-id remount (Task 1/7), reconnect temizliği (Task 6), EADDRINUSE (Task 2), SSE heartbeat (Task 2).
- **Performans/yerel** → Task 10 (production React + yerel vendored, CDN yok, offline).
- **De-Vercel** → Task 8 (logo) + Task 9 (accent) + Task 10 (favicon/title).
- **README + docs** → Task 16/17.
- **Yayın hazırlığı** → package.json metadata + LICENSE (Task 14) + CI (Task 15).
- **Placeholder taraması:** tüm kod adımları tam içerik taşır; "TODO/uygun şekilde" yok.
- **Tip tutarlılığı:** `peek()`/`{id,questions}` (Task 1) ↔ server (Task 2) ↔ `useLiveQuestions` (Task 6) ↔ `Flow key` (Task 7) aynı şekil. `savePopupState` (Task 5) ↔ app `savePopup`/`removeCustom` (Task 7) ↔ `CustomPopup` props (Task 8) aynı imza. `canSubmit` (Task 7) ↔ `Summary` prop (Task 8) aynı ad.
