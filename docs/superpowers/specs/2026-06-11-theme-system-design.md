# Tema sistemi — tasarım dokümanı

Tarih: 2026-06-11
Durum: onaylandı (kreatif yön + switcher UX kullanıcı onayı alındı)

## Amaç

`web/` AskUserQuestion arayüzüne, sadece renk değil **her şeyiyle** (renk, font,
gölge, köşe yarıçapı, doku, motion, cam/blur efektleri) bambaşka 5 tema getirmek.
İleride yüzlerce tema eklenebilecek; bu yüzden **diskte çok yer kaplamayan,
lightweight, veri-odaklı** bir tasarım sistemi kurulur.

## Mevcut durum (zemin)

Arayüz zaten tamamen CSS custom property (design token) üzerine kurulu:
`styles.css` `:root` bloğunda renkler, `--radius*`, `--motion-ms/--ease`,
`--font-sans/--font-mono` tanımlı. `[data-bg="soft"]` gibi bir varyant ve
`app.js`'te inline `--accent`/`--motion-ms` override pattern'i mevcut. Yani
token altyapısı %90 hazır; eksik olan (a) gölge/doku/efektlerin tokenleştirilmesi,
(b) tema setlerini taşıyan bir registry, (c) bir seçici UI.

## Tasarım

### 1. Token contract (genişletilmiş yüzey)

`styles.css` `:root`'a, hâlihazırda hardcoded olan farklılaştırıcı değerler token
olarak eklenir ve kullanım yerlerinde `var()` ile değiştirilir. Yeni tokenlar
(amoled varsayılan değerleriyle):

| Token | Amaç | Amoled default |
|-------|------|----------------|
| `--font-display` | Başlık fontu | `var(--font-sans)` |
| `--shadow-pop` | Seçili opt vurgu gölgesi | `0 8px 30px -12px var(--accent-line)` |
| `--shadow-popup` | Popup gölgesi | `0 40px 80px -20px rgba(0,0,0,.9)` |
| `--shadow-toast` | Toast gölgesi | `0 20px 50px -16px rgba(0,0,0,.9)` |
| `--shadow-key` | Tuş/kbd inset gölge | `inset 0 -2px 0 rgba(0,0,0,.45)` |
| `--overlay-bg` | Modal arka örtü | `rgba(0,0,0,.66)` |
| `--overlay-blur` | Örtü blur miktarı | `3px` |
| `--surface-blur` | Cam efekti (backdrop-filter) | `none` |
| `--texture` | `.app::before` doku | radial mavi glow |
| `--selection-bg` | Metin seçim rengi | `var(--accent-soft)` |
| `--sidebar-bg` | Sidebar zemini | dikey gradient |
| `--opt-bg-sel` | Seçili opt zemini | `linear-gradient(180deg,var(--accent-soft),transparent)` |
| `--progress-glow` | İlerleme çubuğu glow | `0 0 12px var(--accent-line)` |

Mevcut renk/radius/motion/font tokenları zaten temalar tarafından override
edilebilir. Cam efekti için `.sidebar`, `.opt`, `.popup`, `.toast` öğelerine
`backdrop-filter: var(--surface-blur)` eklenir (amoled'de `none` → etkisiz).

### 2. Registry — `web/themes.js` (veri-odaklı, lightweight)

UMD dual-export (answer-map.js ile aynı pattern → node `--test` ile require
edilebilir, tarayıcıda global `Themes`).

```js
Themes = {
  list: [ {id, name, swatch:{bg,accent}, font, tokens}, ... ],
  apply(id), current(), DEFAULT_ID
}
```

**Lightweight ilke:** `amoled` temasının `tokens` map'i **boştur** (`{}`) — CSS
`:root` varsayılanlarını kullanır. Diğer temalar yalnızca **delta** (override)
taşır. `apply()` önce registry'deki tüm bilinen token anahtarlarını
`documentElement`'ten siler (→ amoled defaultuna döner), sonra seçili temanın
override'larını `setProperty` ile yazar. Böylece her tema diskte yalnızca
farklılıkları kadar yer kaplar; yüzlerce tema saf veri olarak eklenebilir.

**Font:** tema `font` alanı (Google Fonts query) verirse, `apply()` tek bir
`<link id="askuserquestionspro-theme-font">` enjekte/değiştirir. Yoksa link kaldırılır.

**Kalıcılık:** seçim `localStorage["askuserquestionspro_theme"]`'e yazılır. `themes.js` yüklenir
yüklenmez (React render'ından önce) kayıtlı tema uygulanır → açılışta flaş yok.

### 3. Switcher UI — sadece seçici (kullanıcı kararı)

`views.js`'e `ThemeSwitcher` (babel/JSX) bileşeni; `Sidebar` foot'una yerleşir.
5 temayı küçük swatch (bg + accent noktası) + isim olarak listeler; tıklayınca
`Themes.apply(id)` çağrılır ve aktif tema işaretlenir. Klavye kısayolu yok.

### 4. 5 tema

| id | İsim | Zemin | Accent | Font | Köşe | Karakter |
|----|------|-------|--------|------|------|----------|
| `amoled` | AMOLED | `#000` | mavi `#0070f3` | Geist | keskin | mevcut, default |
| `paper` | Paper | sıcak beyaz `#faf8f2` | terracotta ink | Newsreader (serif başlık) + Inter | keskin/flat | editöryel, minimal gölge |
| `phosphor` | Phosphor | CRT `#050805` | yeşil `#39ff14` | Geist Mono (full mono) | kare | scanline doku, glow gölge |
| `dusk` | Dusk | kömür `#1a1410` | amber `#f0a830` | Inter | yuvarlak | sıcak, yumuşak gölge |
| `aurora` | Aurora | indigo `#0a0a1f` | mor `#8b5cf6` | Space Grotesk | büyük | glassmorphism (blur + translucent), aurora gradient |

### Veri akışı

`themes.js` (senkron, body parse'ta) → localStorage'tan oku → `apply()` →
`:root` token + font link. React (`app.js`) sonra render olur; `ThemeSwitcher`
kullanıcı tıklamasında `apply()` çağırır, lokal state ile aktifi gösterir. Tema
tamamen CSS token cascade'iyle uygulandığından hiçbir bileşenin tema-bilinci
gerekmez.

### Hata yönetimi

- Geçersiz/bilinmeyen `localStorage` tema id → `DEFAULT_ID` (amoled).
- `app.js`'teki inline `--accent`/`--motion-ms`/`data-bg` override'ları kaldırılır
  (yoksa `.app` scope'u `:root` tema tokenlarını gölgeler).

### Test

`test/themes.test.js` (node `--test`):
- 5 tema, benzersiz id, `amoled` ilk ve `DEFAULT_ID`.
- Her temada `name` + `swatch.bg`/`swatch.accent` var.
- Non-base temaların `tokens` anahtarları bilinen token kümesinin alt kümesi
  (yazım hatası / kaçak anahtar yakalanır).
- `amoled.tokens` boş (base sözleşmesi).
- `font` alanı varsa string.

Mevcut `answer-map.test.js` etkilenmez.

### Lightweight / ölçeklenebilirlik

Her tema ≈ 15–30 satır saf veri. CSS dosyası tek; per-tema stylesheet yok.
Yüzlerce tema = yalnızca registry'ye veri eklemek; istenirse ileride JSON'a
taşınabilir. Disk maliyeti doğrusal ve küçük.
