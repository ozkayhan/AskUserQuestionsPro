# CODEMAP — askuseroz

> **Yeni gelen coding agent: önce burayı oku.** Tüm projeyi taramana gerek yok;
> bu harita "neyi nerede bulurum" + "X'i değiştirmek için hangi dosya" sorularını
> cevaplar. Derin teknik için → [`living_docs/ARCHITECTURE.md`](living_docs/ARCHITECTURE.md),
> amaç için → [`living_docs/PURPOSE.md`](living_docs/PURPOSE.md).

**Ne yapar (tek cümle):** Claude Code'un `AskUserQuestion` picker'ını yerel,
sıfır-bağımlılık bir web arayüzüyle değiştirir; `mcp__askuserquestionspro__ask` MCP aracıyla
sınırsız soru desteği ekler. Dört parça: **hook** (≤4 soruluk native çağrılar
için) → **MCP server** (sınırsız soru için) → **server** (köprü, RAM'de
soru/cevap tutar) → **web** (UI). Hook ve MCP server **lib/bridge-client.mjs**'i
ortak kullanır.

---

## Klasör ağacı (her satırın ne olduğu)

```
askuseroz/
├── CODEMAP.md                ◄── BURADASIN. Giriş haritası.
├── README.md                 Kurulum, klavye, sorun giderme (kullanıcıya dönük).
├── LICENSE                    MIT lisansı.
├── install.sh                Hook + MCP sunucusu kurulumu (jq + claude CLI).
├── package.json              Sıfır bağımlılık. scripts: test (node --test), serve.
├── .mcp.json                 Proje-kapsamlı MCP kaydı (askuserquestionspro → askuserquestionspro-mcp.mjs, timeout:3600000).
│
├── .github/
│   └── workflows/
│       └── ci.yml            GitHub Actions: push/PR'de `npm test` (node --test).
│
├── living_docs/              ◄── KAVRAMSAL DOKÜMANTASYON
│   ├── PURPOSE.md              Ne işe yarar, hangi app ile (Claude Code), neden.
│   └── ARCHITECTURE.md         Tam teknik anlatım + ASCII diyagramlar + veri akışı.
│
├── lib/                      ◄── PAYLAŞILAN ESM KÜTÜPHANESİ
│   └── bridge-client.mjs       ensureServer() + openBrowser() + askBridge().
│                                Hem hook hem MCP server tarafından import edilir (DRY).
│
├── hooks/                    ◄── CLAUDE CODE ↔ KÖPRÜ ELÇİSİ (kısa ömürlü süreç)
│   ├── askuserquestionspro-bridge.mjs      [GİRİŞ NOKTASI] PreToolUse hook. stdin→/ask→stdout.
│   │                            lib/bridge-client.mjs import eder.
│   │                            Tüm hata yolları exit(0) → native picker fallback.
│   └── hook-output.js          buildHookOutput() — saf payload üreticisi (allow+updatedInput).
│
├── mcp-server/               ◄── MCP SUNUCUSU (sınırsız soru kapısı)
│   └── askuserquestionspro-mcp.mjs           Sıfır-bağımlılık stdio JSON-RPC 2.0 MCP sunucusu.
│                                Tek araç: ask (mcp__askuserquestionspro__ask). maxItems kısıtı yok.
│                                lib/bridge-client.mjs import eder.
│
├── server/                   ◄── KÖPRÜ DAEMON (uzun ömürlü, port 4517)
│   ├── server.js               HTTP + SSE uçları + statik web/ servisi. Süreç girişi.
│   │                            Gövde sınırı 8 MB (büyük soru setleri için).
│   └── bridge.js               Bridge sınıfı — tek-uçuş randevu state machine (40 satır, kalp).
│
├── web/                      ◄── TARAYICI UI (build'siz, yerel React+Babel)
│   ├── vendor/                 [YEREL VENDOR] react / react-dom / babel min'leri
│   │                            (CDN değil → offline çalışır; index.html buradan yükler).
│   ├── themes.js               [SAF] Tema registry (5 tema) + KNOWN_TOKENS sözleşmesi. Test'li.
│   ├── index.html              Mount noktası + script yükleme SIRASI (önemli).
│   ├── styles.css              AMOLED Geist tasarımı + 5 tema token'ı (tek dosya, ~740 satır CSS).
│   ├── answer-map.js           [SAF] decideActivate + mapAnswers — UI state ⇄ answers. Test'li.
│   ├── ui-kit.js               İkonlar (Check, Kbd), sabitler, fullOptions(). Durumsuz JSX.
│   ├── live.js                 useLiveQuestions (SSE) + postAnswers (POST). I/O katmanı.
│   ├── views.js                Saf sunum bileşenleri: Waiting/Sidebar/Hints/QuestionCard/CustomPopup/Summary.
│   └── app.js                  [DURUM MAKİNESİ] App + Flow: akış, klavye, gönderim, mount.
│                                N>8 soruda: accordion gruplar, arama kutusu, "u" atla, toplu atlama.
│
├── test/                     ◄── node --test, sıfır bağımlılık (47 test)
│   ├── bridge.test.js          Randevu state machine.
│   ├── server.test.js          HTTP uçları + round-trip.
│   ├── hook-output.test.js     Hook payload sözleşmesi.
│   ├── answer-map.test.js      Saf UI karar mantığı (regresyonlar dahil).
│   ├── themes.test.js          Tema registry + styles.css :root ↔ KNOWN_TOKENS eşleşmesi.
│   ├── mcp-server.test.js      JSON-RPC initialize + tools/list; maxItems yokluğu doğrulanır.
│   └── bridge-client.test.js   ensureServer() + askBridge() entegrasyon testi.
│
└── design-reference/         ◄── Orijinal Claude Design handoff (KAYNAK, çalışmaz kod).
    ├── project/                app.jsx, styles.css, AskUserQuestions.html, ekran görüntüleri.
    └── chats/                  Tasarım sohbetleri.
   (docs/superpowers/ — eski plan/spec dosyaları; tarihsel.)
```

