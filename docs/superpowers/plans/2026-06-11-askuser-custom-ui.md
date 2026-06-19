# AskUserQuestion Özel Arayüz Köprüsü — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code'un her `AskUserQuestion` çağrısını, yerleşik picker yerine otomatik açılan AMOLED Geist web arayüzünde cevaplatmak ve cevabı modele geri döndürmek.

**Architecture:** Bir `PreToolUse` hook soruları yerel bir köprü sunucuya iletir ve tarayıcıyı otomatik açar; köprü soruları SSE ile web UI'a push eder; kullanıcı cevaplayınca cevap hook'a döner ve `updatedInput`/`permissionDecision:"allow"` ile modele verilir, native picker hiç görünmez. Köprü kapalı veya timeout olursa native picker'a güvenli düşüş yapılır.

**Tech Stack:** Node.js (yerleşik `http`, `node:test` — sıfır npm bağımlılığı), React 18 + Babel standalone (CDN, build adımı yok), tasarım kaynağı `design-reference/project/`.

---

## Dosya Yapısı

| Dosya | Sorumluluk |
|-------|-----------|
| `server/bridge.js` | Saf randevu mantığı: bekleyen soru seti + cevap promise'i (HTTP'siz, test edilebilir) |
| `server/server.js` | `bridge`'i HTTP'ye bağlar; UI'ı serve eder; `/ask /answer /current /events /health` |
| `web/answer-map.js` | Saf: UI iç state'i → AskUserQuestion `answers` şekli (UMD: hem tarayıcı hem Node) |
| `web/index.html` | React+Babel CDN kabuğu; `answer-map.js` + `app.js` yükler |
| `web/app.js` | UI: `app.jsx`'ten port; canlı veri (SSE), klavye modeli, popup, summary, submit |
| `web/styles.css` | `design-reference/project/styles.css`'ten birebir |
| `hooks/hook-output.js` | Saf: hook stdout payload'ı (`permissionDecision:allow` + `updatedInput`) üretir |
| `hooks/askuserquestionspro-bridge.mjs` | PreToolUse hook: stdin oku → köprüyü garanti et → `/ask` + tarayıcı aç → stdout |
| `install.sh` | `~/.claude/settings.json`'a hook'u ekler, talimat basar |
| `README.md` | Kurulum + çalıştırma + sorun giderme |

DRY çekirdek: `bridge.js`, `answer-map.js`, `hook-output.js` saf ve birim test edilir. HTTP/hook bunları sarar.

---

### Task 0: Proje iskeleti ve git

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: git başlat**

Run:
```bash
cd /Users/oka/Documents/work/projects/askuseroz
git init
```
Expected: "Initialized empty Git repository"

- [ ] **Step 2: package.json yaz**

`package.json`:
```json
{
  "name": "askuseroz",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test",
    "serve": "node server/server.js"
  }
}
```

- [ ] **Step 3: .gitignore yaz**

`.gitignore`:
```
node_modules/
*.log
.DS_Store
/tmp/
```

- [ ] **Step 4: İlk commit**

```bash
git add package.json .gitignore design-reference docs
git commit -m "chore: scaffold askuseroz project + design reference"
```

---

### Task 1: `web/answer-map.js` — cevap şekli map'leme (saf)

**Files:**
- Create: `web/answer-map.js`
- Test: `test/answer-map.test.js`

- [ ] **Step 1: Başarısız testi yaz**

