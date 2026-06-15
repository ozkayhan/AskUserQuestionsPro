# claude-askui — Kullanım Kılavuzu

> **Bu nedir (tek cümle):** Claude Code'un yerleşik `AskUserQuestion` çoktan-seçmeli
> soru picker'ını, tarayıcıda açılan tam-ekran AMOLED bir arayüzle değiştiren;
> tamamen yerel (`127.0.0.1`), sıfır-bağımlılık bir köprü. Yeni özellik: tek
> seferde **sınırsız** soru (`mcp__askui__ask` MCP aracı).

---

## 1. Bu nedir / ne işe yarar

Claude Code bir göreve devam etmeden önce sana çoktan seçmeli soru sorar. Normalde
bu terminal içinde küçük bir picker açar. `claude-askui` bu picker'ı tamamen değiştirmez
— araya girer ve onun yerine tarayıcıda çok daha kullanışlı bir arayüz açar. Cevabın
Claude Code'a döner; model hiçbir fark anlamaz, sadece cevabını alır.

**Yerleşik picker ile aradaki fark:**

| Yerleşik terminal picker | claude-askui arayüzü |
|--------------------------|----------------------|
| Terminal içinde sıkışık | Tam ekran, AMOLED tarayıcı UI |
| "Other" için kısa alan | Büyüyen textarea, uzun cevap yazılabilir |
| Tek tek soru | Tüm soru seti + ilerleme + kenar çubuğu |
| Geri dön / düzenle kısıtlı | Review ekranı: göndermeden önce her cevabı düzenle |
| **En fazla 4 soru / çağrı** | **Sınırsız soru** — `mcp__askui__ask` ile onlarca/yüzlerce soru tek UI oturumunda |

Her şey `127.0.0.1` üzerinde çalışır. Dışarıya çıkan ağ trafiği yoktur, telemetri
yoktur, `npm` bağımlılığı yoktur (yalnızca Node çekirdeği). React/ReactDOM/Babel
yerel vendor dosyalarından sunulduğu için tamamen çevrimdışı da çalışır.

---

## 2. Gereksinimler

| Gereksinim | Detay |
|------------|-------|
| **Node.js** | >= 18 (`package.json engines` alanı; test ortamı v26) |
| **Claude Code** | Kurulu ve çalışıyor olmalı |
| **İşletim sistemi** | macOS birincil (`open` komutuyla tarayıcı açar). Linux `xdg-open`, Windows `cmd /c start` de desteklenir — ancak proje macOS üzerinde geliştirilip test edilmektedir |
| **Bash** | `install.sh` için gerekli |
| **jq** | Opsiyonel. Varsa `~/.claude/settings.json` dosyasına hook'u otomatik ekler; yoksa komut satırında elle ekleme talimatı verir |
| **`claude` CLI PATH'te** | MCP'yi otomatik kaydetmek için gerekli. Yoksa kurulum adımı elle yapılacak komutu basar |

---

## 3. Nasıl indirilir ve kurulur

### Yol A — git clone + install.sh (önerilen)

Bu yöntem en güvenilirdir: repoyu klonlar, tek bir betik çalıştırırsın, biter.

```bash
git clone https://github.com/ozkayhan/AskUserQuestionsPro.git
cd AskUserQuestionsPro
./install.sh
```

`install.sh` tam olarak şunu yapar:

1. `hooks/`, `web/`, `server/`, `lib/`, `mcp-server/` dizinlerini
   `$HOME/.local/share/claude-askui` konumuna kopyalar (her çalıştırmada temiz
   kopya — idempotent).
2. `~/.claude/settings.json` dosyasına `AskUserQuestion` için `PreToolUse` hook
   ekler. `jq` varsa idempotent ekler (aynı komut zaten varsa tekrar eklemez);
   yoksa elle ekleme talimatını yazar.
