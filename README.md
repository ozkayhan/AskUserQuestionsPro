# claude-askui — AskUserQuestion için özel AMOLED arayüz

Claude Code her `AskUserQuestion` sorduğunda, yerleşik picker yerine bu projedeki
AMOLED Geist tam ekran arayüzü otomatik açılır; cevabınız modele geri döner.
Her şey **lokal** çalışır — sıfır bağımlılık, uzak servis yok.

## Kurulum

### Hızlı kurulum (tek satır)

```bash
curl -fsSL https://raw.githubusercontent.com/ozkayhan/AskUserQuestionsPro/main/install.sh | bash
```

Yeni bir `claude` oturumu açın. Hepsi bu.

### npm ile

```bash
npm install -g claude-askui
claude-askui install
```

### CLI komutları

| Komut | İş |
|-------|----|
| `claude-askui install` | Hook'u `~/.claude/settings.json`'a bağlar |
| `claude-askui uninstall` | Hook'u kaldırır |
| `claude-askui serve` | Köprüyü foreground çalıştırır (debug, port 4517) |
| `claude-askui doctor` | Kurulum + köprü durumunu kontrol eder |

### Lokal repo'dan (npm'siz)

```bash
./install.sh
```

`install.sh` ile `claude-askui install` aynı hook entry'sini yazar (idempotent).

## Nasıl çalışır

- Bir `PreToolUse` hook (`hooks/askuser-bridge.mjs`) AskUserQuestion'ı yakalar.
- Yerel köprü (`server/server.js`, port 4517, sıfır bağımlılık) soruları SSE ile
  `web/` arayüzüne push eder.
- Cevap `permissionDecision:"allow"` + `updatedInput` ile modele verilir; native
  picker hiç görünmez.

## Klavye

- `1–4` seç · aynı tuşa tekrar (veya `↵`) onayla · `← →` gezin
- "Other" şıkkında `↵` → uzun cevap için büyüyen yazı alanı (`⇧↵` yeni satır)
- Review: `B` cevaplanmamışa dön · `↵` gönder

## Tema

Arayüz **5 bambaşka tema** ile gelir — sadece renk değil; font, gölge, köşe
yarıçapı, doku, motion ve cam/blur efektleri dahil her şey değişir. Sidebar
altındaki **Theme** seçicisinden tıklayarak geçilir; seçim `localStorage`'a
yazılır ve sonraki açılışlarda hatırlanır.

| Tema | Karakter |
|------|----------|
| **AMOLED** | Saf siyah, mavi accent, Geist — varsayılan |
| **Paper** | Sıcak beyaz, serif başlık (Newsreader), terracotta, keskin köşe, düz |
| **Phosphor** | CRT yeşili, full monospace, kare köşe, scanline + glow |
| **Dusk** | Sıcak kömür, amber accent, yuvarlak köşe, yumuşak gölge |
| **Aurora** | İndigo glassmorphism, mor/cyan, blur + translucent, büyük radius |

Mimari **lightweight ve veri-odaklı**: tüm stil CSS custom property'lerle (design
token) sürülür. `web/themes.js` her temayı yalnızca **delta** (amoled tabanından
farklar) olarak tutar — tema başına ~15-30 satır saf veri. Yeni tema eklemek =
registry'ye bir nesne eklemek; diskte neredeyse yer kaplamaz, yüzlerce temaya
ölçeklenir. Paylaşılabilir link / test için `?theme=<id>` başlangıç override'ı da
desteklenir (seçiciyi kaldırmaz). Detay: `living_docs/THEMES.md`.

## Sorun giderme

- Arayüz açılmıyorsa: `node server/server.js` elle çalıştırıp `localhost:4517`'i açın.
- Native picker çıkıyorsa: köprü kapalı/timeout olmuş demektir (güvenli fallback);
  `curl localhost:4517/health` ile köprüyü kontrol edin.
- AskUserQuestion için **tek** PreToolUse hook olmalı (Claude Code issue #15897).

## Test

```bash
npm test   # node --test (sıfır bağımlılık)
```

## Yapı

| Yol | Sorumluluk |
|-----|-----------|
| `server/bridge.js` | Saf randevu mantığı (soru seti ↔ cevap promise) |
| `server/server.js` | HTTP köprü + statik UI servisi |
| `web/answer-map.js` | UI state → AskUserQuestion `answers` şekli (saf, UMD) |
| `web/ui-kit.js` | İkonlar, sabitler, `fullOptions` (durumsuz) |
| `web/live.js` | SSE alımı + cevap POST'u (I/O katmanı) |
| `web/views.js` | Saf sunum bileşenleri (sidebar, kart, popup, özet) |
| `web/app.js` | Durum makinesi: akış, klavye, gönderim + mount |
| `web/themes.js` | Tema registry + `apply()` + font swap + persistans (UMD, test edilir) |
| `web/index.html` · `web/styles.css` | Mount + token-tabanlı tasarım sistemi |
| `hooks/hook-output.js` | PreToolUse stdout payload üreticisi (saf) |
| `hooks/askuser-bridge.mjs` | PreToolUse hook |
| `bin/cli.js` | CLI giriş noktası (install/uninstall/serve/doctor) |
| `bin/install.js` | settings.json saf manipülasyon mantığı (jq'suz, test edilir) |
| `install.sh` | settings.json'a hook'u bağlar (npm'siz alternatif) |
| `living_docs/` | Amaç (`PURPOSE.md`) + mimari (`ARCHITECTURE.md`) dokümanları |
| `CODEMAP.md` | "Neyi nerede bulurum" giriş haritası (önce bunu oku) |
| `design-reference/` | Orijinal Claude Design handoff bundle |
