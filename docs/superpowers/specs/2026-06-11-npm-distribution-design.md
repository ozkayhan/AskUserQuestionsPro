# askuserquestionspro — npm Dağıtımı (Tasarım)

Tarih: 2026-06-11

## Amaç

`askuseroz` projesini herkesin `npm install -g askuserquestionspro` ile kurup,
`askuserquestionspro install` komutuyla Claude Code'a otomatik bağlayabileceği
dağıtılabilir bir pakete dönüştürmek. Çalışma tamamen lokal kalır (mevcut
davranış), hiçbir uzak servis eklenmez.

## Kararlar

- **Kanal:** npm (yalnız). Homebrew sonraya bırakıldı (ek bakım: tap/formula + node depend).
- **İsim:** `askuserquestionspro` (npm'de müsait — 404 doğrulandı).
- **Kurulum UX:** Açık komut (`askuserquestionspro install`). Otomatik postinstall yok —
  global config'i sessizce değiştirmek sürpriz/risk.
- **install.sh korunur** — npm'siz / repo'dan direkt senaryo için.
- `doctor` ve `serve` komutları dahil.

## Mevcut sorun

Hook komutu repo'nun klonlandığı mutlak path'e bağlı
(`node $DIR/hooks/askuserquestionspro-bridge.mjs`). npm global kurulumda paket farklı bir
konumda (örn. `/usr/local/lib/node_modules/askuserquestionspro/`). CLI kendi
`__dirname`'inden hook path'ini çözerek bunu stabilize eder.

## Mimari

### 1. `package.json` dağıtım hazırlığı
- `"private": true` kaldırılır
- `name: "askuserquestionspro"`, uygun `version`, `description`, `license`, `repository`, `keywords`
- `"bin": { "askuserquestionspro": "bin/cli.js" }`
- `"files": ["bin/", "hooks/", "server/", "web/", "README.md"]` — test/docs/design-reference paket dışı
- `"engines": { "node": ">=18" }` (global fetch için)

### 2. `bin/cli.js` — tek giriş noktası (ince dispatcher)
Komutlar:
- `install` — hook'u `~/.claude/settings.json`'a bağla
- `uninstall` — hook'u kaldır
- `serve` — server'ı foreground çalıştır (debug)
- `doctor` — kurulum + health kontrol
- `help` / `--help` / argümansız — kullanım

Hook path'i: `path.join(__dirname, '..', 'hooks', 'askuserquestionspro-bridge.mjs')` →
mutlak. Komut `"<execPath> <hookAbsPath>"` yerine `"node <hookAbsPath>"`
(install.sh ile tutarlı; PATH'te node varsayılır).

### 3. `bin/install.js` — saf settings.json mantığı (jq'suz, test edilebilir)
Saf fonksiyonlar (I/O'dan ayrı, test edilir):
- `addHook(settings, hookAbsPath) -> { settings, status }` —
  `status`: `"added" | "already" | "conflict"`. PreToolUse/AskUserQuestion
  matcher'ını idempotent ekler. Bizim hook zaten varsa `"already"`. Başka bir
  AskUserQuestion hook'u varsa `"conflict"` (issue #15897 uyarısı).
- `removeHook(settings, hookAbsPath) -> { settings, status }` —
  `status`: `"removed" | "absent"`. Sadece bizim hook entry'sini siler;
  boşalan PreToolUse dizisini/objeyi temizler.

I/O sarmalayıcılar (CLI'dan çağrılır):
- `readSettings(path) -> object` (yoksa `{}`)
- `writeSettings(path, settings)` (pretty JSON)

`hooks/hook-output.js` deseni gibi saf/test edilebilir tutulur.

### 4. Hook/server path bağımsızlığı
Mevcut kod `import.meta.url` / `__dirname` kullanıyor — npm konumunda da
çalışır. Test ile doğrulanır (server'ın `WEB_DIR` çözümü).

### 5. `install.sh` güncellenir
Korunur; CLI ile çakışmayan şekilde aynı hook entry'sini yazdığı doğrulanır
(idempotency: ikisi de aynı matcher/command üretmeli).

## İzolasyon

| Birim | Sorumluluk | Bağımlılık |
|-------|-----------|-----------|
| `bin/cli.js` | Argüman parse + komut dispatch + konsol çıktısı | `bin/install.js`, `server/server.js` |
| `bin/install.js` | settings.json saf manipülasyon + I/O sarmalayıcı | yok (saf) |
| hook/server/web | Değişmez (path zaten relatif) | — |

## Test (node:test, sıfır bağımlılık)

`test/install.test.js`:
- Boş settings → `addHook` → `"added"`, doğru matcher şekli
- Bizim hook mevcut → `addHook` → `"already"` (idempotent, çift eklemez)
- Başka AskUserQuestion hook → `addHook` → `"conflict"`
- `removeHook` mevcut → `"removed"`, PreToolUse temizlenir
- `removeHook` yok → `"absent"`
- round-trip: add sonra remove → orijinal settings'e eşit

Mevcut testler korunur (`npm test` yeşil kalır).

## Yayın akışı

1. `npm pack` ile içerik doğrula (`files` whitelist doğru mu)
2. `npm publish` (kullanıcı yapar; gerekli kimlik onda)
3. README birincil kurulum:
   ```bash
   npm install -g askuserquestionspro
   askuserquestionspro install
   ```

## Kapsam dışı (YAGNI)

- Homebrew formula
- Otomatik postinstall hook bağlama
- Windows'a özel açma komutu (mevcut `open` macOS; ayrı iş)
- Sürüm güncelleme / self-update mekanizması
