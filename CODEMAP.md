# CODEMAP — askuseroz

> **Yeni gelen coding agent: önce burayı oku.** Tüm projeyi taramana gerek yok;
> bu harita "neyi nerede bulurum" + "X'i değiştirmek için hangi dosya" sorularını
> cevaplar. Derin teknik için → [`living_docs/ARCHITECTURE.md`](living_docs/ARCHITECTURE.md),
> amaç için → [`living_docs/PURPOSE.md`](living_docs/PURPOSE.md).

**Ne yapar (tek cümle):** Claude Code'un `AskUserQuestion` picker'ını yerel,
sıfır-bağımlılık bir web arayüzüyle değiştirir. Üç parça: **hook** (Claude ile
konuşur) → **server** (köprü, RAM'de soru/cevap tutar) → **web** (UI).

---

## Klasör ağacı (her satırın ne olduğu)

```
askuseroz/
├── CODEMAP.md                ◄── BURADASIN. Giriş haritası.
├── README.md                 Kurulum, klavye, sorun giderme (kullanıcıya dönük).
├── install.sh                settings.json'a PreToolUse hook'unu ekler (jq ile).
├── package.json              Sıfır bağımlılık. scripts: test (node --test), serve.
│
├── living_docs/              ◄── KAVRAMSAL DOKÜMANTASYON
│   ├── PURPOSE.md              Ne işe yarar, hangi app ile (Claude Code), neden.
│   └── ARCHITECTURE.md         Tam teknik anlatım + ASCII diyagramlar + veri akışı.
│
├── hooks/                    ◄── CLAUDE CODE ↔ KÖPRÜ ELÇİSİ (kısa ömürlü süreç)
│   ├── askuser-bridge.mjs      [GİRİŞ NOKTASI] PreToolUse hook. stdin→/ask→stdout.
│   │                            Tüm hata yolları exit(0) → native picker fallback.
│   └── hook-output.js          buildHookOutput() — saf payload üreticisi (allow+updatedInput).
│
├── server/                   ◄── KÖPRÜ DAEMON (uzun ömürlü, port 4517)
│   ├── server.js               HTTP + SSE uçları + statik web/ servisi. Süreç girişi.
│   └── bridge.js               Bridge sınıfı — tek-uçuş randevu state machine (40 satır, kalp).
│
├── web/                      ◄── TARAYICI UI (build'siz, CDN React+Babel)
│   ├── index.html              Mount noktası + script yükleme SIRASI (önemli).
│   ├── styles.css              AMOLED Geist tasarımı (tek dosya, ~640 satır CSS).
│   ├── answer-map.js           [SAF] decideActivate + mapAnswers — UI state ⇄ answers. Test'li.
│   ├── ui-kit.js               İkonlar (Check, Kbd), sabitler, fullOptions(). Durumsuz JSX.
│   ├── live.js                 useLiveQuestions (SSE) + postAnswers (POST). I/O katmanı.
│   ├── views.js                Saf sunum bileşenleri: Waiting/Sidebar/Hints/QuestionCard/CustomPopup/Summary.
│   └── app.js                  [DURUM MAKİNESİ] App + Flow: akış, klavye, gönderim, mount.
│
├── test/                     ◄── node --test, sıfır bağımlılık
│   ├── bridge.test.js          Randevu state machine.
│   ├── server.test.js          HTTP uçları + round-trip.
│   ├── hook-output.test.js     Hook payload sözleşmesi.
│   └── answer-map.test.js      Saf UI karar mantığı (regresyonlar dahil).
│
└── design-reference/         ◄── Orijinal Claude Design handoff (KAYNAK, çalışmaz kod).
    ├── project/                app.jsx, styles.css, AskUserQuestions.html, ekran görüntüleri.
    └── chats/                  Tasarım sohbetleri.
   (docs/superpowers/ — eski plan/spec dosyaları; tarihsel.)
```

---

## "X'i değiştirmek istiyorum" → hangi dosya?

| İstediğin | Git buraya |
|-----------|-----------|
| Arayüzün **görünümü/teması** (renk, boşluk, font) | `web/styles.css` |
| Bir şıka basınca **ne olacağı** (seç/onayla/popup mantığı) | `web/answer-map.js` (`decideActivate`) |
| Cevapların **Claude'a hangi şekilde** döneceği | `web/answer-map.js` (`mapAnswers`) + `hooks/hook-output.js` |
| **Klavye kısayolları**, soru akışı, gönderim | `web/app.js` (`Flow` içindeki `onKey`/`activate`/`submit`) |
| Bir **bileşenin işaretlemesi** (sidebar, kart, popup, özet) | `web/views.js` |
| **İkon** veya ortak sabit eklemek | `web/ui-kit.js` |
| **Yeni HTTP ucu** veya SSE davranışı | `server/server.js` |
| Soru/cevap **randevu mantığı** (eşzamanlılık, iptal) | `server/bridge.js` |
| Hook'un **Claude ile sözleşmesi**, fallback davranışı | `hooks/askuser-bridge.mjs` + `hooks/hook-output.js` |
| **Kurulum** akışı, port, settings.json | `install.sh` (port: `ASKUSER_PORT`, vsayılan 4517) |
| Yeni script eklersen **yükleme sırası** | `web/index.html` (ui-kit → live → views → app sırası şart) |

---

## Değişiklik yaparken bilmen gereken 5 kural

1. **UI/UX'i bozma.** Tasarım `design-reference/`'tan birebir port edilmiştir;
   görsel davranış korunmalı.
2. **Sıfır bağımlılık, sıfır build.** `package.json`'a dependency ekleme; web
   tarafında build adımı yok (Babel runtime'da derler).
3. **Güvenli fallback değişmez.** Hook'taki her hata yolu `exit(0)` olmalı →
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