3. `settings.json` içinde zaten başka bir `AskUserQuestion` hook'u varsa **UYARI**
   verir (Claude Code issue #15897 — tek hook olmalı).
4. `claude` CLI PATH'te varsa `claude mcp add --scope user askui -- node <yol>`
   ile MCP aracını kullanıcı kapsamında global olarak kaydeder.

Kurulum bitince terminalde şunu görürsün:

```
Bitti. Yeni bir 'claude' oturumu açın.
  • Az soru (≤4): AskUserQuestion hook'u yerel AMOLED arayüzü açar.
  • Çok soru: model mcp__askui__ask aracını kullanır (sınırsız, tek ekran).
```

**Yeni bir `claude` oturumu aç** — hook ve MCP yalnızca yeni oturumda devreye girer.

---

### Yol B — curl | bash tek satır

`install.sh` doğrudan pipe ile çalışabilecek şekilde yazılmıştır. GitHub'dan
repoyu zipleyip geçici dizine açar ve oradan kurulum yapar.

```bash
curl -fsSL https://raw.githubusercontent.com/ozkayhan/AskUserQuestionsPro/main/install.sh | bash
```

Adımlar Yol A ile aynıdır. Tek fark: repoyu kalıcı olarak klonlamana gerek yoktur.

**Yeni bir `claude` oturumu aç.**

---

### Yol C — global CLI (npm ile yerel klondan)

Repo klonlandıktan sonra global CLI kurulumu:

```bash
cd AskUserQuestionsPro
npm install -g .
```

Bu adımın ardından sisteminde `claude-askui` komutu kullanılabilir olur:

```bash
claude-askui install
```

> **Not:** `claude-askui` paketi npm registry'de yayınlanmış olarak doğrulanmamıştır.
> `npm install -g claude-askui` komutu çalışmayabilir. Yukarıdaki komut yalnızca
> **yerel klondan** global kurulum içindir.

`claude-askui install` çalıştırmak, `install.sh` ile aynı hook + MCP kayıt
adımlarını gerçekleştirir.

**Yeni bir `claude` oturumu aç.**

---

### jq yoksa — elle hook ekleme

`jq` kurulu değilse `install.sh` sana şu talimatı verir. `~/.claude/settings.json`
dosyasını bir metin editörüyle aç ve mevcut `{}` içine şunu ekle:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "AskUserQuestion",
        "hooks": [
          {
            "type": "command",
            "command": "node \"/Users/SENIN_KULLANICI_ADIN/.local/share/claude-askui/hooks/askuser-bridge.mjs\"",
            "timeout": 360
          }
        ]
      }
    ]
  }
}
```

`SENIN_KULLANICI_ADIN` yerine kendi macOS kullanıcı adını yaz. Kurulumun doğru
yolu `$HOME/.local/share/claude-askui/hooks/askuser-bridge.mjs`'dir.

---

## 4. Kurulumu doğrulama

Yeni `claude` oturumu açtıktan sonra:

```bash
claude-askui doctor
```

veya (global CLI yoksa klondan):

```bash
node bin/cli.js doctor
```

Beklenen başarılı çıktı:

```
✓ Hook kurulu (/Users/sen/.claude/settings.json)
✓ Hook dosyası mevcut (/Users/sen/.local/share/claude-askui/hooks/askuser-bridge.mjs)
· Köprü şu an kapalı (normal — AskUserQuestion'da otomatik başlar)
✓ MCP aracı kayıtlı
```

Köprünün kapalı göstermesi normaldir — köprü ilk soru geldiğinde otomatik başlar.

MCP kaydını ayrıca doğrulamak için:

```bash
claude mcp list
```

Çıktıda `askui` görünmelidir.

**Olası `doctor` mesajları ve anlamları:**

| Mesaj | Ne yapmalı |
|-------|------------|
| `✗ Hook kurulu değil` | `claude-askui install` çalıştır |
| `✗ Çakışan AskUserQuestion hook'u var` | `settings.json` içindeki diğer hook'u elle temizle |
| `✗ Hook dosyası bulunamadı` | Kurulumu tekrar çalıştır |
| `· claude CLI bulunamadı` | MCP durumu kontrol edilemez; `claude mcp list` çalıştır |
| `· MCP aracı kayıtlı değil` | `claude-askui install` veya aşağıdaki elle kayıt komutu |

**MCP'yi elle kaydetmek için:**

```bash
claude mcp add --scope user askui -- node "$HOME/.local/share/claude-askui/mcp-server/askui-mcp.mjs"
```

---

## 5. Nasıl çalışır — kullanım akışı

Kurulum tamamlandıktan sonra Claude Code'u **normalin gibi** kullanırsın. Ekstra
bir şey yapmana gerek yok.

### Az soru (1–4 soru): hook yolu

```
  Claude Code           hook               köprü (4517)       Tarayıcı
      │                   │                    │                  │
      │  AskUserQuestion  │                    │                  │
      │──────────────────►│                    │                  │
      │                   │  sunucu kapalıysa  │                  │
      │                   │  otomatik başlatır │                  │
      │                   │──POST /ask────────►│                  │
      │                   │                    │──SSE push────────►│
      │                   │                    │                  │ (tarayıcı açılır,
      │                   │                    │                  │  sen seçersin)
      │                   │                    │◄─POST /answer────│
      │◄──── cevap (stdout) ──────────────────────────────────────│
      │  (native picker atlanır, model cevabı alır)
```

### Çok soru (> 4 soru): MCP yolu

```
  Claude Code           MCP sunucusu        köprü (4517)       Tarayıcı
      │                   │                    │                  │
      │  mcp__askui__ask  │                    │                  │
      │──────────────────►│                    │                  │
      │                   │──POST /ask────────►│                  │
      │                   │                    │──SSE push────────►│
      │                   │                    │                  │ (aynı arayüz,
      │                   │                    │                  │  tüm sorular)
      │                   │                    │◄─POST /answer────│
      │◄──── tool-result {answers:{...}} ──────────────────────────
```

Her iki yol da aynı sunucuyu (`127.0.0.1:4517`) ve aynı web arayüzünü kullanır.
Tarayıcı sekmesini açık tutarsan oturum boyunca sorular oraya gelmeye devam eder.

### Hook zaman aşımı

Hook, köprüden cevap beklerken **5 dakika** timeout uygular
(`hooks/askuser-bridge.mjs` içinde `TIMEOUT_MS = 5 * 60 * 1000`). 5 dakika
içinde cevap vermezsen native picker'a düşer.

MCP yolu ise cevabı 30 dakika bekler (`mcp-server/askui-mcp.mjs` içinde
`timeoutMs: 30 * 60 * 1000`). Claude Code'un kendi MCP araç timeout'u pratikte
~28 saat olduğundan uzun anket oturumları sorunsuz çalışır.

---

## 6. Klavye kısayolları

| Tuş | Ne yapar |
|-----|----------|
| `1`–`9` | O indeksteki şıkkı seç |
| Aynı tuşa tekrar bas | Tek-seçimli soruda seçimi onayla |
| `Enter` | Çok-seçimli soruda onayla; Review ekranında gönder |
| `Enter` — "Other" şıkkında | Serbest yazı alanını aç |
| `Enter` — yazı alanındayken | Cevabı kaydet |
| `Shift + Enter` — yazı alanındayken | Yeni satır ekle |
| `Esc` — yazı alanındayken | İptal et |
| `←` / `→` | Sorular arasında gezin |
| `B` | (Review ekranında) Cevaplanmamış sorulara geri dön |
| `U` | (Büyük setlerde, N > 8) Sonraki cevaplanmamış soruya atla |

### Büyük soru setlerinde ek özellikler (N > 8)

8'den fazla soru olduğunda arayüz otomatik olarak şu özellikleri etkinleştirir:

| Özellik | Açıklama |
|---------|----------|
| **Accordion grupları** | Kenar çubuğu soruları `header` alanına göre katlanabilir bölümlere ayırır; her bölüm "cevaplanan/toplam" sayacı gösterir |
| **Arama + filtre** | Soru metni üzerinde anlık metin filtresi; "Yalnızca cevaplanmamışları göster" toggle'ı |
| **Sonraki cevaplanmamışa atla** | `U` tuşu veya kenar çubuğundaki düğme ile bir sonraki cevaplanmamış soruya anında geçiş |
| **Kalanları atla ve gözden geçir** | Tüm soruları tek tek geçmeden doğrudan Review ekranına giden toplu düğme |

---

## 7. Temalar

Arayüz 5 tema ile gelir. Kenar çubuğunun altındaki **Theme** seçicisinden değiştirebilirsin. Seçimin `localStorage`'a kaydedilir ve bir sonraki açılışta geri yüklenir.

| Tema | Karakter |
|------|----------|
| **AMOLED** | Saf siyah, mavi aksan, Geist — varsayılan |
| **Paper** | Sıcak krem, Newsreader serif başlıklar, terracotta aksan, keskin köşeler |
| **Phosphor** | CRT yeşili, tam monospace (Geist Mono), kare köşeler, tarama çizgisi dokusu |
| **Dusk** | Sıcak antrasit, amber aksan, yuvarlak köşeler, yumuşak gölgeler |
| **Aurora** | İndigo glassmorphism, violet/cyan, blur + yarı saydam yüzeyler |

Başlangıç temasını URL parametresiyle de zorlayabilirsin:

```
http://127.0.0.1:4517?theme=paper
```

(Geçerli tema kimlikleri: `amoled`, `paper`, `phosphor`, `dusk`, `aurora`)

---

## 8. Cok soruyu zorlama — ASKUI_FORCE_MCP

Varsayılan davranışta 1–4 soruluk setler hook yoluyla (`AskUserQuestion`) işlenir.
Eğer hook'un her durumda modeli `mcp__askui__ask` aracına yönlendirmesini istiyorsan:

```bash
ASKUI_FORCE_MCP=1 claude
```

Bu değişken set edildiğinde hook, gelen `AskUserQuestion` çağrısını reddeder
(`permissionDecision: "deny"`) ve modele `mcp__askui__ask` kullanması için mesaj
gönderir. Değişken **varsayılan olarak kapalıdır** — elle set etmediğin sürece
davranış değişmez.

---

## 9. Ortam değişkenleri

| Değişken | Varsayılan | Ne işe yarar |
|----------|------------|--------------|
| `ASKUSER_PORT` | `4517` | Köprü sunucusunun dinlediği port. Hook ve sunucu ikisi de bu değişkeni okur — değiştirirsen ikisine de yansıtılmış olur |
| `ASKUI_FORCE_MCP` | (kapalı) | Truthy değer (örn. `1`) set edilirse hook, `AskUserQuestion` çağrısını reddedip modeli `mcp__askui__ask`'e yönlendirir |
| `MCP_TOOL_TIMEOUT` | ~28 saat (Claude Code varsayılanı) | MCP araç çağrısı zaman aşımı (ms). Çoğu durumda dokunmana gerek yoktur; pratikte sınırsız kabul edilebilir |
| `MCP_TIMEOUT` | — | MCP sunucusu başlatma zaman aşımı. Proje düzeyinde `.mcp.json` içinde `timeout: 3600000` (1 saat) olarak ayarlıdır |

**Oturum başında export ile set etmek:**

```bash
export ASKUSER_PORT=4518
export ASKUI_FORCE_MCP=1
claude
```

**.mcp.json ile proje düzeyinde timeout (doğrulanmış değer):**

```json
{
  "mcpServers": {
    "askui": {
      "command": "node",
      "args": ["mcp-server/askui-mcp.mjs"],
      "timeout": 3600000
    }
  }
}
```

---

## 10. Ne zaman çalışır / ne zaman çalışmaz

### Çalışır

| Koşul | Detay |
|-------|-------|
| Yerel makine + tarayıcı açık | Sunucu `127.0.0.1:4517`'ye bağlanır; uzaktan erişilemez |
| Node.js >= 18 kurulu | `node --version` ile kontrol et |
| Hook ve MCP kurulu | `claude-askui doctor` ile doğrula |
| Yeni `claude` oturumu açıldı | Hook ve MCP, eski oturumda devreye girmez |

### Güvenli fallback — asla kilitlemez (Kural 1)

Aşağıdaki durumlarda `claude-askui` sessizce çekilir ve Claude Code **yerleşik
native picker'ı** gösterir. Bu beklenen davranıştır, hata değildir:

| Durum | Sonuç |
|-------|-------|
| Köprü başlatılamadı / yanıt vermiyor | Hook `exit(0)` → native picker |
| Hook 5 dakika zaman aşımına uğradı | Hook `exit(0)` → native picker |
| Tarayıcı sekmesi kapatıldı | `res 'close'` → `bridge.cancel()` → native picker |
| Aynı anda ikinci soru seti geldi (409) | İkinci set → native picker (tek-uçuş tasarımı) |
| Bozuk / eksik stdin verisi | Hook `exit(0)` → native picker |
| MCP yolunda herhangi bir hata | `isError: true` tool-result → model native'e yönlendirilir |

### Çalışmaz / dikkat edilmesi gerekenler

| Durum | Ne yapmalı |
|-------|-----------|
| **Uzaktan / headless sunucu** | Tarayıcı açılamaz; hook veya MCP her seferinde native'e düşer |
| **Başka bir AskUserQuestion hook'u zaten kurulu** | Claude Code issue #15897: tek `PreToolUse` hook olmalı. `doctor` çakışmayı bildirir; `settings.json`'dan diğer hook'u elle kaldır |
| **`claude` CLI PATH'te yok** | MCP otomatik kaydedilemez; `claude mcp add ...` komutunu elle çalıştır (kurulum sırasında yazdırılır) |
| **Çok uzun anket + düşük `MCP_TOOL_TIMEOUT`** | Değişkeni yeterince büyük bir değere ayarla; varsayılan ~28 saatte dokunmana gerek yok |

---

## 11. Sorun giderme

**Native picker açılıyor, tarayıcı arayüzü gelmiyor**

Bu güvenli fallback'tir — köprü kapalı veya timeout olmuştur. Kontrol:

```bash
curl http://127.0.0.1:4517/health
# Beklenen: {"ok":true}
```

```bash
claude-askui doctor
```

**Tarayıcı hiç açılmadı**

Köprüyü elle başlat, sonra tarayıcıdan `http://127.0.0.1:4517` adresini aç:

```bash
claude-askui serve
# veya:
node server/server.js
```

**Port 4517 kullanımda**

```bash
export ASKUSER_PORT=4518
claude
```

**MCP listede görünmüyor**

```bash
# Durumu kontrol et:
claude mcp list

# Elle kaydet:
claude mcp add --scope user askui -- node "$HOME/.local/share/claude-askui/mcp-server/askui-mcp.mjs"
```

**jq yok, hook otomatik eklenmedi**

`~/.claude/settings.json` dosyasını bir editörde aç ve Bölüm 3'teki elle ekleme
adımını uygula.

**Tarayıcı açıldı ama soru gelmiyor**

Köprü SSE bağlantısını kaybetmiş olabilir. Sayfayı yenile (`F5` / `Cmd+R`) —
UI 1 saniye içinde yeniden bağlanır.

**Çakışan hook uyarısı aldım**

`~/.claude/settings.json` içinde `hooks.PreToolUse` dizisine bak. `AskUserQuestion`
eşleşmeli başka bir hook varsa kaldır; yalnızca `claude-askui` hook'u kalmalı.

---

## 12. `claude-askui` CLI komutları

(Global kurulum: `npm install -g .` sonrası. Klondan: `node bin/cli.js <komut>`)

| Komut | Ne yapar |
|-------|----------|
| `claude-askui install` | Hook'u `~/.claude/settings.json`'a ekler + MCP sunucusunu kaydeder |
| `claude-askui uninstall` | Hook'u kaldırır |
| `claude-askui serve` | Köprü sunucusunu ön planda başlatır (debug, port 4517) |
| `claude-askui mcp` | MCP stdio sunucusunu ön planda başlatır (debug) |
| `claude-askui doctor` | Hook kurulumu, hook dosyası, köprü durumu ve MCP kaydını kontrol eder |
| `claude-askui help` | Kullanım bilgisini gösterir |

---

## 13. Kaldırma

Hook'u kaldır:

```bash
claude-askui uninstall
```

MCP sunucusunu kaldır:

```bash
claude mcp remove askui
```

Kurulmuş dosyaları tamamen sil:

```bash
rm -rf "$HOME/.local/share/claude-askui"
```

---

## Hızlı başvuru

```
Repo:     https://github.com/ozkayhan/AskUserQuestionsPro
Sorunlar: https://github.com/ozkayhan/AskUserQuestionsPro/issues
Port:     http://127.0.0.1:4517  (varsayılan)
Kurulum:  curl -fsSL https://raw.githubusercontent.com/ozkayhan/AskUserQuestionsPro/main/install.sh | bash
Tanı:     claude-askui doctor
```