`test/answer-map.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { mapAnswers } = require('../web/answer-map.js');

const QS = [
  { question: 'Framework?', multiSelect: false, options: [{ label: 'Next.js' }, { label: 'Remix' }] },
  { question: 'Features?', multiSelect: true, options: [{ label: 'Auth' }, { label: 'Cache' }] },
];

test('single-select bir label string döndürür', () => {
  const state = { 'Framework?': { sel: [0], customText: '' } };
  assert.deepStrictEqual(mapAnswers(QS, state), { 'Framework?': 'Next.js' });
});

test('multiSelect label dizisi döndürür', () => {
  const state = { 'Features?': { sel: [0, 1], customText: '' } };
  assert.deepStrictEqual(mapAnswers(QS, state), { 'Features?': ['Auth', 'Cache'] });
});

test('Other şıkkı customText kullanır (label "Other" değil)', () => {
  // Other = options.length indeksi (burada 2)
  const state = { 'Framework?': { sel: [2], customText: 'Astro' } };
  assert.deepStrictEqual(mapAnswers(QS, state), { 'Framework?': 'Astro' });
});

test('cevaplanmamış sorular atlanır', () => {
  assert.deepStrictEqual(mapAnswers(QS, {}), {});
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `node --test test/answer-map.test.js`
Expected: FAIL — `Cannot find module '../web/answer-map.js'`

- [ ] **Step 3: Minimal implementasyonu yaz**

`web/answer-map.js`:
```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AnswerMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var CUSTOM_LABEL = 'Other';

  // questions: AskUserQuestion soru dizisi (her biri {question, options, multiSelect})
  // state: { [question]: { sel: number[], customText: string } }
  //   sel, [...options, Other] dizisine indekslenir; Other son indekstir.
  // döndürür: { [question]: label | [labels] } — AskUserQuestion answers şekli.
  function mapAnswers(questions, state) {
    var out = {};
    questions.forEach(function (q) {
      var s = state[q.question];
      if (!s || !s.sel || s.sel.length === 0) return;
      var opts = q.options.concat([{ label: CUSTOM_LABEL, custom: true }]);
      var labels = s.sel
        .map(function (i) {
          var o = opts[i];
          if (!o) return '';
          return o.custom ? (s.customText || '') : o.label;
        })
        .filter(function (x) { return x !== ''; });
      if (labels.length === 0) return;
      out[q.question] = q.multiSelect ? labels : labels[0];
    });
    return out;
  }

  return { mapAnswers: mapAnswers };
});
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `node --test test/answer-map.test.js`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add web/answer-map.js test/answer-map.test.js
git commit -m "feat: answer-map pure module (UI state -> AskUserQuestion answers)"
```

---

### Task 2: `server/bridge.js` — randevu mantığı (saf)

**Files:**
- Create: `server/bridge.js`
- Test: `test/bridge.test.js`

- [ ] **Step 1: Başarısız testi yaz**

`test/bridge.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { Bridge } = require('../server/bridge.js');

test('submitQuestions, provideAnswers gelince resolve olur', async () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }]);
  assert.deepStrictEqual(b.getCurrent(), [{ question: 'Q?' }]);
  b.provideAnswers({ 'Q?': 'A' });
  assert.deepStrictEqual(await p, { 'Q?': 'A' });
  assert.strictEqual(b.getCurrent(), null);
});

test('bekleyen varken ikinci submit reject olur', async () => {
  const b = new Bridge();
  b.submitQuestions([{ question: 'Q1' }]);
  await assert.rejects(() => b.submitQuestions([{ question: 'Q2' }]));
});

test('bekleyen yokken provideAnswers throw eder', () => {
  const b = new Bridge();
  assert.throws(() => b.provideAnswers({}));
});

