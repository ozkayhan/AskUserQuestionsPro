# askuseroz — Mimari & Teknik Doküman

Bu doküman projenin **nasıl** çalıştığını uçtan uca, bol diyagramla anlatır.
"Ne işe yarar / neden var" için → [`PURPOSE.md`](./PURPOSE.md). "Hangi dosya
nerede" için → [`../CODEMAP.md`](../CODEMAP.md).

---

## 0. Dört katılımcı, dört sorumluluk

Sistem dört ayrı çalışma birimi üzerine kuruludur. Hepsi `127.0.0.1`'de yaşar.

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

   ┌──────────────────┐      ┌──────────────────────┐
   │   4) MCP SERVER   │      │   lib/bridge-client   │
   │   askui-mcp.mjs   │      │   (paylaşılan ESM     │
   │   stdio JSON-RPC  │◄────►│    modülü)            │
   │   mcp__askui__ask │ HTTP │   ensureServer()      │
   │   (≤sınırsız soru)│      │   openBrowser()       │
   │                   │      │   askBridge()         │
   └──────────────────┘      └──────────────────────┘
     Claude Code MCP              hook + MCP tarafından
     katmanı üzerinden            ortak olarak kullanılır
```

| Süreç | Dosya(lar) | Ömür | Görevi |
|-------|-----------|------|--------|
| **Hook** | `hooks/askuser-bridge.mjs`, `hooks/hook-output.js` | Soru başına saniyeler | Claude Code ↔ köprü arası elçi. ≤4 soruluk `AskUserQuestion` çağrılarını yakalar; soruyu köprüye verir, cevabı stdout'tan `updatedInput` ile Claude'a basar. |
| **Server** | `server/server.js`, `server/bridge.js` | İlk soruda doğar, açık kalır | HTTP köprüsü + statik UI servisi. Soru/cevap randevusunu RAM'de tutar. |
| **Web** | `web/*` | Tarayıcı sekmesi açık olduğu sürece | Soruyu SSE ile alır, kullanıcı etkileşimini yönetir, cevabı POST eder. |
| **MCP Server** | `mcp-server/askui-mcp.mjs` | Claude Code MCP istemcisi tarafından yönetilir | `mcp__askui__ask` aracını sunar — sınırsız soruluk `questions` dizisi alır, cevapları doğrudan tool-result olarak modele döndürür. |
| **Bridge İstemci** | `lib/bridge-client.mjs` | — (kütüphane modülü) | `ensureServer()`, `openBrowser()`, `askBridge()` fonksiyonlarını export eder. Hem hook hem MCP server bu modülü kullanır (DRY). |

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

## 1b. MCP akışı — `mcp__askui__ask` (sınırsız soru, mutlu yol)

```
 Claude Code        MCP Server           lib/bridge-client    Server (4517)   Tarayıcı (UI)
     │              (askui-mcp.mjs)             │                   │               │
     │ mcp__askui__ask                          │                   │               │
     │ {questions:[...N...]} ─────────────────► │                   │               │
     │                                          │ ensureServer() ──►│               │
     │                                          │◄── 200 ───────────│               │
     │                                          │ openBrowser() ───────────────────►(sekme açılır)
     │                                          │ POST /ask {questions} ──────────► submitQuestions
     │                                          │                   │ broadcastCurrent               │
     │                                          │                   │── SSE: questions ─────────────►│
     │                                          │   (askBridge bloklar)             │  render, kullanıcı seçer
     │                                          │                   │ POST /answer ◄─────────────────│
     │                                          │◄── 200 {answers} ─│ (askPromise dolar)             │
     │◄── tool_result {answers:{...}} ──────────│                   │                               │
     │   (model cevabı text olarak okur)        │                   │               │               │
     ▼                                          ▼                   ▼               ▼               ▼
```

**Hook'tan farkı:** Hook `updatedInput` ile cevabı modele enjekte eder (model
"soruyu sordu, cevabı aldı" görür — picker atlanır). MCP tool ise cevabı normal
**tool-result text** olarak döndürür; model onu açıkça okur. Her iki yol da aynı
`server/bridge.js` üzerinden geçer.

---

## 1c. Hibrit yönlendirme (kitapçık çözüm #7)

`AskUserQuestion` 1–4 soruluk sabit bir model sözleşmesiyle gelir. `mcp__askui__ask`
şemasında `maxItems` yoktur — gerçek anlamda sınırsız. Hibrit model bu ikisini
şeffaf biçimde birleştirir:

```
                    Model soru soracak
                          │
              ┌───────────┴────────────┐
         ≤4 soru?                   >4 soru?
              │                         │
   AskUserQuestion (native)      mcp__askui__ask
              │                         │
        PreToolUse hook            MCP server
        (hooks/askuser-bridge.mjs) (mcp-server/askui-mcp.mjs)
              └──────────┬──────────────┘
                         │   ikisi de lib/bridge-client.mjs kullanır
                         ▼
              Aynı Server(4517) + Bridge + Web UI
```

Model hangi aracı kullanacağını `mcp__askui__ask`'ın araç açıklamasındaki
yönlendirmeye göre seçer: küçük setlerde `AskUserQuestion` doğaldır; büyük
setlerde açıklama modeli `mcp__askui__ask`'a yönlendirir.

**Geriye dönük uyum:** ≤4 soruluk tüm mevcut davranış **değişmeden** korunur.

---

## 1d. `lib/bridge-client.mjs` — paylaşılan ESM modülü

Hook ve MCP server aynı sunucuyu başlatma ve aynı `/ask` long-poll mantığını
paylaştığından bu kod `lib/bridge-client.mjs`'e çıkarılmıştır (DRY).

| Export | Tanım |
|--------|-------|
| `ensureServer()` | Sunucu çalışmıyorsa `server.js`'i spawn eder, 30×100 ms poll ile bekler. |
| `openBrowser()` | `open http://127.0.0.1:PORT` ile tarayıcıyı açar (macOS). |
| `askBridge(questions, {timeoutMs})` | `POST /ask` long-poll'ü gerçekleştirir; `{answers}` ile resolve olur. |

Hook (`hooks/askuser-bridge.mjs`) bu modülü import ederek kullanır; gözlemlenebilir
davranışı değişmemiştir. MCP server da aynı modülü kullanır.

---

## 1e. `ASKUI_FORCE_MCP` — opsiyonel yönlendirme katmanı (kitapçık #8)

Varsayılan olarak **kapalı**. Bu ortam değişkeni truthy değer taşıdığında PreToolUse
hook, `AskUserQuestion` çağrısını `permissionDecision:"deny"` ile reddeder ve modele
`mcp__askui__ask` kullanması için bir mesaj döndürür. Modeli kesinlikle MCP aracına
yönlendirmek isteyenler için opsiyonel bir "yapıştırıcı" katmanıdır.

```
   ASKUI_FORCE_MCP unset (varsayılan)   →  hook normal çalışır (≤4 native akış)
   ASKUI_FORCE_MCP=1                    →  hook deny döner, modeli MCP'ye yönlendirir
```

**"Kural 1" korunur:** Opt-in tasarımı sayesinde varsayılan davranış değişmez —
hiçbir kullanıcı farkında olmadan kilitlenmez.

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
| `getCurrent()` | (içsel) | Bekleyen soruları döner (yoksa `null`). Yan etkisiz peek. |
| `peek()` | server `/current`, `/events` | Bekleyen turu `{id, questions}` olarak döner (yoksa `null`). Her tur monoton artan `id` taşır → UI tur başına remount kararı verir (B10). |
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
   │ GET  /current           → {id, questions}|null (anlık peek)           │
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
- **Boyut koruması:** `readBody` **8 MB**'ı aşan gövdede `req.destroy()` eder. (Büyük soru setlerini (`mcp__askui__ask`) karşılamak için 1 MB → 8 MB artırıldı.)
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
JSON'unu verir, stdout'tan karar bekler. `ensureServer()`, `openBrowser()`,
`askBridge()` fonksiyonlarını artık `lib/bridge-client.mjs`'den import eder.

```
   stdin (JSON) ──► readStdin ──► parse
        │
        ├── parse hatası ............................► exit(0)  [native]
        ├── tool_input.questions yok ...............► exit(0)  [native]
        ├── ASKUI_FORCE_MCP truthy .................► exit(0) + deny mesajı → MCP'ye yönlendir
        │
        ▼
   lib/bridge-client: ensureServer()
        │  ── isUp? ── hayır ──► spawn(server.js, detached) ──► 30×100ms poll
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

### 4c. `mcp-server/askui-mcp.mjs` (MCP sunucusu)

Sıfır-bağımlılık, yalnızca Node çekirdeği. `stdio` üzerinden JSON-RPC 2.0 MCP
protokolünü konuşur. Tek bir araç sunar:

```
   araç adı    : ask   (Claude Code'un bunu mcp__askui__ask olarak görür)
   inputSchema : { questions: [ {question, header?, multiSelect?, options?:[{label,description?}]} ] }
                 — maxItems kısıtı YOK (gerçek anlamda sınırsız)
```

MCP sunucu başlatma akışı:

```
   Claude Code  ──initialize──►  askui-mcp.mjs
                ◄──capabilities─
                ──tools/list──►
                ◄──[{name:"ask",...}]─
                ──tools/call {name:"ask", arguments:{questions:[...]}}──►
                                      │
                              lib/bridge-client:
                              ensureServer() + openBrowser() + askBridge()
                                      │   (long-poll, kullanıcı cevap verene kadar bloklar)
                                      │
                ◄──tool_result {content:[{type:"text",text:'{"answers":{...}}'}]}─
```

**Timeout:** Claude Code'un MCP araç timeout'u (`MCP_TOOL_TIMEOUT`) varsayılan
olarak yaklaşık 28 saat — uzun yanıt oturumları için fazlasıyla yeterli. `.mcp.json`
proje kaydı ek güvence için `timeout: 3600000` (1 saat) taşır.

**Hata → fallback:** Bridge kapalıysa, 409 (zaten pending) dönerse veya başka
bir hata oluşursa MCP server `isError: true` tool-result döndürür ve modeli
native `AskUserQuestion` aracına düşmesi için yönlendirir → Kural 1 korunur.

---

## 5. Web arayüzü — katmanlı modüller (`web/`)

Tarayıcı tarafı **build'siz**: React + ReactDOM + Babel **yerel `web/vendor/`**
dizininden yüklenir (CDN değil → tamamen offline çalışır), JSX runtime'da
derlenir. Mantık **4 katmana** ayrılmıştır; `index.html` script'leri
**bağımlılık sırasına göre** yükler (üstteki alttakine bağlı değil):

```
   index.html yükleme sırası            sorumluluk                     bağımlılık
   ─────────────────────────────────────────────────────────────────────────────
   1) vendor/react / react-dom / babel  runtime (yerel, offline)       —
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

### 5a. Büyük soru seti için UI ölçekleme (N > 8)

Soru sayısı 8'i aştığında (genellikle `mcp__askui__ask` yoluyla gelen büyük
setler) UI otomatik olarak ek özellikler sunar. **8 veya daha az soruda görsel
herhangi bir fark yoktur.**

| Özellik | Tetikleyici | Davranış |
|---------|-------------|----------|
| **Accordion grupları** | N > 8 | Kenar çubuğu soruları `header` alanına göre katlanabilir bölümlere ayırır. Her bölüm "cevaplanan/toplam" sayacı gösterir. |
| **Arama/filtre kutusu** | N > 8 | Soru metni üzerinde anlık metin filtresi + "Yalnızca cevaplanmamışları göster" toggle'ı. |
| **Sonraki cevaplanmamışa atla** | N > 8 | `u` klavye kısayolu (ve sidebar düğmesi) ile bir sonraki cevaplanmamış soruya anında geçiş. |
| **"Kalanları atla & gözden geçir"** | N > 8 | Tüm soruları tek tek geçmeden doğrudan Review ekranına giden toplu düğme. |

Yeni bağımlılık yok, yeni CSS `:root` token'ı yok, build adımı yok.

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
   Hook: köprü kapalı, spawn başarısız  →  hook exit(0)        → native picker
   Hook: /ask 409 (zaten pending)       →  hook exit(0)        → native picker
   Hook: 5 dk timeout (AbortController) →  hook exit(0)        → native picker
   Hook: Bozuk stdin JSON               →  hook exit(0)        → native picker
   MCP: köprü kapalı / spawn başarısız  →  isError tool-result → model native'e düşer
   MCP: /ask 409 (zaten pending)        →  isError tool-result → model native'e düşer
   MCP: bridge timeout                  →  isError tool-result → model native'e düşer
   Tarayıcı sekmesi kapandı        →  res 'close' → cancel → /ask 409 → native
   SSE bağlantısı koptu            →  UI 1 sn'de reconnect (app/live.js)
```

**Değişmez (invariant):** askuseroz hiçbir koşulda Claude Code'u kilitlemez.
En kötü durumda "yokmuş gibi" davranır ve yerleşik picker devreye girer. Bu
değişmez hem hook hem MCP yolu için geçerlidir.

---

## 8. Kurulum mekaniği (`install.sh`)

```
   ./install.sh
        │
        ├─ ~/.claude/settings.json yoksa {} oluştur
        ├─ "AskUserQuestion" zaten geçiyorsa UYAR (tek hook olmalı, #15897)
        ├─ jq ile PreToolUse'a hook satırı ekle:
        │    { matcher:"AskUserQuestion",
        │      hooks:[{ type:"command", command:"node …/askuser-bridge.mjs", timeout:360 }] }
        │  (jq yoksa elle ekleme talimatını basar)
        ├─ server/, lib/, mcp-server/ dizinlerini install dizinine kopyala
        │  (önceden yalnızca hooks/ + web/ kopyalanıyordu — eksiklik giderildi)
        └─ claude CLI varsa:
             claude mcp add --scope user askui -- node <path/to/askui-mcp.mjs>
           yoksa elle ekleme komutunu basar
```

Repo kökündeki `.mcp.json` bu projeye özgü MCP kaydını sağlar (geliştirme
ortamı için):

```json
{ "mcpServers": { "askui": { "command": "node", "args": ["mcp-server/askui-mcp.mjs"],
                              "timeout": 3600000 } } }
```

Sonra yeni bir `claude` oturumu: artık her `AskUserQuestion` özel arayüzde açılır
ve `mcp__askui__ask` büyük soru setleri için kullanılabilir olur.

---

## 9. Test stratejisi (`test/`, `node --test`, sıfır bağımlılık)

| Test dosyası | Neyi doğrular |
|--------------|---------------|
| `bridge.test.js` | Randevu state machine: resolve / çift-submit reddi / cancel |
| `server.test.js` | HTTP uçları: `/health`, `/ask`↔`/answer` round-trip, statik servis |
| `hook-output.test.js` | `buildHookOutput` sözleşmesi (allow + updatedInput) |
| `answer-map.test.js` | `mapAnswers` + `decideActivate` + `savePopupState` saf mantığı (regresyon dahil) |
| `themes.test.js` | Tema registry sözleşmesi + **styles.css `:root` ↔ KNOWN_TOKENS birebir eşleşmesi** (`fs` ile `:root` parse edilir; fazla/eksik token CI'da yakalanır — B18) |
| `mcp-server.test.js` | JSON-RPC `initialize` + `tools/list` el sıkışması; araç şemasının `maxItems` **içermediğini** doğrular (sınırsızlık sözleşmesi) |
| `bridge-client.test.js` | `ensureServer()` + `askBridge()` round-trip — gerçek sunucuya karşı entegrasyon testi |

UI render'ı testlere dahil değildir (build'siz/tarayıcı bağımlı); ama tüm
**karar mantığı** (`answer-map.js`), **köprü**, **MCP sunucusu** ve **tema/token sözleşmesi**
saf/test edilebilir tutulmuştur. Render doğrulaması manuel/headless yapılır.
Toplam **47 test** geçer (`npm test`).
