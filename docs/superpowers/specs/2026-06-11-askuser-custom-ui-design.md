# AskUserQuestion → Özel Arayüz Köprüsü — Tasarım Dokümanı

_Tarih: 2026-06-11_

## 1. Amaç

Claude Code her `AskUserQuestion` tool'unu çağırdığında, soruları yerleşik
terminal/IDE picker'ı yerine **bizim AMOLED Geist tarzı tam ekran web
arayüzümüzde** göstermek; kullanıcı orada cevaplasın ve cevap modele geri
dönsün. Soru geldiğinde arayüz **otomatik açılıp öne gelsin**.

Kullanıcının mevcut **interaktif `claude` CLI akışı değişmemeli** — fazladan
bir program çalıştırması gerekmemeli.

## 2. Onaylanan Kararlar

| Konu | Karar |
|------|-------|
| Yakalama mekanizması | **PreToolUse hook** (`AskUserQuestion` matcher) |
| UI teknolojisi | **Prototipi köprü sunucudan serve et** (React 18 + Babel standalone, CDN; build adımı yok) |
| Otomatik açılma | **Tarayıcıyı aç + öne getir** (`open` + `osascript activate`) |
| İlk teslim | **Bu doküman + uygulama planı** (kod sonra) |

## 3. AskUserQuestion'ın Teknik Çalışması (referans)

- **Girdi:** `{ questions: [ { question, header (≤12 char), options:[{label, description}], multiSelect } ] }` — 1–4 soru, her soruda 2–4 şık.
- Yerleşik UI otomatik olarak bir **"Other"** (serbest metin) şıkkı ekler.
- **Sonuç (model'e dönen):** soruların aynen yankılanması + `answers` nesnesi:
  `{ [soru metni]: "seçilen label" | ["label1","label2"] }`.
- **Yakalama noktası:** Tool çalışmadan önce `PreToolUse` hook tetiklenir.
  Hook çıktısı şu olursa yerleşik picker **hiç gösterilmez** ve model cevabı
  doğrudan alır:

  ```json
  {
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "allow",
      "updatedInput": { "questions": [ ... ], "answers": { ... } }
    }
  }
  ```

  Doğrulandı: resmî hooks dokümanı + GitHub issue #15897. (Tek uyarı: aynı
  matcher için **birden fazla** PreToolUse hook olmamalı — `updatedInput` o
  durumda bozuluyor.)

## 4. Mimari — 3 Bileşen

```
Claude model → AskUserQuestion(questions)
   └─ PreToolUse hook tetiklenir
        ├─ POST localhost:4517/ask  {questions}      (sunucu isteği açık tutar)
        └─ open http://localhost:4517/               (tarayıcı öne gelir)
                                                       │
   Tarayıcı UI ← GET /current (veya SSE /events)  {questions}
   Kullanıcı AMOLED arayüzde cevaplar
   Tarayıcı UI → POST /answer  {answers} ────────────┘  (/ask'i çözer)
        └─ hook {answers} alır
        └─ stdout'a updatedInput{questions, answers} yazar
   → Claude Code yerleşik picker'ı atlar, model answers'ı alır
```

### 4.1 PreToolUse Hook Script (`hooks/askuser-bridge.mjs`)

- `~/.claude/settings.json`'da `PreToolUse` → matcher `AskUserQuestion`.
- stdin'den `{ tool_name, tool_input: { questions }, ... }` okur.
- Köprü ayakta değilse başlatmayı dener (`node server/server.js &`), kısa bekler.
- `POST /ask {questions}` (uzun bekleyen istek — kullanıcı cevaplayana dek açık).
- `open http://localhost:4517/` + `osascript -e 'tell application "..." to activate'`.
- Cevap gelince stdout'a yukarıdaki `updatedInput` JSON'unu yazar, exit 0.
- **Fallback (graceful degradation):** köprü başlatılamazsa veya timeout (örn.
  5 dk) olursa → karar vermeden exit 0 → **yerleşik picker devreye girer.**
  Yani sistem bozulsa bile Claude Code kullanılamaz hale gelmez.

### 4.2 Köprü Sunucu (`server/server.js`)

- Node yerleşik `http` — **sıfır bağımlılık**. Port `4517` (yapılandırılabilir).
- Tek-uçuş (single-flight): aynı anda tek soru seti — AskUserQuestion zaten senkron.
- Endpoint'ler:
  - `GET /` → web UI (`index.html`, `app.js`, `styles.css`).
  - `POST /ask` → hook soruları gönderir; sunucu "bekleyen soru seti" olarak tutar,
    `/answer` gelene dek HTTP yanıtını **açık tutar**, sonra `{answers}` döndürür.
  - `GET /events` (SSE) → bekleyen soru seti anında UI'a **push** edilir (birincil yol).
  - `GET /current` → UI ilk yüklemede bekleyen soruyu çeker (SSE öncesi fallback).
  - `POST /answer` → UI `{answers}` gönderir; bekleyen `/ask`'i çözer.
  - `GET /health` → hook'un "ayakta mı" kontrolü için.