---

## "X'i değiştirmek istiyorum" → hangi dosya?

| İstediğin                                                        | Git buraya                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Arayüzün **görünümü/teması** (renk, boşluk, font)                | `web/styles.css`                                                |
| Bir şıka basınca **ne olacağı** (seç/onayla/popup mantığı)       | `web/answer-map.js` (`decideActivate`)                          |
| Cevapların **Claude'a hangi şekilde** döneceği                   | `web/answer-map.js` (`mapAnswers`) + `hooks/hook-output.js`     |
| **Klavye kısayolları**, soru akışı, gönderim                     | `web/app.js` (`Flow` içindeki `onKey`/`activate`/`submit`)      |
| Bir **bileşenin işaretlemesi** (sidebar, kart, popup, özet)      | `web/views.js`                                                  |
| **İkon** veya ortak sabit eklemek                                | `web/ui-kit.js`                                                 |
| **Yeni HTTP ucu** veya SSE davranışı                             | `server/server.js`                                              |
| Soru/cevap **randevu mantığı** (eşzamanlılık, iptal)             | `server/bridge.js`                                              |
| Hook'un **Claude ile sözleşmesi**, fallback davranışı            | `hooks/askuserquestionspro-bridge.mjs` + `hooks/hook-output.js` |
| **MCP aracının şeması** veya araç açıklaması                     | `mcp-server/askuserquestionspro-mcp.mjs`                        |
| **Sunucu başlatma / tarayıcı açma** (hook ve MCP arasında ortak) | `lib/bridge-client.mjs`                                         |
| **MCP proje kaydı** (timeout, path)                              | `.mcp.json`                                                     |
| **ASKUI_FORCE_MCP** davranışı (deny → MCP yönlendirmesi)         | `hooks/askuserquestionspro-bridge.mjs`                          |
| **Kurulum** akışı, port, settings.json, MCP kaydı                | `install.sh` (port: `ASKUSER_PORT`, varsayılan 4517)            |
| Yeni script eklersen **yükleme sırası**                          | `web/index.html` (ui-kit → live → views → app sırası şart)      |

---

## Değişiklik yaparken bilmen gereken 5 kural

1. **UI/UX'i bozma.** Tasarım `design-reference/`'tan birebir port edilmiştir;
   görsel davranış korunmalı. N ≤ 8 soruda ek UI özellikleri görünmemeli.
2. **Sıfır bağımlılık, sıfır build.** `package.json`'a dependency ekleme; web
   tarafında build adımı yok (Babel runtime'da derler); MCP sunucusu da sıfır-bağımlılık
   (JSON-RPC elle yönetilir, MCP SDK kullanılmaz).
3. **Güvenli fallback değişmez.** Hook'taki her hata yolu `exit(0)` olmalı;
   MCP sunucusundaki her hata yolu `isError: true` tool-result döndürmeli →
   asla Claude Code'u kilitleme (bkz. ARCHITECTURE §7).
4. **Saf mantığı saf tut.** `answer-map.js`, `bridge.js`, `hook-output.js` I/O'suz
   ve test'li; mantık eklerken aynı dosyada kal ve `test/`'e test yaz.
5. **`web/index.html` script sırası** bağımlılık zinciridir: `answer-map → ui-kit
→ live → views → app`. Klasik script'ler global scope paylaşır; isim çakışması
   = `SyntaxError` (bu yüzden `live.js`/`views.js` hook'ları alias'lar).

---

## Hızlı komutlar

```bash
npm test                       # tüm testler (node --test, sıfır bağımlılık)
npm run serve                  # köprüyü elle başlat (http://127.0.0.1:4517)
ASKUSER_PORT=4599 npm run serve  # izole portta çalıştır (prod 4517'yi bozmadan)
curl localhost:4517/health     # köprü ayakta mı
./install.sh                   # hook'u settings.json'a bağla
```

> **Dikkat:** Geliştirme/test yaparken prod köprü 4517'de çalışıyor olabilir
> (başka bir Claude oturumundan). Çakışmamak için testleri `ASKUSER_PORT` ile
> izole portta koştur.
