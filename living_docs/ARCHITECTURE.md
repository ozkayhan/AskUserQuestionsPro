# askuseroz — Mimari & Teknik Doküman

Bu doküman projenin **nasıl** çalıştığını uçtan uca, bol diyagramla anlatır.
"Ne işe yarar / neden var" için → [`PURPOSE.md`](./PURPOSE.md). "Hangi dosya
nerede" için → [`../CODEMAP.md`](../CODEMAP.md).

---

## 0. Üç süreç, üç sorumluluk

Sistem üç ayrı çalışma birimi üzerine kuruludur. Hepsi `127.0.0.1`'de yaşar.

```
   ┌──────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
   │   1) HOOK         │      │   2) SERVER (köprü)   │      │   3) WEB (UI)     │
   │   kısa ömürlü     │      │   uzun ömürlü daemon  │      │   tarayıcı sekmesi│
   │   askuser-        │ HTTP │   server.js + bridge  │ HTTP │   index.html +    │
   │   bridge.mjs      │◄────►│   port 4517           │◄────►│   React app       │
   │                   │      │                       │ SSE  │                   │
   │  Claude Code      │      │  RAM'de tek soru seti │      │  kullanıcı seçer  │
   │  her soru için    │      │  ↔ cevap randevusu    │      │                   │
   │  bir kez başlatır │      │                       │      │                   │
   └──────────────────┘      └──────────────────────┘      └──────────────────┘
        stdin/stdout              HTTP + SSE state              fetch + EventSource
```

| Süreç | Dosya(lar) | Ömür | Görevi |
|-------|-----------|------|--------|
| **Hook** | `hooks/askuser-bridge.mjs`, `hooks/hook-output.js` | Soru başına saniyeler | Claude Code ↔ köprü arası elçi. Soruyu köprüye verir, cevabı stdout'tan Claude'a basar. |
| **Server** | `server/server.js`, `server/bridge.js` | İlk soruda doğar, açık kalır | HTTP köprüsü + statik UI servisi. Soru/cevap randevusunu RAM'de tutar. |
| **Web** | `web/*` | Tarayıcı sekmesi açık olduğu sürece | Soruyu SSE ile alır, kullanıcı etkileşimini yönetir, cevabı POST eder. |

---

## 1. Ana akış — uçtan uca sekans (mutlu yol)

```
 Claude Code        Hook (mjs)         Server (4517)        Bridge        Tarayıcı (UI)
     │                  │                    │                 │                │
     │ AskUserQuestion  │                    │                 │                │
     │ PreToolUse ─────►│                    │                 │                │
     │ (stdin: JSON)    │                    │                 │                │
     │                  │ isUp()? /health ──►│                 │                │
     │                  │◄─── 200 ───────────│                 │                │
     │                  │ (kapalıysa spawn → server.js daemon) │                │
     │                  │                    │                 │                │
     │                  │ POST /ask {questions} ─────────────► submitQuestions  │
     │                  │                    │                 │ _pending = {…} │
     │                  │ open(127.0.0.1:4517) ──────────────────────────────► (sekme açılır)
     │                  │                    │ broadcastCurrent│                │
     │                  │                    │ ── SSE: questions ──────────────►│
     │                  │   (askPromise asılı bekler)          │      render eder│
     │                  │                    │                 │   kullanıcı seçer│
     │                  │                    │ POST /answer {answers} ◄──────────│
     │                  │                    │ provideAnswers ►│ resolve(answers)│
     │                  │◄── 200 {answers} ──│ (askPromise dolar)               │
     │                  │ buildHookOutput()  │                 │   "Submitted ✓" │
     │◄── stdout: ──────│                    │                 │                │
     │   permissionDecision:"allow"          │                 │                │
     │   updatedInput:{questions,answers}    │                 │                │
     │                  │                    │                 │                │
     │ (native picker ATLANIR; cevap modele) │                 │                │
     ▼                  ▼                    ▼                 ▼                ▼
```

**Kilit nokta:** Hook'un `POST /ask` isteği, kullanıcı cevap verene kadar
**açık tutulan** bir HTTP isteğidir (long-poll). Server bu isteği
`bridge.submitQuestions()`'ın döndürdüğü promise dolana dek yanıtlamaz. Cevap
`/answer`'dan gelince promise resolve olur, `/ask` 200 döner, hook stdout'a
yazıp çıkar.