### 4.3 Web Arayüzü (`web/`) — tasarımdan port

- `index.html` — React 18 + Babel standalone (prototiple aynı yaklaşım, build yok).
- `app.js` — `design-reference/project/app.jsx`'ten port:
  - Sabit `QUESTIONS` dizisi **kaldırılır**; sorular `/current`/SSE'den canlı gelir.
  - Tüm klavye etkileşim modeli korunur (1–4 seç/onayla, ← →, Other pop-up + auto-grow textarea, review ekranı B/↵).
  - Gönderince iç state → **AskUserQuestion answers şekline** map'lenir ve `POST /answer`.
  - Gönderim sonrası "agent'a gönderildi" durumu + otomatik kapanma/boşa düşme.
  - **Tweaks paneli ve host-protokol scaffolding'i (`tweaks-panel.jsx`) atılır** —
    bunlar tasarım aracına özgü. Seçilen varsayılanlar sabitlenir
    (sol panel, ortalı, slide, AMOLED, accent `#0070f3`).
- `styles.css` — tasarımdan birebir.

### 4.4 Kritik: Cevap Şekli Map'leme

UI iç state'i `answers[qid] = { sel:number[], confirmed, customText }`.
AskUserQuestion sonucu ise `{ [q.question]: label | [labels] }` ister:
- Normal şık → `option.label`.
- "Other" → `customText` (literal "Other" değil).
- `multiSelect` → label dizisi (ya da `", "` ile birleştirilmiş).
- Prototipteki `answerText` birleştirme mantığı yeniden kullanılır.

## 5. Dosya Yapısı

```
askuseroz/
  server/server.js              # köprü (sıfır bağımlılık)
  web/index.html
  web/app.js                    # app.jsx'ten port, canlı veri
  web/styles.css                # tasarımdan
  hooks/askuser-bridge.mjs      # PreToolUse hook
  install.sh                    # settings.json'ı bağlar, talimat basar
  design-reference/             # orijinal handoff bundle (kaynak referans)
  docs/superpowers/specs/...    # bu doküman
  README.md
```

## 6. Hata Yönetimi ve Uç Durumlar

- **Köprü kapalı** → hook başlatmayı dener; olmazsa native picker'a düşer.
- **Timeout** (örn. 5 dk cevap yok) → native picker'a düşer.
- **Birden çok soru seti** → single-flight; ikincisi sıraya alınır ya da reddedilir (AskUserQuestion senkron olduğu için pratikte oluşmaz).
- **Tek PreToolUse hook** kuralı (issue #15897) — install script başka çakışan hook var mı uyarır.
- **Non-interactive / `-p` modu** → hook yine çalışır; bu bir bonus (headless'ta da özel UI ile cevap).
- **Tarayıcı zaten açık** → `open` aynı URL'de mevcut sekmeyi öne getirir.

## 7. Test Stratejisi

- **Birim:** cevap-map'leme fonksiyonu (iç state → AskUserQuestion `answers`) — single / multi / Other / boş senaryoları.
- **Entegrasyon:** sahte hook stdin → sunucu → sahte UI `POST /answer` → stdout JSON şekli doğrulanır.
- **Manuel:** Claude Code'da gerçek bir AskUserQuestion tetikle; tarayıcının açıldığını, cevabın modele döndüğünü, native picker'ın görünmediğini doğrula.

## 8. Kapsam Dışı (YAGNI)

- Tweaks paneli / canlı tema değiştirme (v1'de sabit varsayılanlar).
- Çoklu eşzamanlı oturum / çok kullanıcılı köprü.
- Uzaktan erişim / auth (yalnızca `localhost`).
- launchd ile kalıcı servis (v1'de hook on-demand başlatır; istenirse v2).

## 9. Açık Sorular / Riskler

- `open` ile sekme yeniden kullanımı tarayıcıya göre değişebilir; gerekirse
  belirli bir tarayıcı (`open -a`) + `osascript activate` ile sıkılaştırılır.
- Hook'un köprüyü `&` ile başlatması bazı kabuk/ortamlarda zombi süreç
  bırakabilir; install script'te basit bir PID/health kontrolü ile yönetilir.
