# askuseroz — AskUserQuestion için özel AMOLED arayüz

Claude Code her `AskUserQuestion` sorduğunda, yerleşik picker yerine bu projedeki
AMOLED Geist tam ekran arayüzü otomatik açılır; cevabınız modele geri döner.

## Kurulum

```bash
./install.sh
```

Yeni bir `claude` oturumu açın. Hepsi bu.

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
| `web/index.html` · `web/app.js` · `web/styles.css` | AMOLED Geist arayüz |
| `hooks/hook-output.js` | PreToolUse stdout payload üreticisi (saf) |
| `hooks/askuser-bridge.mjs` | PreToolUse hook |
| `install.sh` | settings.json'a hook'u bağlar |
| `design-reference/` | Orijinal Claude Design handoff bundle |