---

## 2. Bridge — tek-uçuş randevu (state machine)

`server/bridge.js` tüm sistemin kalbidir: **40 satırlık** bir durum makinesi.
Aynı anda yalnızca **bir** `_pending` randevu tutar.

```
   durum: _pending = null  (boşta)
        │
        │ submitQuestions(questions)          ┌─────────────────────────────┐
        ├────────────────────────────────────► _pending = {questions,        │
        │  (ikinci submit gelirse → reject     │             resolve, reject} │
        │   "already pending")                 └─────────────────────────────┘
        │                                              │        │        │
        │                              provideAnswers  │        │  cancel │
        │                              (UI cevap verdi)│        │ (timeout│
        │                                              │        │  / kopuş)│
        ▼                                              ▼        ▼        ▼
   ┌─────────┐                                    resolve   getCurrent  reject
   │ boşta   │◄───────────────────────────────────(answers) (peek)    (error)
   └─────────┘   her iki uçta da _pending = null tekrar boşta
```

| Metot | Çağıran | Etki |
|-------|---------|------|
| `submitQuestions(qs)` | server `/ask` | `_pending` yoksa kaydeder, cevap promise'i döner. Varsa reject. |
| `getCurrent()` | server `/current`, `/events` | Bekleyen soruları döner (yoksa `null`). Yan etkisiz peek. |
| `provideAnswers(a)` | server `/answer` | `_pending`'i resolve eder, boşaltır. |
| `cancel(reason)` | server (istemci kopuşu) | `_pending`'i reject eder, boşaltır. |

