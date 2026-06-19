# askuseroz — Ne işe yarar, hangi app ile çalışır

> **Tek cümle:** Claude Code'un sıradan `AskUserQuestion` picker'ını, AMOLED Geist
> temalı tam ekran bir web arayüzüyle değiştiren; **tek seferde sınırsız soru
> sorabilme** yeteneği kazandıran; tamamen yerel, sıfır-bağımlılık, sıfır-build
> bir köprü.

---

## 1. Hangi uygulamayla birlikte kullanılır?

**Claude Code** (Anthropic'in resmî CLI'ı) ile. Başka hiçbir şeye bağlı değildir.

Claude Code bir göreve devam etmeden önce sana çoktan seçmeli soru sormak
istediğinde **`AskUserQuestion`** adlı yerleşik aracı çağırır. Normalde bu, CLI
içinde basit bir terminal picker açar. `askuseroz` araya girip o picker'ı
**susturur** ve yerine tarayıcıda çok daha zengin bir arayüz açar. Sen orada
seçersin, cevap Claude Code'a geri akar — model hiçbir farkı anlamaz, sadece
cevabını alır.

```
                 SENİN MAKİNEN (her şey 127.0.0.1, dışarı çıkış YOK)
   ┌───────────────────────────────────────────────────────────────────┐
   │                                                                     │
   │   Claude Code  ──"soru sormam lazım"──►  AskUserQuestion aracı      │
   │       │                                                             │
   │       │ (PreToolUse hook araya girer)                              │
   │       ▼                                                             │
   │   askuseroz köprüsü  ──push──►  Tarayıcı (AMOLED arayüz)           │
   │       ▲                              │                              │
   │       └────────── cevap ◄────────────┘  (sen seçersin)             │
   │       │                                                             │
   │       ▼                                                             │
   │   Claude Code cevabı alır, göreve devam eder                       │
   │                                                                     │
   └───────────────────────────────────────────────────────────────────┘
```

---

## 2. Neyi çözüyor? (Amaç)

Yerleşik `AskUserQuestion` picker'ı işlevseldir ama dardır:

| Yerleşik picker | askuseroz arayüzü |
|-----------------|-------------------|
| Terminal içinde sıkışık | Tam ekran, nefes alan AMOLED tasarım |
| Kısa "Other" cevabı | Büyüyen textarea — istediğin kadar uzun yaz |
| Tek tek soru | Tüm soru seti + ilerleme çubuğu + kenar çubuğu |
| Geri dön/düzenle kısıtlı | Review ekranı: gönder öncesi her cevabı düzenle |
| Klavye sınırlı | `1–4` seç · tekrar bas onayla · `← →` gezin |
| **En fazla 4 soru/çağrı** (native araç sözleşmesi) | **Sınırsız soru** — `mcp__askuserquestionspro__ask` ile onlarca/yüzlerce soru tek UI oturumunda |

**Amaç:** Claude Code'un netleştirme sorularını cevaplamayı hızlı, görsel ve
keyifli hale getirmek — kullanıcının akışını bozmadan, modelin sözleşmesini
(`questions`/`answers` şekli) birebir koruyarak. Küçük soru setleri (≤4) mevcut
`AskUserQuestion` hook yoluyla sorunsuz akar; büyük soru setleri (>4) yeni MCP
aracı `mcp__askuserquestionspro__ask` üzerinden tek UI oturumunda sunulur. Her iki yol da aynı
bridge ve web arayüzünü kullanır.

---

## 3. Çalışma tarzının iki altın kuralı

Bu proje iki ilke üzerine kuruludur; her değişiklik bunlara saygı göstermelidir:

### Kural 1 — "Asla araya girip bozma" (güvenli fallback)
Köprü kapalıysa, timeout olursa, bozuk veri gelirse veya kullanıcı sekmeyi
kaparsa, hook **sessizce çekilir** (`process.exit(0)`) ve Claude Code **yerleşik
picker'ı** gösterir. Yani askuseroz hiçbir zaman Claude Code'u kilitlemez; en
kötü ihtimalle "yokmuş gibi" davranır. Her hata yolu native picker'a düşer.

### Kural 2 — "Sıfır kurulum yükü"
- **Sıfır npm bağımlılığı** — sadece Node çekirdeği (`http`, `fs`, `child_process`). MCP sunucusu da sıfır-bağımlılık, elle JSON-RPC 2.0 stdio ile çalışır.
- **Sıfır build adımı** — tarayıcıda React + Babel yerel vendor dosyalarından, JSX runtime'da derlenir.
- **Tek dosya kurulum** — `./install.sh` settings.json'a hook satırını ekler, `claude mcp add` ile MCP sunucusunu kaydeder, biter.

---

## 4. Tipik kullanıcı akışı (uçtan uca)

1. Sen Claude Code'da çalışırsın. Claude bir noktada netleştirme sorusu sorar.
2. Tarayıcıda AMOLED arayüz **otomatik açılır** (`open http://127.0.0.1:4517`).
3. `1`–`4` ile şık seçersin; aynı tuşa tekrar basınca (ya da `↵`) onaylarsın.
   "Other" dersen büyüyen bir yazı alanı açılır, uzun cevabını yazarsın.
4. Tüm sorular bitince **Review** ekranı çıkar; istersen düzenler, `↵` ile gönderirsin.
5. Cevabın Claude Code'a döner; Claude göreve kaldığı yerden devam eder.

---

## 5. Sınırlar / bilinçli kısıtlar

- **Tek-uçuş:** Köprü aynı anda yalnızca **bir** soru setini tutar. İkinci bir
  set gelirse reddedilir (409) ve o ikincisi native picker'a düşer. Bu kasıtlı
  basitleştirmedir — `AskUserQuestion` için tek bir `PreToolUse` hook olmalıdır
  (Claude Code issue #15897). `mcp__askuserquestionspro__ask` de bu kısıtı paylaşır: MCP çağrısı
  409 alırsa model hatayı tool-result olarak görür ve native `AskUserQuestion`'a
  düşmesi için yönlendirilir.
- **Soru sayısı:** Native `AskUserQuestion` 1–4 soruda kalır (modelin sözleşmesi);
  >4 soru için `mcp__askuserquestionspro__ask` kullanılır — bu MCP aracında üst sınır yoktur.
- **Yalnızca yerel:** Server `127.0.0.1`'e bağlanır; ağ üzerinden erişilemez.
- **macOS varsayımı:** Tarayıcıyı `open` komutuyla açar (kurulum scripti `bash`/`jq`).

---

## 6. Daha fazlası

- Teknik iç işleyiş, diyagramlar, veri akışı → [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- Dosya haritası, "neyi nerede bulurum" → [`../CODEMAP.md`](../CODEMAP.md)
- Kurulum & klavye kısayolları → [`../README.md`](../README.md)
