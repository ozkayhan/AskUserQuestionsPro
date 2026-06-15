# 📖 askuseroz — "Tek Seferde 40–300 Soru" Çözüm Yolları Kitapçığı

> **Amaç:** Claude Code'un `AskUserQuestion` aracının **tek çağrıda en fazla 4 soru**
> kısıtını aşıp, askuseroz arayüzünde **tek seferde 40 / 50 / 300 soruyu** göstermek.
> Bölmek (4'erli turlar) **kabul edilen bir çözüm değildir.**
>
> Bu belge bir **karar kitapçığıdır**: önce problemi kemiğine kadar açar, sonra
> **10 ayrı çözüm yolunu** çok boyutlu puanlar, en sonunda bir öneri + yol haritası verir.
> Sen seçersin, ondan sonra uygularız.

📅 Tarih: 2026-06-15 · 🔖 Claude Code sürümü: 2.1.177 · 🧪 Kaynak: proje kodu + context7 (`/anthropics/claude-code`)

---

## 🧭 İçindekiler

1. [⚡ TL;DR — 60 saniyelik özet](#-tldr--60-saniyelik-özet)
2. [🧩 Problem Anatomisi — limit tam olarak nerede?](#-problem-anatomisi--limit-tam-olarak-nerede)
3. [💡 Kilit İçgörü — "tesisat zaten sınırsız"](#-kilit-içgörü--tesisat-zaten-sınırsız)
4. [🗺️ Çözüm Uzayının Haritası (taksonomi)](#️-çözüm-uzayının-haritası-taksonomi)
5. [📊 Karşılaştırma Tablosu + Sıralama](#-karşılaştırma-tablosu--sıralama)
6. [📚 On Çözüm — Detaylı Analiz](#-on-çözüm--detaylı-analiz)
7. [🏗️ Ortak İş: 300 soruyu UI nasıl gösterecek?](#️-ortak-i̇ş-300-soruyu-ui-nasıl-gösterecek)
8. [✅ Öneri & Yol Haritası](#-öneri--yol-haritası)
9. [🧠 Karar Rehberi (hangi durumda hangisi)](#-karar-rehberi-hangi-durumda-hangisi)
10. [📎 Ek: Puanlama Rubriği](#-ek-puanlama-rubriği)

---

## ⚡ TL;DR — 60 saniyelik özet

| Soru | Cevap |
|------|-------|
| 🔴 Limit nerede? | **Modelin üretim anında.** `AskUserQuestion` built-in aracının sözleşmesi "1–4 soru / 2–4 şık". Hook ateşlemeden **önce** model zaten ≤4 soruluk bir çağrı üretmiş oluyor. |
| 🟢 Tesisat (bridge/server/web) limitli mi? | **Hayır.** `server.js` soru dizisini `q.length > 0` ile kabul eder, **üst sınır yok** (yalnızca 1 MB gövde sınırı). UI bir akış + sidebar; N soruyu zaten render edebilir. |
| 🎯 Asıl problem nedir? | "300 soruyu taşımak" değil — **"modelin 300 soruyu tek bir tetikleyiciyle ifade etmesini sağlamak."** |
| 🏆 Önerilen çözüm | **#1 Özel MCP aracı (`ask_many`)** çekirdek, üstüne **#7 Hibrit** (≤4 native hook, >4 MCP). Mevcut bridge/server/web %90 aynen kullanılır. |
| ⚠️ En büyük risk | Mimari değil — **modeli yönlendirme**: model içgüdüsel olarak `AskUserQuestion`'a uzanır; yeni aracı kullanması için tool description + CLAUDE.md yönlendirmesi şart. |

**Sıralama (ağırlıklı puan / 65):**

```
🥇 #7  Hibrit (native ≤4 + MCP >4) ........ 58.0
🥈 #1  Özel MCP aracı (ask_many) .......... 56.5
🥉 #6  Skill + CLI (Bash köprüsü) ......... 51.5
   #9  Dosya-izleme (Write/Read) .......... 46.5
   #10 SDK/wrapper (harness değiştir) ..... 46.0
   #2  Sentinel + dosya referansı ......... 45.5
   #8  PreToolUse deny+yönlendir (eklenti). 43.0
   #4  Çoklu çağrı birleştirme ............ 38.0
   #3  Satır-içi JSON blob ................ 37.5
   #5  MCP elicitation .................... 30.0
```

---

## 🧩 Problem Anatomisi — limit tam olarak nerede?

### Mevcut mutlu yol (bugünkü mimari)

```
 Claude Code        Hook (mjs)        Server(4517)      Bridge        Tarayıcı UI
     │                  │                   │              │               │
     │  AskUserQuestion │                   │              │               │
     │  (≤4 soru!) ────►│ POST /ask ───────►│ submit ─────►│ _pending      │
     │                  │ (long-poll asılı) │              │ broadcast ───►│ render
     │                  │                   │              │               │ kullanıcı seçer
     │                  │                   │ POST /answer ◄──────────────│
     │◄── updatedInput ─│◄── 200 {answers} ─│ resolve ◄────│               │
     │  permission:allow│                   │              │               │
     ▼                  ▼                   ▼              ▼               ▼
```

Bu zincirde **soru sayısını kim sınırlıyor?** Cevap kritiktir 👇

### Limit, zincirin EN BAŞINDA — model katmanında

```
   ┌─────────────────────────────────────────────────────────────────────┐
   │ 1) MODEL  "soru sormam lazım" der                                     │
   │    └─ AskUserQuestion tool_schema: questions[] · "1–4 soru, 2–4 şık" │
   │       ╳╳╳ DUVAR BURADA ╳╳╳   model >4 soruluk çağrı ÜRETEMEZ          │
   ├─────────────────────────────────────────────────────────────────────┤
   │ 2) Claude Code aracı doğrular → tool_input = { questions: [≤4] }      │
   ├─────────────────────────────────────────────────────────────────────┤
   │ 3) PreToolUse HOOK ateşler → stdin'de zaten ≤4 soru var ✅ (geç kaldı)│
   ├─────────────────────────────────────────────────────────────────────┤
   │ 4) Bridge / Server / Web → SINIR YOK, 300 soruyu seve seve işler ✅   │
   └─────────────────────────────────────────────────────────────────────┘
```

> 🔑 **Hook çok geç bir noktada.** Hook'a JSON geldiğinde model çoktan ≤4 soruluk
> bir çağrı üretmiş olur. Yani hook'u ne kadar akıllı yaparsan yap, **tek bir native
> `AskUserQuestion` çağrısı asla >4 soru taşıyamaz.** Bu yüzden "hook mantığını
> değiştirip 300 soru geçirmek" tek başına **imkânsızdır** — duvar daha yukarıda.

### context7 ile doğrulanan sözleşme (alıntı)

`/anthropics/claude-code` → `interactive-commands.md`:

> - Users can always choose "Other" to provide custom input (automatic)
> - `multiSelect: true` allows selecting multiple options
> - **Options should be 2–4 choices (not more)**
> - **Can ask 1–4 questions per tool call**

Ek doğrulamalar (yine context7):

- ✅ **PreToolUse `updatedInput` + `permissionDecision:"allow"`** → araç girdisini
  değiştirip native picker'ı atlamak resmî olarak destekli (zaten kullandığımız sözleşme).
- ✅ **Özel MCP stdio araçları** keyfi `inputSchema` ile tanımlanabilir → **4 limiti yok**.
- ✅ **Uzun-süren / bloklayan MCP araçları** desteklenir (`MCP_TIMEOUT`, "long operations" deseni).

### Neden "bölmek" çözüm değil?

```
   ❌ 4'erli turlar (mevcut davranışın doğal sonucu)
   ┌────┐   ┌────┐   ┌────┐          ┌────┐
   │ 4  │──►│ 4  │──►│ 4  │── ... ──►│ 4  │   = 300/4 ≈ 75 ayrı tur
   └────┘   └────┘   └────┘          └────┘
     │        │        │               │
   her tur: yeni model dönüşü + yeni hook süreci + bağlam kayması + kullanıcı yorgunluğu
```

- 🧠 **Bağlam (context) kayması:** Model her turda "neredeydim" diye yeniden düşünür; 75 tur = 75 kez bağlam yükü.
- 🐌 **Gecikme:** Her tur ayrı bir model→hook→UI gidiş-dönüşü.
- 😵 **Kullanıcı deneyimi:** 75 ayrı popup, tek bir "hepsini bir arada gör/düzenle/gönder" ekranı yok.
- 🧩 **Bütünsel cevaplama yok:** Kullanıcı 12. sorunun cevabını verirken 200. soruyu göremez → tutarsız cevaplar.

**Hedef:** Tek tetikleyici → tek UI oturumu → tüm sorular bir arada → tek "Submit".

---

## 💡 Kilit İçgörü — "tesisat zaten sınırsız"

askuseroz **native picker'ı zaten tamamen değiştiriyor.** Yani aslında native
`AskUserQuestion` aracına *bağımlı değiliz* — onu sadece **tetikleyici** olarak kullanıyoruz.

```
   ESKİ ZİHNİYET                          DOĞRU ZİHNİYET
   ─────────────                          ─────────────
   "AskUserQuestion'ı 300 soru            "Modelin 300 soruyu ifade edebileceği
    taşıyacak şekilde zorla"               YENİ bir tetikleyici ver; tesisatı
            ╳ duvara çarpar                 (bridge/UI) olduğu gibi kullan"
                                                   ✅ duvarı baypas eder
```

Bu içgörü tüm çözüm uzayını ikiye böler:

- 🟥 **Native aracı zorlayan yollar** (#2, #3, #4) → duvara karşı savaşır, kırılgan.
- 🟩 **Tetikleyiciyi değiştiren yollar** (#1, #6, #7, #9, #10) → duvarı baypas eder, sağlam.

> 💎 **Tek cümlelik tasarım ilkesi:** "Bridge ve UI dokunulmaz kalsın; sadece modelin
> N>4 soruyu tek seferde ifade edebileceği bir giriş kapısı aç."

---

## 🗺️ Çözüm Uzayının Haritası (taksonomi)

Modelin >4 soruyu bridge'e ulaştırması için **4 aile** vardır:

```
                         ┌──────────────────────────────────────┐
                         │  MODEL >4 SORUYU NASIL İFADE EDER?     │
                         └──────────────────────────────────────┘
                                          │
        ┌───────────────────┬─────────────┴───────────┬────────────────────┐
        ▼                   ▼                          ▼                    ▼
  🟩 A) YENİ TETİKLEYİCİ   🟥 B) NATIVE'İ KANDIR    🟨 C) ÇOKLU ÇAĞRI    🟦 D) HARNESS
     (tool/CLI/dosya)         (1 çağrıda gizle)        BİRLEŞTİR            DEĞİŞTİR
        │                      │                        │                    │
   #1 MCP aracı           #2 Sentinel+dosya         #4 Accumulator       #10 SDK/wrapper
   #6 Skill+CLI           #3 Satır-içi JSON                              
   #9 Dosya-izleme        #5 MCP elicitation*                           
   #7 Hibrit (A+native)   
   #8 deny+yönlendir (A'yı zorlayan eklenti)
```

\* MCP elicitation hem "yeni tetikleyici" hem "native mekanizma" özelliği taşır; pratikte zayıf (aşağıda).

---

## 📊 Karşılaştırma Tablosu + Sıralama

**Puanlama:** her boyut ⭐1–5 (yüksek = iyi). Ağırlıklar köşeli parantezte. Toplam /65.
Rubrik detayları → [Ek](#-ek-puanlama-rubriği).

| # | Çözüm | Kapsay.[×3] | Sağlam.[×2] | Model uyumu[×2] | Kolaylık[×1] | Mimari uyum[×1.5] | Bakım[×1] | UX/şeffaf[×1.5] | Sıfır-kurulum[×1] | **Toplam** |
|---|-------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **7** | 🥇 Hibrit (native ≤4 + MCP >4) | 5 | 5 | 4 | 3 | 5 | 4 | 5 | 3 | **58.0** |
| **1** | 🥈 Özel MCP aracı (`ask_many`) | 5 | 5 | 3 | 4 | 5 | 5 | 4 | 3 | **56.5** |
| **6** | 🥉 Skill + CLI (Bash köprüsü) | 5 | 3 | 4 | 4 | 4 | 4 | 3 | 4 | **51.5** |
| **9** | Dosya-izleme (Write/Read) | 5 | 3 | 3 | 4 | 3 | 3 | 2 | 5 | **46.5** |
| **10** | SDK / wrapper (harness) | 5 | 4 | 5 | 1 | 2 | 2 | 4 | 1 | **46.0** |
| **2** | Sentinel + dosya referansı | 5 | 2 | 3 | 3 | 4 | 2 | 3 | 5 | **45.5** |
| **8** | PreToolUse deny+yönlendir | 3 | 3 | 4 | 4 | 4 | 3 | 2 | 4 | **43.0** |
| **4** | Çoklu çağrı birleştirme | 4 | 2 | 2 | 2 | 3 | 2 | 3 | 5 | **38.0** |
| **3** | Satır-içi JSON blob | 2 | 2 | 3 | 4 | 4 | 2 | 3 | 5 | **37.5** |
| **5** | MCP elicitation | 2 | 2 | 3 | 2 | 2 | 3 | 2 | 3 | **30.0** |

> 📌 **Okuma notu:** #7 = #1 + mevcut hook. Yani teknik çekirdek **#1**; #7 onu
> "küçük setler de eskisi gibi sorunsuz çalışsın" diye sarmalar. İkisi rakip değil,
> **#1 → #7 bir olgunlaşma yoludur.**

---

## 📚 On Çözüm — Detaylı Analiz

---

### 🥈 #1 — Özel MCP Aracı (`ask_many`) — *tetikleyiciyi değiştir*

**Fikir:** Küçük bir yerel MCP stdio sunucusu yaz; tek bir araç sunsun:
`mcp__askui__ask` → `inputSchema = { questions: [...] }` (**üst sınır yok**).
Araç handler'ı mevcut `/ask` köprüsüne POST eder, `/answer` gelene kadar bloklar,
cevabı MCP tool result olarak modele döndürür. Model `AskUserQuestion` yerine bunu çağırır.

```
   Model ──"mcp__askui__ask({questions:[...300...]})"──► MCP server (stdio)
                                                              │
                                                    POST /ask │ (mevcut bridge!)
                                                              ▼
                                              Server(4517) → Bridge → Tarayıcı UI
                                                              ▲           │ kullanıcı seçer
                                                  /answer ◄───┴───────────┘
                                                              │
   Model ◄── tool_result {answers:{...300...}} ◄── MCP server resolve
```

**Nasıl çalışır (adımlar):**
1. `mcp-server/askui-mcp.mjs` — saf Node, MCP SDK ya da elle JSON-RPC (sıfır-bağımlılık tutulabilir).
2. Araç şeması: `questions` dizisi (her biri `{question, header, multiSelect, options[]}`), **maxItems yok**.
3. Handler: `ensureServer()` (mevcut spawn mantığı) → `POST /ask` long-poll → cevap → `return { content: answers }`.
4. Kayıt: `.mcp.json` ya da `claude mcp add askui -- node .../askui-mcp.mjs`.
5. Yönlendirme: araç açıklaması + `CLAUDE.md` → "Kullanıcıya çok sayıda (özellikle >4) soru sorман gerekiyorsa `mcp__askui__ask` kullan."

**✅ Artılar:**
- 🚀 **Gerçekten sınırsız** — 1 ya da 1000 soru, fark etmez (tasarımın doğal sonucu).
- ♻️ **%90 kod yeniden kullanım** — `server.js`, `bridge.js`, tüm `web/*` aynen kalır; sadece yeni bir giriş kapısı.
- 🧼 **Temiz sözleşme** — hack yok, sentinel yok; modelin gördüğü tool_result düzgün `{answers}`.
- 🧪 **Test edilebilir** — handler saf; mevcut test altyapısına eklenir.

**❌ Eksiler / Riskler:**
- 🧭 **Model yönlendirmesi şart** — model içgüdüsel `AskUserQuestion`'a uzanır; iyi bir `description` + `CLAUDE.md` olmadan yeni aracı es geçebilir. *(En büyük risk.)*
- 🔌 **MCP kaydı** — kullanıcı bir kez `claude mcp add` / `.mcp.json` adımı yapmalı (install.sh otomatikleştirebilir).
- ⏱️ **Uzun bekleme** — kullanıcı 300 soruyu cevaplarken araç bloklar; `MCP_TIMEOUT` / araç timeout'u yeterli ayarlanmalı (5 dk+).
- 🕶️ **"Görünmezlik" azalır** — native hook'ta model farkı anlamıyordu; MCP'de model açıkça "askui aracını" çağırır (zaten cevabı görmesi gerektiğinden bu pratikte sorun değil).

**📐 Puan kırılımı:** Kapsay.5 · Sağlam.5 · Model3 · Kolay4 · Mimari5 · Bakım5 · UX4 · Sıfır-kur.3 → **56.5**

**🎯 Ne zaman seç:** "En temiz, en sürdürülebilir, gerçek sınırsız çözüm istiyorum; bir kerelik MCP kurulum adımı kabul." (Önerilen çekirdek.)

---

### 🥇 #7 — Hibrit Router (native ≤4 + MCP >4) — *en iyi kapsama*

**Fikir:** #1'i çekirdek al, **mevcut PreToolUse hook'u da koru.** Yönlendirme kuralı:
küçük setler (≤4) eski yolla (native AskUserQuestion → hook → UI) sorunsuz aksın;
büyük setler (>4) `mcp__askui__ask` ile gelsin. İkisi de **aynı bridge/UI'yı** besler.

```
                    Model soru soracak
                          │
              ┌───────────┴────────────┐
         ≤4 soru?                   >4 soru?
              │                         │
   AskUserQuestion (native)      mcp__askui__ask
              │                         │
        PreToolUse hook            MCP server
              └──────────┬──────────────┘
                         ▼
              Aynı Server(4517) + Bridge + Web UI
```

**✅ Artılar:**
- 🎁 **Geriye dönük tam uyum** — bugünkü davranış (≤4) hiç bozulmadan, üstüne büyük-set yeteneği eklenir.
- 🪄 **Küçük setlerde sıfır-eforlu şeffaflık** — model zaten doğal `AskUserQuestion` kullanır, kullanıcı fark etmez.
- 📈 **Kademeli benimseme** — önce #1'i shiple, sonra hook'u router'a çevir; risk dağıtılır.
- 🏆 **En yüksek toplam puan** — kapsama + sağlamlık + UX dengesi.

**❌ Eksiler / Riskler:**
- 🧹 **İki kod yolu** — hem hook hem MCP bakımı (ama ikisi de aynı bridge'e indiğinden ortak çekirdek tek).
- 🧭 **Yine yönlendirme** — "ne zaman hangisi" kuralını `CLAUDE.md`'ye net yaz; sınır (4) belirsizse model kararsız kalır.
- 🔌 **Kurulum iki parçalı** — hem hook hem MCP kaydı (install.sh ikisini de yapabilir).

**📐 Puan kırılımı:** Kapsay.5 · Sağlam.5 · Model4 · Kolay3 · Mimari5 · Bakım4 · UX5 · Sıfır-kur.3 → **58.0**

**🎯 Ne zaman seç:** "Mevcut yatırımı koruyup üstüne sınırsızı eklemek istiyorum; en pürüzsüz kullanıcı deneyimi." (Genel kazanan — ama #1 üzerine inşa edilir.)

---

### 🥉 #6 — Skill + CLI (Bash köprüsü) — *MCP'siz tetikleyici*

**Fikir:** MCP yerine, küçük bir CLI komutu (`claude-askui ask --file q.json`) bridge'e
bloklayarak bağlanıp cevabı **stdout'a** bassın. Bir **skill** modele şunu öğretsin:
"Çok soru sorman gerekince soruları bir dosyaya yaz, sonra bu komutu Bash ile çalıştır,
çıktıdaki cevapları oku." Skill'ler model tarafından çağrılabilir.

```
   Model ──(skill tetiklenir)──► Write q.json ──► Bash: claude-askui ask --file q.json
                                                          │ (bloklar)
                                                  POST /ask → Bridge → UI → /answer
                                                          │
   Model ◄── Bash stdout: {answers JSON} ◄────────────────┘
```

**✅ Artılar:**
- 🆓 **MCP gerektirmez** — sadece mevcut `bin/cli.js`'e bir `ask` komutu + bir skill.
- ♾️ **Sınırsız** — CLI argümanı/dosya bağlı, üst sınır yok.
- 🧩 **Skill = model tarafından çağrılabilir** — açık, niyet belli.

**❌ Eksiler / Riskler:**
- 🔐 **Bash izin istemi** — her çağrıda permission prompt çıkar (allowlist ile çözülür ama bir kurulum yükü).
- 🪟 **Daha az "görünmez"** — Bash tool çağrısı transcript'te görünür; native akış kadar temiz değil.
- 🧭 **Skill seçimi modele bağlı** — skill'i doğru anda tetiklemesi için iyi `description`.

**📐 Puan kırılımı:** Kapsay.5 · Sağlam.3 · Model4 · Kolay4 · Mimari4 · Bakım4 · UX3 · Sıfır-kur.4 → **51.5**

**🎯 Ne zaman seç:** "MCP kaydından kaçınmak istiyorum, Bash izin istemine razıyım; en az yeni altyapı."

---

### #9 — Dosya-İzleme Tetikleyici (Write/Read protokolü) — *en saf, en MCP'siz*

**Fikir:** Hiç hook/MCP/araç yok. Bir daemon `.askui/pending.json`'ı izler. Model
`Write` ile N soruyu oraya bırakır → UI açılır → kullanıcı cevaplar → daemon
`.askui/answers.json` yazar → model `Read` ile cevapları okur.

```
   Model ─Write→ .askui/pending.json ─watch→ Server → UI
                                                        │ kullanıcı seçer
   Model ◄Read─ .askui/answers.json ◄write─ Server ◄────┘
```

**✅ Artılar:**
- 🪶 **En düşük altyapı** — sadece dosya + izleyici; saf `Write`/`Read` araçları.
- ♾️ **Sınırsız**, 🔒 **sıfır-kurulum etiğine en sadık** (no MCP, no Bash).

**❌ Eksiler / Riskler:**
- ⏳ **Bloklama yok** — model cevabı "beklemek" için tekrar tekrar `Read` etmeli (polling); akış hantal.
- 🏁 **Yarış koşulları** — pending/answers dosya senkronu; "cevap hazır mı" sinyali kırılgan.
- 🧭 **Protokol disiplini** — model tam olarak doğru dosya adlarını/sırayı izlemeli.

**📐 Puan kırılımı:** Kapsay.5 · Sağlam.3 · Model3 · Kolay4 · Mimari3 · Bakım3 · UX2 · Sıfır-kur.5 → **46.5**

**🎯 Ne zaman seç:** "Kesinlikle MCP de Bash de istemiyorum, polling'in hantallığına razıyım."

---

### #10 — SDK / Wrapper (harness'i değiştir) — *en güçlü kontrol, en ağır*

**Fikir:** Claude Agent SDK ile Claude Code'u sar; `AskUserQuestion`'ı **sınırsız**
kendi şemanla yeniden tanımla (custom tool / `canUseTool`). Model artık native değil,
**senin tanımladığın** sınırsız "ask" aracını görür.

**✅ Artılar:**
- 🧰 **Tam şema kontrolü** — limiti kelimenin tam anlamıyla kaldırırsın.
- 🤖 **Mükemmel model uyumu** — tek "ask" aracı senin; model doğal olarak onu kullanır.

**❌ Eksiler / Riskler:**
- 🏗️ **Çok büyük efor** — kullanıcının `claude`'u çalıştırma şekli değişir (SDK harness'i).
- 🔗 **Sıfır-kurulum etiğini bozar** — projenin en temel ilkesine aykırı.
- 🔧 **Bakım yükü** — SDK/CC sürüm değişikliklerini takip.

**📐 Puan kırılımı:** Kapsay.5 · Sağlam.4 · Model5 · Kolay1 · Mimari2 · Bakım2 · UX4 · Sıfır-kur.1 → **46.0**

**🎯 Ne zaman seç:** "askuseroz'u bağımsız bir ürün/harness'e dönüştürmek istiyorum; kurulum ağırlığı sorun değil." (Bu proje felsefesiyle çelişir.)

---

### 🟥 #2 — Sentinel + Dosya Referansı (native'i kandır) — *en iyi "native kalsın" hack'i*

**Fikir:** Model N soruyu `Write` ile bir dosyaya döker, sonra native `AskUserQuestion`'ı
**TEK** bir sentinel soruyla çağırır (örn. soru metni `__ASKUI_BATCH__:/path/q.json`).
PreToolUse hook sentinel'i tanır, dosyayı okur, **N soruyu** bridge'e verir, cevapları
`updatedInput.answers`'a koyar. Native çağrı yasal (1 soru), hook genişletir.

```
   Model ─Write→ q.json (300 soru)
   Model ─AskUserQuestion({questions:[{question:"__ASKUI_BATCH__:q.json"}]})─► hook
                                                                                │ dosyayı oku
                                                                       300 soru → Bridge → UI
   Model ◄ updatedInput{questions:300, answers:300} ◄──────────────────────────┘
```

**✅ Artılar:**
- 🎯 **Native tetikleyici korunur** — model içgüdüsel `AskUserQuestion`'ı kullanır.
- 🔌 **MCP gerektirmez** — sadece hook'a genişletme mantığı eklenir.
- ♾️ **Dosya bağlı sınırsız.**

**❌ Eksiler / Riskler:**
- 🧨 **Kırılgan iki-adım protokolü** — model önce Write sonra sentinel ask yapmalı; sırayı şaşırırsa bozulur.
- ❓ **`updatedInput` ile 1→N genişletme doğrulanmalı** — modelin gördüğü tool_result'ın gerçekten 300 cevabı içerip içermediği test edilmeli (belirsiz davranış).
- 🩹 **Hack kokusu** — sentinel string sözleşmesi; bakımı zor.

**📐 Puan kırılımı:** Kapsay.5 · Sağlam.2 · Model3 · Kolay3 · Mimari4 · Bakım2 · UX3 · Sıfır-kur.5 → **45.5**

**🎯 Ne zaman seç:** "MCP istemiyorum ama native akışı da korumak istiyorum; bir hack'e ve doğrulama işine razıyım."

---

### #8 — PreToolUse "deny + yönlendir" (eklenti) — *yalnız değil, zorlayıcı katman*

**Fikir:** Hook, model `AskUserQuestion`'ı (özellikle çok soru bağlamında) çağırınca
`permissionDecision:"deny"` + `systemMessage:"Bunun yerine mcp__askui__ask kullan"`
döner. Modeli doğru tetikleyiciye **zorlar.** Tek başına bir şey çözmez — #1/#6'nın
benimsenme riskini düşüren bir **yapıştırıcıdır.**

**✅ Artılar:**
- 🧲 **Güçlü yönlendirme** — modeli yeni araca iter; "model eski aracı kullanıyor" riskini söndürür.
- 🪶 **Hafif** — sadece hook'a bir dal.

**❌ Eksiler / Riskler:**
- 🚫 **Tek başına çözüm değil** — yönlendirdiği hedef (MCP/CLI) yoksa anlamsız.
- 😖 **deny döngüsü UX'i** — yanlış kurgulanırsa model takılıp kalabilir.

**📐 Puan kırılımı:** Kapsay.3 · Sağlam.3 · Model4 · Kolay4 · Mimari4 · Bakım3 · UX2 · Sıfır-kur.4 → **43.0**

**🎯 Ne zaman seç:** "#1/#7'yi seçtim ama modelin yeni aracı kullanacağına güvenmiyorum; garanti katmanı istiyorum." (Eklenti olarak değerli.)

---

### 🟨 #4 — Çoklu Çağrı Birleştirme (accumulator) — *native kalsın ama riskli*

**Fikir:** Model tek turda **çok sayıda paralel** `AskUserQuestion` çağrısı yapsın
(her biri ≤4). Bridge'i tek-uçuştan **biriktiriciye** çevir: kısa bir pencerede
(örn. 300 ms) gelen tüm setleri topla, **tek UI ekranında** birleştir; gönderimde
cevapları her bekleyen hook'a kimliğe göre dilimle.

```
   Model: [ask₁(4)] [ask₂(4)] ... [ask₇₅(4)]   (paralel, tek tur)
            │         │              │
          hook₁     hook₂   ...    hook₇₅       (75 ayrı süreç!)
            └────┬────┴──────────────┘
            accumulator (300ms pencere) → tek UI (300 soru) → submit
            └─ dilimle → her hook'a kendi cevap dilimi
```

**✅ Artılar:**
- 🎯 Native araç korunur; başarılıysa tek ekran.

**❌ Eksiler / Riskler:**
- 🎲 **Model gerçekten 75 paralel çağrı yapar mı?** Belirsiz; CC paralel AskUserQuestion'ı sınırlayabilir.
- 🧵 **75 ayrı hook süreci** + long-poll → kaynak ağır.
- 🏁 **Yarış/sıra belirsizliği** — debounce penceresi kırılgan; dilimleme hataya açık.
- 🔧 Bridge çekirdeği baştan yazılır (tek-uçuş sadeliği gider).

**📐 Puan kırılımı:** Kapsay.4 · Sağlam.2 · Model2 · Kolay2 · Mimari3 · Bakım2 · UX3 · Sıfır-kur.5 → **38.0**

**🎯 Ne zaman seç:** Önerilmez — yüksek karmaşıklık + düşük determinizm. (Tamamlık için listede.)

---

### 🟥 #3 — Satır-İçi JSON Blob (native'i kandır, dosyasız) — *küçük N için*

**Fikir:** #2 gibi ama dosyasız: model N soruyu tek bir `AskUserQuestion` sorusunun
`description`/option label'ına **JSON string** olarak gömer; hook parse edip açar.

**✅ Artılar:** Tek adım, dosyasız, native tetikleyici.

**❌ Eksiler / Riskler:**
- 📏 **Alan uzunluğu sınırı** — 300 soru bir description'a sığmaz; ~10–30 için sınırda.
- 🧨 Model elle JSON üretir → bozma riski yüksek; kaçış karakterleri kâbusu.

**📐 Puan kırılımı:** Kapsay.2 · Sağlam.2 · Model3 · Kolay4 · Mimari4 · Bakım2 · UX3 · Sıfır-kur.5 → **37.5**

**🎯 Ne zaman seç:** Yalnızca "biraz daha fazla soru" (≈10) yeterliyse ve hiçbir altyapı istemiyorsan. 300 için uygun değil.

---

### #5 — MCP Elicitation — *yanlış araç*

**Fikir:** MCP'nin `elicitation` yeteneği (sunucu→istemci, kullanıcıdan yapılandırılmış
girdi ister) ile soruları topla.

**❌ Neden zayıf:**
- 🧱 Elicitation şemaları **düz/basit** (string/enum/bool) — 300 zengin çok-seçimli soru için tasarlanmadı.
- ❓ Claude Code istemci desteği belirsiz/kısıtlı.
- 🎨 Bizim AMOLED UI'mızı kullanmaz; native elicitation formuna düşer → projenin tüm görsel değeri kaybolur.

**📐 Puan kırılımı:** Kapsay.2 · Sağlam.2 · Model3 · Kolay2 · Mimari2 · Bakım3 · UX2 · Sıfır-kur.3 → **30.0**

**🎯 Ne zaman seç:** Önerilmez. (Tamamlık için.)

---

## 🏗️ Ortak İş: 300 soruyu UI nasıl gösterecek?

> ⚠️ **Hangi tetikleyiciyi seçersen seç**, 300 soru bridge'e ulaştığında bugünkü
> **lineer akış UI'ı** zorlanır. Bu, tetikleyiciden **bağımsız ortak bir iş kalemidir.**

Bugünkü UI (`web/app.js` `Flow`) varsayımları:
- 📜 **Sidebar tüm soruları listeler** → 300 öğe = devasa kaydırma.
- ⌨️ **Klavye `1–9`** ile şık seçer → 9'dan fazla şıkta sorun (genelde ≤4 olduğundan tamam).
- ➡️ **Tek tek ilerleme** (`current` index) → 300 soruda "kartla tek tek" yorucu.

**Önerilen UI ölçekleme işleri (tetikleyiciden bağımsız):**

```
   ┌─ Gruplama/Bölüm (questions[].header ile) → katlanır accordion bölümler
   ├─ Sanal liste (virtualized) → 300 kartı DOM'a basmadan akıcı kaydırma
   ├─ Arama/filtre kutusu → "cevaplanmamışlara git", metinde ara
   ├─ İlerleme: "47 / 300 cevaplandı" + bölüm-bazlı yüzde
   ├─ Toplu işlemler → "tümünü varsayılana ayarla", "kalanları atla"
   └─ Tek "Review & Submit" → 300 cevabı özet + uçtan uca düzenle
```

🧪 Ayrıca: `server.js`'deki **1 MB gövde sınırı** 300 soruda kontrol edilmeli (muhtemelen
altında ama büyük `description`'larla sınıra yaklaşabilir → gerekirse limit yükselt).

> Bu işi seçilen çözümün uygulama planına bir **faz** olarak ekleyeceğiz.

---

## ✅ Öneri & Yol Haritası

### 🏆 Öneri: **#1 (çekirdek) → #7 (hibrit) + opsiyonel #8 (yapıştırıcı)**

**Neden:**
- 🎯 #1, "tetikleyiciyi değiştir" ailesinin en temizi; **gerçek sınırsız** + mevcut bridge/UI %90 korunur.
- 🥇 #7, #1'in üstüne mevcut hook'u koruyarak **en pürüzsüz UX** + **geriye dönük uyum** verir.
- 🧲 #8 (deny+yönlendir), modelin yeni aracı kullanma garantisini yükseltir (en büyük riski söndürür).

### 🗺️ Kademeli yol haritası

```
   FAZ 0  Doğrulama spike'ı
          └─ Küçük MCP aracı + 50 soru ile uçtan uca kanıt (bridge dokunmadan)
   FAZ 1  #1 çekirdek
          ├─ mcp-server/askui-mcp.mjs (sıfır-bağımlılık)
          ├─ install.sh: claude mcp add / .mcp.json otomasyonu
          └─ CLAUDE.md + tool description yönlendirmesi
   FAZ 2  UI ölçekleme (ortak iş)
          ├─ accordion gruplama + virtualized liste
          ├─ arama/filtre + "cevaplanmamışa git"
          └─ 1MB gövde sınırı gözden geçir
   FAZ 3  #7 hibrit
          └─ mevcut PreToolUse hook'u router'a çevir (≤4 native, >4 MCP)
   FAZ 4  #8 yapıştırıcı (opsiyonel)
          └─ büyük-set bağlamında native AskUserQuestion → deny+yönlendir
   FAZ 5  Sağlamlaştırma
          └─ MCP_TIMEOUT, güvenli fallback değişmezi (Kural 1) korunur, testler
```

### 🔒 Korunacak değişmezler (proje ilkeleri)
- **Kural 1 — asla kilitleme:** Her hata yolu güvenli fallback'e düşmeli (MCP araç hatası → model devam edebilmeli).
- **Kural 2 — sıfır-bağımlılık/build:** MCP sunucusu saf Node çekirdeğiyle yazılabilir (elle JSON-RPC) → bağımlılık eklemeden.
- **Tek-uçuş bridge** semantiği korunur (aynı anda bir set); #4'ün aksine biriktirici karmaşıklığına girmeyiz.

---

## 🧠 Karar Rehberi (hangi durumda hangisi)

```
   "Bir kerelik MCP kurulumu kabul mü?"
        │
   EVET ├─► "Küçük setlerde native akış da korunsun mu?"
        │        ├─ EVET ─► 🥇 #7 Hibrit   (önerilen)
        │        └─ HAYIR ─► 🥈 #1 Saf MCP
        │
   HAYIR├─► "Bash izin istemine razı mıyım?"
        │        ├─ EVET ─► 🥉 #6 Skill + CLI
        │        └─ HAYIR ─► #9 Dosya-izleme (hantal ama saf)
        │
        └─► "Native AskUserQuestion'ı kesinlikle korumalıyım?"
                 └─► #2 Sentinel + dosya  (hack'e razıysan)

   "Modelin yeni aracı kullanmamasından korkuyorum"  → herhangi birinin üstüne #8 ekle
   "askuseroz'u bağımsız harness yapacağım"          → #10 SDK (ağır)
   "Sadece ~10 soru yetiyor, sıfır altyapı"           → #3 satır-içi JSON
   ❌ Kaçın: #4 (riskli/karmaşık), #5 (yanlış araç)
```

---

## 📎 Ek: Puanlama Rubriği

| Boyut | Ağırlık | 1 ⭐ (kötü) | 5 ⭐ (mükemmel) |
|-------|:------:|------------|----------------|
| **Kapsayıcılık** | ×3 | Sadece ~10 soru | Gerçekten sınırsız (300+) tek seferde |
| **Sağlamlık** | ×2 | Yarış/kırılgan protokol | Deterministik, test edilebilir |
| **Model uyumu** | ×2 | Model aracı es geçer | Model doğal/garanti kullanır |
| **Kolaylık (efor)** | ×1 | Büyük yeniden yazım | Küçük, mevcut koda ekleme |
| **Mimari uyum** | ×1.5 | Bridge/UI baştan yazılır | Mevcut bridge/UI aynen korunur |
| **Bakım** | ×1 | Hack/sentinel bağımlılığı | Tek temiz yol |
| **UX/şeffaflık** | ×1.5 | Hantal/görünür/polling | Pürüzsüz, tek ekran, tek submit |
| **Sıfır-kurulum etiği** | ×1 | SDK/harness ağırlığı | Saf Node, tek komut kurulum |

> **Ağırlık mantığı:** Kapsayıcılık projenin tek amacı (×3). Sağlamlık ve model-uyumu
> (×2) "çalışır mı / model kullanır mı" — fikrin pratiğe geçmesinin önkoşulu. UX ve
> mimari-uyum (×1.5) projenin var oluş sebebi (güzel arayüz) ve mevcut yatırımın korunması.
> Maks puan = 65.

---

### 🤝 Sıradaki adım

Sen bir çözüm (ya da kombinasyon) seç → onu **uygulama planına** (writing-plans) döküp
faz faz hayata geçirelim. Önerim: **#7 (çekirdeği #1) + #8 yapıştırıcı** — ama karar senin. 🚀