**Neden tek-uçuş?** `AskUserQuestion` için Claude Code'da tek bir `PreToolUse`
hook olmalı (issue #15897); ve UI tek soru setini gösterecek şekilde tasarlı.
İkinci eşzamanlı set gelirse 409 → o set güvenle native picker'a düşer.

---

## 3. HTTP + SSE arayüzü (`server/server.js`)

Saf Node `http` — framework yok. ~115 satır. Tüm uçlar:

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │ GET  /health            → {ok:true}            (hook ayakta mı bakar) │
   │ GET  /current           → {questions|null}     (anlık peek)           │
   │ GET  /events            → text/event-stream     (SSE: canlı push)     │
   │ POST /ask    {questions}→ 200 {answers} | 409   (HOOK long-poll)      │
   │ POST /answer {answers}  → 200 {ok}     | 409    (UI cevabı verir)     │
   │ GET  /*                 → web/ statik dosyalar  (index, js, css)      │
   └─────────────────────────────────────────────────────────────────────┘
```

### SSE yayını (`broadcastCurrent`)
Bağlı tüm tarayıcı sekmeleri `sseClients` Set'inde tutulur. `/ask` (yeni soru)
ve `/answer` (soru çözüldü → null) sonrası tüm sekmelere anlık durum push'lanır:

```
   bridge durumu değişti
        │
        ▼
   broadcastCurrent()  ──"data: {questions}\n\n"──►  sseClient #1  (EventSource)
        │                                       └──►  sseClient #2
        └───────────────────────────────────────►  sseClient #N
```

### Önemli sağlamlık ayrıntıları (kod yorumlarında da işaretli)
- **Boyut koruması:** `readBody` 1 MB'ı aşan gövdede `req.destroy()` eder.
- **Asılı kalmayı önleme:** `req.destroy()` yalnızca `'close'` yayar; promise
  `'close'` dinleyicisiyle reject edilir (`server.js:25`).
- **İstemci kopuşu = iptal:** `/ask` long-poll'ünde tarayıcı/hook giderse
  `res 'close'` ile `bridge.cancel()` çağrılır; aksi halde sonraki sorular
  ebediyen kilitlenirdi (`server.js:77-79`).
- **Path traversal:** Statik servis `file.startsWith(WEB_DIR)` ile sınırlanır.

---

## 4. Hook — Claude Code ile sözleşme (`hooks/`)

### 4a. `askuser-bridge.mjs` (yürütülebilir hook)
`PreToolUse` olayında Claude Code bu scripti çalıştırır; stdin'e tool çağrı
JSON'unu verir, stdout'tan karar bekler.

```
   stdin (JSON) ──► readStdin ──► parse
        │
        ├── parse hatası ............................► exit(0)  [native]
        ├── tool_input.questions yok ...............► exit(0)  [native]
        │
        ▼
   ensureServer()  ── isUp? ── hayır ──► spawn(server.js, detached) ──► 30×100ms poll
        │                                                                  │
        └── ayağa kalkmadı ........................................► exit(0)  [native]
        │
        ▼
   POST /ask {questions}   +   openBrowser()   +   5dk timeout (AbortController)
        │
        ├── r.ok değil (409/4xx/5xx) / timeout / hata ............► exit(0)  [native]
        ├── answers == null .......................................► exit(0)  [native]
        │
        ▼
   stdout: JSON.stringify(buildHookOutput(toolInput, answers))  ──► exit(0)
```

**Her sapma `exit(0)` ile native picker'a düşer** — PURPOSE.md "Kural 1".
Boş stdout + exit 0 = "hook bir şey demedi" = Claude normal davranır.

### 4b. `hook-output.js` (saf payload üreticisi)
Tek bir saf fonksiyon, `buildHookOutput(toolInput, answers)`. Test edilebilir
olsun diye I/O'dan ayrılmıştır. Ürettiği yapı Claude Code'un native picker'ı
atlamasını sağlayan sözleşmedir:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Answered via custom AskUserQuestion UI",
    "updatedInput": { "questions": [...], "answers": { ... } }
  }
}
```

`permissionDecision:"allow"` + cevapları içeren `updatedInput` → Claude aracı
"zaten cevaplanmış" kabul eder, picker'ı göstermez, cevabı doğrudan kullanır.

---

## 5. Web arayüzü — katmanlı modüller (`web/`)

Tarayıcı tarafı **build'siz**: React + ReactDOM + Babel CDN'den yüklenir, JSX
runtime'da derlenir. Mantık **4 katmana** ayrılmıştır; `index.html` script'leri
**bağımlılık sırasına göre** yükler (üstteki alttakine bağlı değil):

```
   index.html yükleme sırası          sorumluluk                     bağımlılık
   ─────────────────────────────────────────────────────────────────────────────
   1) react / react-dom / babel  (CDN)  runtime                        —
   2) answer-map.js   (UMD, saf)        UI state ⇄ answers eşlemesi    —  (saf, test'li)
   3) ui-kit.js       (JSX)             ikonlar, sabitler, fullOptions  React
   4) live.js         (JSX)             SSE alımı + cevap POST'u        React
   5) views.js        (JSX)             saf sunum bileşenleri           React, ui-kit
   6) app.js          (JSX)             durum makinesi + mount          hepsi
```

> **Neden tek dosya değil?** Eski `web/app.js` 428 satır tek parçaydı. Aynı kod
> 4 katmana bölündü; her dosya tek bir işi yapıyor. Klasik script'ler global
> lexical scope'u paylaştığından (`const Check` her yerde görünür) build adımı
> gerekmez. Hook isim çakışmasını önlemek için `live.js` ve `views.js`
> React hook'larını alias'lar (`useStateLive`, `useEffectView`).

### Bileşen ağacı (runtime)

```
   <App>                         ← live.js: useLiveQuestions() (SSE)
     │
     ├─ questions yok ─► <Waiting/>                  (views.js)
     │
     └─ <Flow questions>         ← app.js: TÜM durum burada
          ├─ <Sidebar/>          ← ilerleme, soru listesi, cevap özetleri
          ├─ <main>
          │    ├─ <Summary/>     ← isSummary ise: review & submit
          │    └─ <QuestionCard/>← değilse: aktif soru + şıklar
          │    └─ <Hints/>       ← klavye ipuçları
          └─ <CustomPopup/>      ← "Other" seçilince büyüyen textarea
```

### Durum modeli (`Flow` içinde)
```
   answers[question] = { sel: number[],   // seçili şık indeksleri ([...options, Other])
                         confirmed: bool, // bu soru onaylandı mı
                         customText: str }// "Other" metni
   current  : number   // aktif soru indeksi (>= n ise Summary)
   popup    : {qid, optIdx, draft} | null
   submitted: bool
```

---

## 6. `answer-map.js` — saf karar mantığı (kalbin beyni)

UI'ın iki en kritik kararı **saf fonksiyonlar** olarak buraya çekilmiştir; React'ten
ve DOM'dan bağımsız, baştan sona unit-test'li (bkz. `test/answer-map.test.js`).

### `decideActivate(q, a, optIdx)` — bir şıka basılınca ne olur?
```
                       ┌─ multiSelect? ──────────────────────────────────┐
   şık tıklandı        │                                                  │
        │         EVET │                              HAYIR (single)      │
        ▼              ▼                                    ▼
   geçerli indeks?  zaten seçili mi?                  bu şık "armed" mi?
   hayır→{noop}      ├ evet+custom → {popup}           ├ hayır → {select}
                     ├ evet        → {toggle çıkar}     └ evet:
                     ├ yeni custom+metin yok → {popup}        ├ custom → {popup}
                     └ yeni        → {toggle ekle}            └ normal → {confirm}
```
"armed" = single-select'te bir şık seçili ama henüz onaylanmamış. Aynı tuşa
ikinci basış onaylar (normal) ya da "Other" düzenleyicisini açar (custom).

### `mapAnswers(questions, state)` — UI state → Claude'un beklediği şekil
```
   her soru için:
     sel boş?            → atla (cevaplanmamış)
     sel → label'lara çevir (Other → customText, diğerleri → o.label)
     multiSelect?        → answers[q] = [label, ...]
     değilse             → answers[q] = label
   sonuç: { [question]: label | [labels] }   ← AskUserQuestion 'answers' sözleşmesi
```

---

## 7. Hata modları → hepsi güvenli fallback

```
   Olay                              Sonuç
   ─────────────────────────────────────────────────────────────────
   Köprü kapalı, spawn başarısız  →  hook exit(0)         → native picker
   /ask 409 (zaten pending)       →  hook exit(0)         → native picker
   5 dk timeout (AbortController) →  hook exit(0)         → native picker
   Bozuk stdin JSON               →  hook exit(0)         → native picker
   Tarayıcı sekmesi kapandı       →  res 'close' → cancel → /ask 409 → native
   SSE bağlantısı koptu           →  UI 1 sn'de reconnect (app/live.js)
```

**Değişmez (invariant):** askuseroz hiçbir koşulda Claude Code'u kilitlemez.
En kötü durumda "yokmuş gibi" davranır ve yerleşik picker devreye girer.

---

## 8. Kurulum mekaniği (`install.sh`)

```
   ./install.sh
        │
        ├─ ~/.claude/settings.json yoksa {} oluştur
        ├─ "AskUserQuestion" zaten geçiyorsa UYAR (tek hook olmalı, #15897)
        └─ jq ile PreToolUse'a hook satırı ekle:
             { matcher:"AskUserQuestion",
               hooks:[{ type:"command", command:"node …/askuser-bridge.mjs", timeout:360 }] }
           (jq yoksa elle ekleme talimatını basar)
```

Sonra yeni bir `claude` oturumu: artık her `AskUserQuestion` özel arayüzde açılır.

---

## 9. Test stratejisi (`test/`, `node --test`, sıfır bağımlılık)

| Test dosyası | Neyi doğrular |
|--------------|---------------|
| `bridge.test.js` | Randevu state machine: resolve / çift-submit reddi / cancel |
| `server.test.js` | HTTP uçları: `/health`, `/ask`↔`/answer` round-trip, statik servis |
| `hook-output.test.js` | `buildHookOutput` sözleşmesi (allow + updatedInput) |
| `answer-map.test.js` | `mapAnswers` + `decideActivate` saf mantığı (regresyon dahil) |

UI render'ı testlere dahil değildir (build'siz/tarayıcı bağımlı); ama tüm
**karar mantığı** (`answer-map.js`) ve **köprü** saf/test edilebilir tutulmuştur.
Render doğrulaması manuel/headless yapılır.