test('cancel bekleyen promise i reject eder', async () => {
  const b = new Bridge();
  const p = b.submitQuestions([{ question: 'Q?' }]);
  b.cancel('timeout');
  await assert.rejects(() => p, /timeout/);
  assert.strictEqual(b.getCurrent(), null);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `node --test test/bridge.test.js`
Expected: FAIL — `Cannot find module '../server/bridge.js'`

- [ ] **Step 3: Minimal implementasyonu yaz**

`server/bridge.js`:
```js
'use strict';

// Tek-uçuş randevu: bir soru seti kaydedilir, cevap gelene dek promise açık tutulur.
class Bridge {
  constructor() {
    this._pending = null; // { questions, resolve, reject }
  }

  // Hook tarafı: soru setini kaydet, cevap promise'i al.
  submitQuestions(questions) {
    if (this._pending) {
      return Promise.reject(new Error('A question set is already pending'));
    }
    return new Promise((resolve, reject) => {
      this._pending = { questions, resolve, reject };
    });
  }

  // UI tarafı: o an bekleyen soru seti (yoksa null).
  getCurrent() {
    return this._pending ? this._pending.questions : null;
  }

  hasPending() {
    return this._pending !== null;
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

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `node --test test/bridge.test.js`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add server/bridge.js test/bridge.test.js
git commit -m "feat: bridge rendezvous (single-flight question set <-> answers)"
```

---

### Task 3: `hooks/hook-output.js` — hook payload üreticisi (saf)

**Files:**
- Create: `hooks/hook-output.js`
- Test: `test/hook-output.test.js`

- [ ] **Step 1: Başarısız testi yaz**

`test/hook-output.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { buildHookOutput } = require('../hooks/hook-output.js');

test('allow kararı + updatedInput içinde answers üretir', () => {
  const toolInput = { questions: [{ question: 'Q?', options: [] }] };
  const out = buildHookOutput(toolInput, { 'Q?': 'A' });
  const hso = out.hookSpecificOutput;
  assert.strictEqual(hso.hookEventName, 'PreToolUse');
  assert.strictEqual(hso.permissionDecision, 'allow');
  assert.deepStrictEqual(hso.updatedInput.answers, { 'Q?': 'A' });
  assert.deepStrictEqual(hso.updatedInput.questions, toolInput.questions);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `node --test test/hook-output.test.js`
Expected: FAIL — `Cannot find module '../hooks/hook-output.js'`

- [ ] **Step 3: Minimal implementasyonu yaz**

`hooks/hook-output.js`:
```js
'use strict';

// AskUserQuestion'a cevap sağlayan PreToolUse stdout payload'unu kurar; bu
// payload native picker'ın atlanmasını sağlar.
// toolInput: hook stdin'inden gelen tool_input ({ questions: [...] }).
// answers: { [question]: label | [labels] }.
function buildHookOutput(toolInput, answers) {
  return {
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

module.exports = { buildHookOutput };
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `node --test test/hook-output.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add hooks/hook-output.js test/hook-output.test.js
git commit -m "feat: hook-output builder (PreToolUse allow + updatedInput)"
```

---

### Task 4: `server/server.js` — HTTP köprü + statik UI

**Files:**
- Create: `server/server.js`
- Test: `test/server.test.js`

- [ ] **Step 1: Başarısız entegrasyon testini yaz**

`test/server.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { server, bridge } = require('../server/server.js');

let base;
test.before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test('/health ok döndürür', async () => {
  const r = await fetch(`${base}/health`);
  assert.deepStrictEqual(await r.json(), { ok: true });
});

test('/ask soruları tutar, /answer ile resolve olur', async () => {
  const questions = [{ question: 'Q?', options: [{ label: 'A' }], multiSelect: false }];
  const askPromise = fetch(`${base}/ask`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  });
  // /ask açıkken /current bekleyen soruyu göstermeli
  await new Promise((r) => setTimeout(r, 50));
  const cur = await (await fetch(`${base}/current`)).json();
  assert.deepStrictEqual(cur.questions, questions);

  await fetch(`${base}/answer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers: { 'Q?': 'A' } }),
  });

  const askResult = await (await askPromise).json();
  assert.deepStrictEqual(askResult.answers, { 'Q?': 'A' });
  assert.strictEqual(bridge.getCurrent(), null);
});

