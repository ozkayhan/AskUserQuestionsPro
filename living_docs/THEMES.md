# Tema sistemi — build log (baştan sona)

Tarih: 2026-06-11

Bu doküman tema sisteminin **nasıl** inşa edildiğini, hangi kararların alındığını
ve yol boyunca karşılaşılan engelleri kaydeder. Tasarım gerekçesinin tamamı:
`docs/superpowers/specs/2026-06-11-theme-system-design.md`.

## Amaç

`web/` AskUserQuestion arayüzüne, sadece renk değil **her şeyiyle** (renk, font,
gölge, köşe yarıçapı, doku, motion, cam/blur) bambaşka 5 tema. İleride yüzlerce
tema; bu yüzden diskte yer kaplamayan, **lightweight, veri-odaklı** bir sistem.

## Zemin keşfi

Arayüz zaten tamamen CSS custom property (design token) üzerine kuruluydu:
`styles.css` `:root`'ta renkler, `--radius*`, `--motion-*`, `--font-*`. `app.js`
ise `data-bg="amoled"` + inline `--accent`/`--motion-ms` ile temayı sabitliyordu.
Yani token altyapısı %90 hazırdı; eksikler: gölge/doku/efekt tokenları, bir
registry, bir seçici.

## Kullanıcı kararları (brainstorming)

- **5 tema yönü** önerildiği gibi onaylandı: AMOLED, Paper, Phosphor, Dusk, Aurora.
- **Switcher UX:** "sadece seçici" (klavye kısayolu yok) + `localStorage` persistans.

## Yapılanlar

1. **Token yüzeyi genişletildi** (`styles.css`): `--font-display`, `--shadow-pop/
   -popup/-toast/-key`, `--overlay-bg/-blur`, `--surface-blur`, `--texture`,
   `--selection-bg`, `--sidebar-bg`, `--opt-bg-sel`, `--progress-glow` `:root`'a
   amoled defaultlarıyla eklendi; hardcoded değerler `var()` ile değiştirildi.
   Cam efekti için `.sidebar/.opt/.popup/.toast`'a `backdrop-filter:
   var(--surface-blur)` (amoled'de `none` → etkisiz).
2. **Registry** (`web/themes.js`, UMD dual-export): amoled = base (`tokens: {}`,
   `:root` defaultları). Diğer 4 tema yalnızca **delta** taşır. `apply()` önce
   tüm bilinen anahtarları `documentElement`'ten siler (→ amoled), sonra temanın
   override'ını `setProperty` ile yazar. Font alanı varsa tek `<link>` enjekte/
   değiştirir. Seçim `localStorage["askui_theme"]`'e yazılır ve script yüklenir
   yüklenmez (React'tan önce) uygulanır → açılışta flaş yok. `?theme=<id>`
   başlangıç override'ı eklendi (paylaşılabilir link / headless test).
3. **Switcher UI** (`views.js` `ThemeSwitcher`): sidebar foot'una swatch satırı
   (bg + accent noktası + isim), tıklayınca `Themes.apply()` + aktif vurgulama.
4. **Wiring**: `index.html`'e `themes.js` (plain script, babel'dan önce); `app.js`
   inline `--accent`/`--motion-ms`/`data-bg` override'ları kaldırıldı (yoksa `.app`
   scope'u tema tokenlarını gölgeliyordu).
5. **Test** (`test/themes.test.js`, `node --test`): 5 tema, benzersiz id, amoled
   base sözleşmesi (tokens boş), kaçak token anahtarı yok, non-base temalar
   çekirdek renkleri override eder, font şekli, bilinmeyen id → default, node'da
   (document yok) çökme yok. **36/36 geçti** (mevcut testler dahil).

## Yol boyunca karşılaşılan engeller

- **`serveStatic` latent bug**: `/?theme=x` isteğinde `req.url !== '/'` olduğundan
  index.html'e map edilmiyor, dizine düşüp 404 "Not found" dönüyordu. Düzeltme:
  query string'i sıyır, sonra `'/'` → `/index.html` (`server/server.js`). Bu, query
  string'li tüm kök isteklerini de düzeltir.
- **Headless doğrulama**: Chrome `--virtual-time-budget`, açık **EventSource (SSE)**
  ve dinamik enjekte edilen **font fetch'i** yüzünden stall ediyordu (sanal saat
  bekleyen ağ isteğinde ilerlemiyor) → süreç asılı kalıyordu. Çözüm: gerçek React
  akışı yerine SSE'siz **statik doğrulama harness'ı** (geçici `web/_verify.html`,
  sonra silindi), font hostlarını `127.0.0.1:9`'a map'leyip (anında refused) sabit
  zamanlı screenshot + sert kill timeout. 5 tema da görsel olarak doğrulandı.

## Görsel doğrulama sonucu

Beş tema da headless Chrome ile screenshot alınıp incelendi: AMOLED (siyah/mavi/
keskin), Paper (kağıt/serif/terracotta/flat), Phosphor (CRT yeşil/mono/glow/kare),
Dusk (kömür/amber/yuvarlak/yumuşak), Aurora (indigo glass/mor/gradient/büyük
radius). Switcher her temada görünür, aktif tema vurgulu.

## Yeni tema nasıl eklenir

`web/themes.js` → `LIST`'e bir nesne ekle:

```js
{
  id: 'midnight', name: 'Midnight',
  swatch: { bg: '#0b1020', accent: '#5b8cff' },   // seçici noktası
  font: null,                                       // veya 'Family:wght@...'
  tokens: {                                         // sadece amoled'den farklar
    '--bg': '#0b1020', '--accent': '#5b8cff', /* ... */
  }
}
```

Anahtarlar `KNOWN_TOKENS` (= `styles.css :root` sözleşmesi) içinde olmalı; test
kaçak anahtarı yakalar. Yeni bir efekt eklenmek istenirse önce `:root`'a token +
kullanım yeri, sonra `KNOWN_TOKENS` listesine eklenir.