test('GET / index.html serve eder', async () => {
  const r = await fetch(`${base}/`);
  const body = await r.text();
  assert.match(body, /<div id="root">/);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `node --test test/server.test.js`
Expected: FAIL — `Cannot find module '../server/server.js'`

- [ ] **Step 3: Minimal implementasyonu yaz**

`server/server.js`:
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
```

- [ ] **Step 4: Geçici bir `web/index.html` ile testi geçir**

Not: Task 5'te tam index.html gelecek; bu testin GET / kısmı için minimal bir placeholder yeterli. Şimdilik:

`web/index.html` (geçici minimal):
```html
<!DOCTYPE html><html><body><div id="root"></div></body></html>
```

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `node --test test/server.test.js`
Expected: PASS (3 test)

- [ ] **Step 6: Commit**

```bash
git add server/server.js test/server.test.js web/index.html
git commit -m "feat: HTTP bridge server (/ask /answer /current /events /health)"
```

---

### Task 5: `web/styles.css` + `web/index.html` — UI kabuğu

**Files:**
- Create: `web/styles.css`
- Modify: `web/index.html`

- [ ] **Step 1: styles.css'i tasarımdan kopyala**

Run:
```bash
cp design-reference/project/styles.css web/styles.css
```
Not: Bu dosya birebir kullanılır (AMOLED Geist tüm stiller). Değişiklik yok.

- [ ] **Step 2: index.html'i tam kabukla değiştir**

`web/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ask · Agent</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>
  <script src="answer-map.js"></script>
  <script type="text/babel" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Server testinin hâlâ geçtiğini doğrula**

Run: `node --test test/server.test.js`
Expected: PASS (3 test) — GET / artık tam index.html döner, `<div id="root">` regex'i geçer.

- [ ] **Step 4: Commit**

```bash
git add web/styles.css web/index.html
git commit -m "feat: web shell (Geist/AMOLED styles + React CDN host)"
```

---

### Task 6: `web/app.js` — UI portu (canlı veri + submit)

**Files:**
- Create: `web/app.js`

**Yöntem:** `design-reference/project/app.jsx` referans alınır. Görsel bileşenler
(`Check`, `ArrowR`, `Kbd`, `QuestionCard`, `CustomPopup`, `Summary`) **birebir
kopyalanır** — tek farkla: state artık `q.id` yerine `q.question` ile anahtarlanır
(AskUserQuestion sorularında `id` yok). Aşağıdaki yeni/değişen kısımlar tam verilir.
Kaldırılanlar: `TWEAK_DEFAULTS`, `useTweaks`, `Tweaks`, `QUESTIONS` sabiti, `data-panel/align/bg` öznitelikleri ve tweaks importu.

- [ ] **Step 1: app.js'i yaz — üst kısım (helpers + canlı veri hook'u)**

`web/app.js` (dosyanın başı):
```js
/* global React, ReactDOM, AnswerMap */
const { useState, useEffect, useRef, useCallback } = React;

const CUSTOM_LABEL = "Other";
const CUSTOM_DESC = "Let me describe something else.";

/* ── icons (design-reference/project/app.jsx ile birebir) ── */
const Check = ({ c = "currentColor", s = 14 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M3.5 8.5l3 3 6-7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const ArrowR = ({ s = 13 }) => (
  <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Kbd = ({ children }) => <kbd className="kbd">{children}</kbd>;

function fullOptions(q) {
  return [...q.options, { label: CUSTOM_LABEL, description: CUSTOM_DESC, custom: true }];
}

/* ── canlı veri: SSE ile bekleyen soru setini al ── */
function useLiveQuestions() {
  const [questions, setQuestions] = useState(null); // null = bekliyor
  useEffect(() => {
    let es;
    const connect = () => {
      es = new EventSource("/events");
      es.onmessage = (e) => {
        try { setQuestions(JSON.parse(e.data).questions); } catch {}
      };
      es.onerror = () => { es.close(); setTimeout(connect, 1000); };
    };
    connect();
    return () => es && es.close();
  }, []);
  return questions;
}

async function postAnswers(answers) {
  await fetch("/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}
```

- [ ] **Step 2: app.js'e App bileşenini ekle (canlı veri + submit ile)**

`web/app.js` (devam):
```js
function App() {
  const questions = useLiveQuestions();

  if (!questions || questions.length === 0) {
    return (
      <div className="app" data-bg="amoled" style={{ "--accent": "#0070f3", "--motion-ms": "380ms" }}>
        <Waiting />
      </div>
    );
  }
  return <Flow questions={questions} key={questions.map((q) => q.question).join("|")} />;
}

function Waiting() {
  return (
    <main className="inspector">
      <div className="stage">
        <div className="qcard">
          <div className="qcard__chip"><span className="dot" />Agent · clarify</div>
          <h1 className="qcard__q">Waiting for a question…</h1>
          <p className="qcard__meta">Claude Code bir soru sorduğunda burada görünecek. Bu sekmeyi açık bırakın.</p>
        </div>
      </div>
    </main>
  );
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
    const opts = fullOptions(q);
    if (optIdx >= opts.length) return;
    const a = ref.current.answers[q.question];
    const isCustom = !!opts[optIdx].custom;

    if (q.multiSelect) {
      const inSel = a.sel.includes(optIdx);
      if (inSel) {
        if (isCustom) { setPopup({ qid: q.question, optIdx, draft: a.customText }); return; }
        setQ(q.question, { sel: a.sel.filter((i) => i !== optIdx), confirmed: false });
      } else {
        setQ(q.question, { sel: [...a.sel, optIdx], confirmed: false });
        if (isCustom && !a.customText) setPopup({ qid: q.question, optIdx, draft: "" });
      }
      return;
    }

    const armed = a.sel[0] === optIdx;
    if (!armed) { setQ(q.question, { sel: [optIdx], confirmed: false }); return; }
    if (isCustom && !a.customText) { setPopup({ qid: q.question, optIdx, draft: "" }); return; }
    setQ(q.question, { confirmed: true });
    advance(qIndex);
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
    if (!text) return;
    setAnswers((prev) => {
      const a = prev[p.qid];
      const sel = a.sel.includes(p.optIdx) ? a.sel : [...a.sel, p.optIdx];
      return { ...prev, [p.qid]: { ...a, sel, customText: text, confirmed: false } };
    });
    setPopup(null);
  }, []);

  const submit = useCallback(() => {
    const stateForMap = {};
    QUESTIONS.forEach((q) => {
      const a = ref.current.answers[q.question];
      stateForMap[q.question] = { sel: a.sel, customText: a.customText };
    });
    const mapped = AnswerMap.mapAnswers(QUESTIONS, stateForMap);
    setSubmitted(true);
    postAnswers(mapped);
  }, [QUESTIONS]);

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

  const answered = QUESTIONS.filter((q) => answers[q.question].confirmed).length;

  return (
    <div className="app" data-panel="left" data-align="center" data-bg="amoled"
         style={{ "--accent": "#0070f3", "--motion-ms": "380ms" }}>
      <Sidebar QUESTIONS={QUESTIONS} answers={answers} current={current} n={n}
               answered={answered} isSummary={isSummary} submitted={submitted}
               goTo={goTo} />
      <main className="inspector">
        <div className="stage">
          {isSummary ? (
            <Summary answers={answers} QUESTIONS={QUESTIONS}
                     onEdit={(i) => goTo(i, "left")} onBack={goBack}
                     onSubmit={submit} submitted={submitted} />
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
                     inputRef={inputRef} onChange={(v) => setPopup((p) => ({ ...p, draft: v }))}
                     onSave={savePopup} onCancel={() => setPopup(null)} />
      )}
      {submitted && (
        <div className="toast"><span className="ok"><Check c="var(--success)" /></span>
          Answers sent back to the agent.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: app.js'e Sidebar + Hints + görsel bileşenleri ekle**

Sidebar ve Hints, `App` JSX'inden ayrıştırıldı (App küçük kalsın diye). `QuestionCard`,
`CustomPopup`, `Summary` ise referans dosyadan **birebir** alınır, sadece `Summary`
ve `Sidebar` artık `QUESTIONS`'ı prop olarak alır ve state anahtarı `q.question`'dır.

`web/app.js` (devam):
```js
function Sidebar({ QUESTIONS, answers, current, n, answered, isSummary, submitted, goTo }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <div className="brand">
          <span className="brand__mark">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 1.5L18.5 17H1.5L10 1.5z" fill="var(--fg)" />
            </svg>
          </span>
          <span className="brand__name">Agent <span>· clarify</span></span>
        </div>
        <div className="progress__label">
          <span>Questions</span><span><b>{Math.min(answered, n)}</b> / {n}</span>
        </div>
        <div className="progress__track">
          <div className="progress__fill" style={{ width: `${(answered / n) * 100}%` }} />
        </div>
      </div>
      <div className="qlist">
        {QUESTIONS.map((q, i) => {
          const a = answers[q.question];
          const state = a.confirmed ? "done" : (i === current ? "current" : "pending");
          const opts = fullOptions(q);
          const answerText = a.confirmed
            ? a.sel.map((s) => (opts[s].custom ? a.customText : opts[s].label)).join(", ") : "";
          return (
            <button key={q.question} className="qitem" data-active={i === current} data-state={state}
                    onClick={() => goTo(i, i > current ? "right" : "left")}>
              <span className="qitem__idx">{state === "done" ? <Check s={12} /> : i + 1}</span>
              <span className="qitem__body">
                <span className="qitem__header">{q.header}</span>
                <span className="qitem__q">{q.question}</span>
                {a.confirmed && <span className="qitem__answer"><Check s={11} /> {answerText}</span>}
              </span>
            </button>
          );
        })}
        <button className="qitem" data-active={isSummary} data-state={submitted ? "done" : "pending"}
                onClick={() => goTo(n, "right")} style={{ marginTop: 4 }}>
          <span className="qitem__idx">{submitted ? <Check s={12} /> : "✓"}</span>
          <span className="qitem__body">
            <span className="qitem__header">Review</span>
            <span className="qitem__q">Confirm &amp; submit your answers</span>
          </span>
        </button>
      </div>
      <div className="sidebar__foot">
        <div className="legend"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span><span>Move between questions</span></div>
        <div className="legend"><span className="kbd-group"><Kbd>1</Kbd><Kbd>4</Kbd></span><span>Select · press again to confirm</span></div>
      </div>
    </aside>
  );
}

function Hints({ q }) {
  return (
    <footer className="hints">
      <span className="hint">
        <span className="kbd-group"><Kbd>1</Kbd>–<Kbd>{fullOptions(q).length}</Kbd></span> Select
      </span>
      <span className="hint">
        {q.multiSelect
          ? <><Kbd>↵</Kbd> Confirm selection</>
          : <><span style={{ color: "var(--fg-faint)" }}>press key again →</span> Confirm</>}
      </span>
      <span className="hint"><Kbd>↵</Kbd> on “Other” to type</span>
      <span className="hint__spacer" />
      <span className="hint"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span> Navigate</span>
    </footer>
  );
}
```

- [ ] **Step 4: QuestionCard, CustomPopup, Summary'yi referanstan port et**

`QuestionCard` ve `CustomPopup`, `design-reference/project/app.jsx`'teki (satır
376–462) ile **birebir aynıdır** — değişiklik yok, olduğu gibi `web/app.js`'e
yapıştır. `Summary` da aynıdır, **tek fark**: imzası `function Summary({ answers, QUESTIONS, onEdit, onBack, onSubmit, submitted })` olur ve içindeki `QUESTIONS.map`/`QUESTIONS.every` artık prop'tan gelen `QUESTIONS`'ı kullanır, `answers` anahtarı `q.question`'dır. (Referansta `answers[q.id]` olan yerler `answers[q.question]` olur.)

`web/app.js` (devam — Summary'nin portlanmış imzası):
```js
function Summary({ answers, QUESTIONS, onEdit, onBack, onSubmit, submitted }) {
  const allDone = QUESTIONS.every((q) => answers[q.question].confirmed);
  return (
    <div className="summary">
      <div className="summary__chip"><Check c="var(--success)" s={12} /> Ready to send</div>
      <h1 className="summary__title">Review your answers</h1>
      <p className="summary__sub">These get sent back to the agent so it can continue. Edit anything before submitting.</p>
      <div className="summary__list">
        {QUESTIONS.map((q, i) => {
          const a = answers[q.question];
          const opts = fullOptions(q);
          return (
            <div className="srow" key={q.question}>
              <div className="srow__head">{q.header}</div>
              <div className="srow__val">
                <div className="srow__q">{q.question}</div>
                <div className="srow__a">
                  {a.sel.length === 0
                    ? <span className="none">No answer yet</span>
                    : a.sel.map((s) => {
                        const o = opts[s];
                        const val = o.custom ? a.customText : o.label;
                        return <span key={s} className={"tag" + (o.custom ? " tag--custom" : "")}>{val}</span>;
                      })}
                </div>
              </div>
              <button className="srow__edit" onClick={() => onEdit(i)}>Edit</button>
            </div>
          );
        })}
      </div>
      <div className="summary__actions">
        <button className="btn btn--lg btn--ghost" onClick={onBack}>
          <Kbd>B</Kbd> Back{allDone ? "" : " to unanswered"}
        </button>
        <button className="btn btn--lg btn--primary" onClick={onSubmit}>
          {submitted ? "Submitted ✓" : <>Submit answers <Kbd>↵</Kbd></>}
        </button>
      </div>
    </div>
  );
}
```

`QuestionCard` ve `CustomPopup` (referans satır 376–462'den birebir):
```js
function QuestionCard({ q, qIndex, ans, motion, dir, onActivate }) {
  const opts = fullOptions(q);
  return (
    <div className="qcard" data-motion={motion} data-dir={dir}>
      <div className="qcard__chip"><span className="dot" />{q.header}</div>
      <h1 className="qcard__q">{q.question}</h1>
      <p className="qcard__meta">
        {q.multiSelect ? "Select all that apply." : "Select one option."} An “Other” choice is always available.
      </p>
      <div className="options">
        {opts.map((o, i) => {
          const sel = ans.sel.includes(i);
          const confirmed = ans.confirmed && sel;
          const isCustom = !!o.custom;
          const showCustomVal = isCustom && ans.customText;
          return (
            <button key={i} className={"opt" + (isCustom ? " opt--custom" : "")}
                    data-sel={sel} data-confirmed={confirmed} onClick={() => onActivate(qIndex, i)}>
              <span className="opt__key">{i + 1}</span>
              <span className="opt__body">
                <span className="opt__label">
                  {isCustom && showCustomVal
                    ? <>Other <span className="custom-val">— “{ans.customText}”</span></>
                    : o.label}
                </span>
                <span className="opt__desc">
                  {isCustom
                    ? (sel
                        ? <span className="hint-edit">Press <Kbd>{i + 1}</Kbd> or <Kbd>↵</Kbd> to type your own answer.</span>
                        : o.description)
                    : o.description}
                </span>
              </span>
              {q.multiSelect
                ? <span className="opt__box">{sel && <Check c="#fff" s={12} />}</span>
                : <span className="opt__check"><Check c={confirmed ? "var(--success)" : "var(--accent)"} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomPopup({ q, draft, inputRef, onChange, onSave, onCancel }) {
  const autosize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  useEffect(() => { autosize(inputRef.current); }, [draft]);
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
            <button className="btn" onClick={onCancel}>Cancel</button>
            <button className="btn btn--primary" onClick={onSave} disabled={!draft.trim()}>Save answer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
```

- [ ] **Step 5: Manuel duman testi (görsel)**

Run:
```bash
node server/server.js &
SRV=$!
# Sahte bir soru seti gönder (arka planda /ask açık kalır)
curl -s -X POST localhost:4517/ask -H 'Content-Type: application/json' \
  -d '{"questions":[{"question":"Which framework?","header":"Framework","multiSelect":false,"options":[{"label":"Next.js","description":"RSC & SSR"},{"label":"Remix","description":"Nested loaders"}]}]}' &
open http://localhost:4517/
```
Expected: Tarayıcıda AMOLED Geist arayüzü açılır, "Which framework?" sorusu ve şıklar görünür. `1` sonra tekrar `1` (veya `↵`) → onaylar → review ekranı. `↵` → "Answers sent…" toast. Terminalde curl `{"answers":{"Which framework?":"Next.js"}}` döner.
Kapat: `kill $SRV`

- [ ] **Step 6: Commit**

```bash
git add web/app.js
git commit -m "feat: live AskUserQuestion UI (SSE data, keyboard model, submit)"
```

---

### Task 7: `hooks/askuserquestionspro-bridge.mjs` — PreToolUse hook

**Files:**
- Create: `hooks/askuserquestionspro-bridge.mjs`

- [ ] **Step 1: Hook scriptini yaz**

`hooks/askuserquestionspro-bridge.mjs`:
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

function readStdin() {
  return new Promise((resolve) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
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
  child.unref();
  for (let i = 0; i < 30; i++) { if (await isUp()) return true; await delay(100); }
  return false;
}

function openBrowser() {
  spawn("open", [BASE], { stdio: "ignore", detached: true }).unref();
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
    answers = (await r.json()).answers;
  } catch {
    clearTimeout(timer);
    process.exit(0); // timeout/hata → native fallback
  }
  clearTimeout(timer);

  process.stdout.write(JSON.stringify(buildHookOutput(toolInput, answers)));
  process.exit(0);
}

main();
```

- [ ] **Step 2: Hook'u uçtan uca manuel doğrula**

Run:
```bash
# Köprüyü kapat (hook'un kendisi başlatsın)
pkill -f "server/server.js" 2>/dev/null
# AskUserQuestion'ın hook'a yolladığı stdin'i taklit et:
echo '{"tool_name":"AskUserQuestion","tool_input":{"questions":[{"question":"Pick a DB","header":"Database","multiSelect":false,"options":[{"label":"Postgres","description":"Relational"},{"label":"SQLite","description":"Embedded"}]}]}}' | node hooks/askuserquestionspro-bridge.mjs &
```
Expected: Köprü otomatik başlar, tarayıcı `localhost:4517` açılır, "Pick a DB" görünür. Cevapla → terminalde stdout şu şekilde basılır:
`{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{"questions":[...],"answers":{"Pick a DB":"Postgres"}}}}`

- [ ] **Step 3: Commit**

```bash
git add hooks/askuserquestionspro-bridge.mjs
git commit -m "feat: PreToolUse hook (intercept AskUserQuestion -> custom UI)"
```

---

### Task 8: `install.sh` + `README.md` — kurulum

**Files:**
- Create: `install.sh`
- Create: `README.md`

- [ ] **Step 1: install.sh yaz**

`install.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETTINGS="$HOME/.claude/settings.json"
HOOK="$DIR/hooks/askuserquestionspro-bridge.mjs"

mkdir -p "$HOME/.claude"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"

# AskUserQuestion için zaten bir PreToolUse hook var mı uyar (issue #15897).
if grep -q '"AskUserQuestion"' "$SETTINGS" 2>/dev/null; then
  echo "UYARI: settings.json içinde zaten 'AskUserQuestion' geçiyor — tek PreToolUse hook olmalı. Elle kontrol edin."
fi

# jq ile hook'u ekle (jq yoksa elle ekleme talimatı bas).
if command -v jq >/dev/null 2>&1; then
  tmp="$(mktemp)"
  jq --arg cmd "node $HOOK" '
    .hooks //= {} |
    .hooks.PreToolUse //= [] |
    .hooks.PreToolUse += [{ "matcher": "AskUserQuestion",
      "hooks": [{ "type": "command", "command": $cmd, "timeout": 360 }] }]
  ' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
  echo "Hook eklendi → $SETTINGS"
else
  cat <<EOF
jq bulunamadı. $SETTINGS dosyasına elle ekleyin:

  "hooks": {
    "PreToolUse": [
      { "matcher": "AskUserQuestion",
        "hooks": [{ "type": "command", "command": "node $HOOK", "timeout": 360 }] }
    ]
  }
EOF
fi
echo "Bitti. Yeni bir 'claude' oturumu açın; AskUserQuestion artık özel arayüzde açılır."
```

- [ ] **Step 2: install.sh çalıştırılabilir yap + sözdizimi kontrolü**

Run:
```bash
chmod +x install.sh hooks/askuserquestionspro-bridge.mjs
bash -n install.sh && echo "syntax ok"
```
Expected: "syntax ok"

- [ ] **Step 3: README.md yaz**

`README.md`:
```markdown
# askuseroz — AskUserQuestion için özel AMOLED arayüz

Claude Code her `AskUserQuestion` sorduğunda, yerleşik picker yerine bu projedeki
AMOLED Geist tam ekran arayüzü otomatik açılır; cevabınız modele geri döner.

## Kurulum
```bash
./install.sh
```
Yeni bir `claude` oturumu açın. Hepsi bu.

## Nasıl çalışır
- Bir `PreToolUse` hook (`hooks/askuserquestionspro-bridge.mjs`) AskUserQuestion'ı yakalar.
- Yerel köprü (`server/server.js`, port 4517, sıfır bağımlılık) soruları SSE ile
  `web/` arayüzüne push eder.
- Cevap `permissionDecision:"allow"` + `updatedInput` ile modele verilir; native
  picker hiç görünmez.

## Klavye
- `1–4` seç · aynı tuşa tekrar (veya `↵`) onayla · `← →` gezin
- "Other" şıkkında `↵` → uzun cevap için büyüyen yazı alanı (`⇧↵` yeni satır)
- Review: `B` cevaplanmamışa dön · `↵` gönder

## Sorun giderme
- Arayüz açılmıyorsa: `node server/server.js` elle çalıştırıp `localhost:4517`'i açın.
- Native picker çıkıyorsa: köprü kapalı/timeout olmuş demektir (güvenli fallback);
  `curl localhost:4517/health` ile köprüyü kontrol edin.
- AskUserQuestion için **tek** PreToolUse hook olmalı (Claude Code issue #15897).

## Test
```bash
npm test   # node --test (sıfır bağımlılık)
```
```

- [ ] **Step 4: Tüm testleri çalıştır**

Run: `node --test`
Expected: PASS — answer-map (4) + bridge (4) + hook-output (1) + server (3) = 12 test.

- [ ] **Step 5: Commit**

```bash
git add install.sh README.md
git commit -m "docs: install script + README"
```

---

## Self-Review Notları (yazım sonrası kontrol)

- **Spec kapsamı:** 3 bileşen (hook/köprü/UI) → Task 7 / Task 4 / Task 5–6. Cevap-map (spec §4.4) → Task 1. Hook payload (spec §3) → Task 3. Fallback (spec §6) → Task 7 Step 1 (`process.exit(0)` yolları) + README sorun giderme. Otomatik açılma (spec §2) → Task 7 `openBrowser`. SSE transport (spec §4.2) → Task 4 `/events` + Task 6 `useLiveQuestions`.
- **Placeholder taraması:** Yok — tüm kod tam verildi; "birebir kopyala" talimatları in-repo `design-reference` dosyasına işaret eder (gerçek, var olan kaynak).
- **Tip tutarlılığı:** state anahtarı her yerde `q.question`; `mapAnswers(questions, state)` imzası Task 1 ↔ Task 6 `submit` arasında tutarlı; `buildHookOutput(toolInput, answers)` Task 3 ↔ Task 7 tutarlı; `bridge.submitQuestions/getCurrent/provideAnswers/cancel` Task 2 ↔ Task 4 tutarlı.
```
