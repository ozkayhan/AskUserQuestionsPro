---
baslik: "Sprint 3 — askuserquestionspro için 10 Özellik / Değişiklik Önerisi"
belge_turu: "Öneri & Önceliklendirme (feature proposal + scoring)"
proje: "askuseroz / askuserquestionspro"
olusturulma_tarihi: "2026-06-23"
olusturulma_saati: "16:01 (+03 / Europe-Istanbul)"
yazar: "Claude (Opus 4.8, Conductor workspace: cody)"
kaynak_dokumanlar:
  - "living_docs/PURPOSE.md"
  - "living_docs/ARCHITECTURE.md"
  - "living_docs/THEMES.md"
amac: >
  living_docs'taki mimari ve amaç dokümanları baştan sona okunarak, projenin
  bilinçli kısıtlarına (sıfır npm bağımlılığı, sıfır build adımı, yalnızca-yerel
  127.0.0.1, "Kural 1: asla araya girip bozma" güvenli fallback, tek-uçuş
  randevu) saygı gösteren, fizibilitesi doğrulanmış 10 geliştirme önerisini
  kategorize ederek, gerekçelendirerek ve aynı standartta 10 üzerinden
  puanlayarak sunmak. Sprint 3 planlaması için karar girdisi olarak hazırlandı.
kapsam_disi: >
  Mimarinin altın kurallarını ihlal eden öneriler (yeni runtime bağımlılığı
  ekleyen, build adımı getiren, sunucuyu ağa açan veya Claude Code'u kilitleme
  riski taşıyan fikirler) bilinçli olarak elenmiştir.
versiyon: "1.0"
durum: "Taslak — gözden geçirme bekliyor"
---

# Sprint 3 — askuserquestionspro için 10 Özellik / Değişiklik Önerisi

> **Bu belge nedir?** `living_docs/` (PURPOSE, ARCHITECTURE, THEMES) tamamen
> okunduktan sonra hazırlanmış, projeye eklenebilecek 10 somut iyileştirme
> önerisi. Her öneri kategorize edilmiş, gerekçelendirilmiş, fizibilitesi
> kontrol edilmiş ve **aynı rubrik** ile puanlanmıştır. Amaç Sprint 3 için
> önceliklendirilmiş bir backlog vermektir.

---

## Puanlama rubriği (hepsi aynı standart)

Tüm öneriler **5 boyutta, 1–10 arası, yüksek = iyi** ölçeğinde puanlanır.
Boyutlar ve ağırlıkları:

| Boyut | Kısaltma | Ne ölçer | Ağırlık |
|-------|----------|----------|---------|
| Kullanıcı Değeri | **KD** | Son kullanıcıya / "iş büyüklüğüne karşı katacağı değer büyüklüğüne" net katkı | 0.30 |
| Teknik Fizibilite | **TF** | Mevcut mimaride ne kadar pürüzsüz oturduğu (10 = çok kolay oturur) | 0.15 |
| Düşük Efor | **DE** | İşin küçüklüğü (10 = çok az iş, 1 = büyük iş) | 0.15 |
| Güvenlik / Sağlamlık | **GS** | Kodu/sistemi ne kadar güvenli ve sağlam yaptığı | 0.20 |
| Mimari Uyum | **MU** | Sıfır-dep + sıfır-build + Kural 1 ile uyum (10 = hiç ihlal yok) | 0.20 |

**Öncelik Puanı** = ağırlıklı ortalama (10 üzerinden). Yüksek = daha öncelikli.

---

## Özet tablo (Öncelik Puanına göre sıralı)

| # | Öneri | Kategori | KD | TF | DE | GS | MU | **Öncelik** |
|---|-------|----------|----|----|----|----|----|-------------|
| 3 | Cevap taslağı otomatik kaydetme (localStorage) | UI-UX / Reliability | 8 | 9 | 8 | 7 | 9 | **8.15** |
| 4 | Çapraz platform tarayıcı açma (Linux/Windows) | Portability / New Feature | 7 | 9 | 9 | 5 | 9 | **7.60** |
| 6 | Erişilebilirlik: ARIA + odak yönetimi + ekran okuyucu | Accessibility / UI-UX | 7 | 8 | 6 | 6 | 9 | **7.20** |
| 1 | Yerel istek doğrulama token'ı (CSRF / rebind koruması) | Security | 5 | 8 | 7 | 9 | 8 | **7.15** |
| 10 | Gönderim öncesi validasyon (required / min-max select) | New Feature / UX | 7 | 8 | 7 | 6 | 8 | **7.15** |
| 2 | Disk snapshot ile çökme/kopuş kurtarma | Reliability / New Feature | 6 | 7 | 6 | 8 | 8 | **6.95** |
| 7 | Sistem teması auto (`prefers-color-scheme`) + tema genişletme | Design | 6 | 9 | 8 | 4 | 9 | **6.95** |
| 5 | Native serbest metin / sayı / tarih giriş tipleri | New Feature | 8 | 7 | 6 | 5 | 7 | **6.75** |
| 9 | Opt-in yerel debug log + zengin `/health` | Observability / DevEx | 4 | 9 | 8 | 7 | 8 | **6.75** |
| 8 | Soru/şık metninde güvenli markdown + kod render | UI-UX | 7 | 6 | 5 | 4 | 6 | **5.75** |

> Numaralar öneri kimliğidir (aşağıdaki detaylarla eşleşir), tablo sırası öncelik sırasıdır.

---

## Detaylı öneriler

Her öneri şu şablonda: **Kategori → Ne → Neden (net fayda) → Nasıl (fizibilite) → Riskler → Puanlama.**

---

### Öneri 1 — Yerel istek doğrulama token'ı
**Kategori:** Security · **Öncelik: 7.15**

**Ne:** Sunucu (`server/server.js`) ayağa kalkarken `crypto.randomUUID()` ile bir
oturum token'ı üretir; bu token'ı yalnızca aynı makinedeki güvenilen taraflar
(hook, MCP server, ilk açılan `index.html`) bilir. `/ask`, `/answer` ve `/events`
uçları token'ı (header veya `index.html`'e enjekte edilen değer üzerinden) doğrular;
eşleşmeyen istekleri `403` ile reddeder.

**Neden (net fayda):** Bugün sunucu `127.0.0.1:4517`'de doğrulamasız dinliyor.
Aynı makinede çalışan **herhangi** bir yerel süreç ya da kullanıcının tarayıcısında
açık **kötü niyetli bir web sayfası** (DNS-rebinding / `localhost` POST'u ile) teorik
olarak `/answer`'a sahte cevap basabilir veya `/current` ile bekleyen soruları
okuyabilir. Bu, ARCHITECTURE.md'de zaten sayılan güvenlik önlemlerinin (boyut
koruması, path traversal koruması) mantıksal devamıdır. **Fayda: bir güven sınırını
sıkılaştırır** — kullanıcı cevaplarının ve soru içeriğinin yalnızca gerçek
köprü tarafından okunup yazılabilmesini garanti eder. Kod güvenliği ölçülebilir
biçimde artar.

**Nasıl (fizibilite — yapılabilir):** Sıfır yeni bağımlılık; `crypto` Node
çekirdeğinde. Token sunucu başlangıcında üretilip `lib/bridge-client.mjs`'in
`ensureServer()` dönüşünde paylaşılır (hook ve MCP zaten bu modülü kullanıyor →
DRY noktası hazır). Web tarafına `index.html` servis edilirken küçük bir
`<meta>`/inline değişken olarak basılır. ~40-60 satırlık dağıtık ama mekanik bir
değişiklik.

**Riskler / dikkat:** Token'ın ilk açılışta web'e ulaştırılması ile `?theme=`
gibi paylaşılabilir-link senaryoları çakışmamalı. Kural 1 korunur: doğrulama
başarısız olursa hook yine `exit(0)` ile native picker'a düşebilir.

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 5 | 8 | 7 | 9 | 8 |

---

### Öneri 2 — Disk snapshot ile çökme/kopuş kurtarma
**Kategori:** Reliability / New Feature · **Öncelik: 6.95**

**Ne:** Bridge bekleyen soru setini (`_pending.questions` + henüz gelmiş kısmi
cevaplar değil, sadece sorular ve tur `id`'si) `os.tmpdir()` altına atomik bir
JSON snapshot olarak yazar. Sunucu yeniden başladığında bu snapshot okunur;
tarayıcı tekrar bağlandığında soru seti kaybolmadan SSE ile yeniden yayınlanır.

**Neden (net fayda):** Bugün her şey RAM'de (ARCHITECTURE §2: "tek-uçuş randevu").
Sunucu süreci çökerse ya da kazara öldürülürse, **kullanıcı uzun bir soru setinin
ortasındayken tüm bağlam kaybolur** ve hook timeout'a düşer. Büyük setlerde
(`mcp__askuserquestionspro__ask` ile onlarca soru) bu gerçek bir veri/emek kaybıdır.
**Fayda: sağlamlık** — uzun oturumlar dayanıklı hale gelir, "yarım kalan iş"
restart'tan sağ çıkar.

**Nasıl (fizibilite):** `fs` native. Atomik yazım için `write tmp + rename` deseni
(stdlib, tek satır mantığı). Snapshot yalnızca soruları içerir (cevaplar UI
tarafında — bkz. Öneri 3), bu yüzden gizlilik yüzeyi küçük. Çözüldüğünde/iptalde
snapshot silinir.

**Riskler / dikkat:** Tek-uçuş değişmezini bozmamalı (snapshot yalnızca tek seti
tutar). Eski/yabancı snapshot'a güveni önlemek için app-kimliği + zaman damgası
gömülmeli (repo'da `lib/app-id.cjs` + `/health` app kimliği deseni zaten mevcut,
aynı yaklaşım kullanılır).

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 6 | 7 | 6 | 8 | 8 |

---

### Öneri 3 — Cevap taslağı otomatik kaydetme (localStorage)
**Kategori:** UI-UX / Reliability · **Öncelik: 8.15 (en yüksek)**

**Ne:** Kullanıcının verdiği kısmi cevaplar (`answers` state'i — seçimler,
"Other" textarea metni) tur `id`'sine anahtarlı olarak `localStorage`'a anlık
yazılır. Sayfa kazara yenilenirse, SSE remount olursa (B10 tur-başına remount)
veya tarayıcı kapanıp açılırsa, **aynı tur için** taslak geri yüklenir.

**Neden (net fayda):** En sık yaşanacak "ah hayır" anı budur: kullanıcı 30 soruluk
bir sette 20 soru cevaplamış, sekmeyi yanlışlıkla yenilemiş — hepsi gider. THEMES
sistemi zaten `localStorage` kullanıyor (`askuserquestionspro_theme`), yani desen kanıtlı ve
sıfır maliyetli. **Fayda: doğrudan kullanıcı deneyimi + emek kaybını önleme.**
Tüm önerilerin içinde son kullanıcının her gün hissedeceği en somut kazanç.

**Nasıl (fizibilite — çok kolay):** Saf web tarafı; `app.js`'teki `Flow` state'ine
bir `useEffect` ile `localStorage.setItem` ve mount'ta `getItem`. Tur `id`'si
anahtar (`id` değişince eski taslak yok sayılır → yanlış sete sızma olmaz).
Gönderim başarılı olunca taslak temizlenir. ~20-30 satır, yeni dosya bile gerekmez.

**Riskler / dikkat:** Yanlış tura taslak uygulamamak için `id` eşleşmesi şart
(zaten mevcut monoton `id` ile çözülür). Hassas cevaplar diskte kalmasın diye
gönderimde/iptalde temizlik.

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 8 | 9 | 8 | 7 | 9 |

---

### Öneri 4 — Çapraz platform tarayıcı açma
**Kategori:** Portability / New Feature · **Öncelik: 7.60**

**Ne:** `lib/bridge-client.mjs`'teki `openBrowser()` şu an macOS'a özgü `open`
komutunu kullanıyor (PURPOSE §5: "macOS varsayımı"). Platforma göre dallanma:
`darwin → open`, `win32 → start`, diğer → `xdg-open`.

**Neden (net fayda):** Bugün proje fiilen yalnızca macOS'ta çalışıyor. Linux ve
Windows'taki Claude Code kullanıcıları için bu küçük satır, **aracın hiç
çalışmaması ile sorunsuz çalışması arasındaki tek fark.** Potansiyel kullanıcı
kitlesini katlar. **Fayda: erişilebilir kullanıcı tabanını genişletir**, neredeyse
hiç koda mal olmadan.

**Nasıl (fizibilite — neredeyse tek satır):** `process.platform` Node çekirdeğinde.
3 dallı bir `switch`/ternary. `install.sh`'in `bash`/`jq`/`open` varsayımları ayrı
bir konu (Windows için ileride dokümantasyon notu yeterli) — runtime tarafı bu
değişiklikle taşınabilir olur.

**Riskler / dikkat:** `start` Windows'ta argüman tırnaklamasında nazlıdır
(`start "" "url"`). Test edilebilir bir `pickOpenCmd(platform)` saf fonksiyonu
olarak çıkarılırsa birim testlenebilir.

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 7 | 9 | 9 | 5 | 9 |

---

### Öneri 5 — Native serbest metin / sayı / tarih giriş tipleri
**Kategori:** New Feature · **Öncelik: 6.75**

**Ne:** Soru şeması bugün yalnızca çoktan seçmeli + "Other" textarea destekliyor.
Şemaya opsiyonel bir `inputType` alanı (`text` | `number` | `date`) eklenip UI'da
**native `<input>`** olarak render edilmesi (CSS picker yok, kütüphane yok).

**Neden (net fayda):** Bazı netleştirme soruları seçenek listesine sığmaz: "Hedef
port numarası?", "Son tarih?", "Branch adı?". Bugün model bunları ya seçeneklere
zorluyor ya "Other"a düşüyor. Native input bunu doğal kılar. **Fayda: aracın
ifade gücü genişler** — daha fazla soru tipi tek UI oturumunda toplanabilir, ki
projenin tüm değer önermesi "tek oturumda topla".

**Nasıl (fizibilite):** Ladder'ın 3. basamağı — native platform özelliği
(`<input type="date">` bir picker kütüphanesine üstün). `answer-map.js`'in
`mapAnswers` sözleşmesi `string` değeri zaten döndürebiliyor; serbest girdi
oraya `answers[q] = value` olarak akar. Esas iş UI render + `decideActivate`
mantığının bu tipler için kısa-devre yapması.

**Riskler / dikkat:** `answer-map.js` saf mantığı genişlediği için regresyon
testleri güncellenmeli (mevcut test kültürü buna uygun). Şema değişikliği MCP
`inputSchema`'ya da yansır — geriye dönük uyum: alan opsiyonel kalır.

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 8 | 7 | 6 | 5 | 7 |

---

### Öneri 6 — Erişilebilirlik: ARIA + odak yönetimi + ekran okuyucu
**Kategori:** Accessibility / UI-UX · **Öncelik: 7.20**

**Ne:** UI'a erişilebilirlik temelleri: şık listelerine `role="radiogroup"` /
`role="listbox"`, aktif soruya odak taşıma, "Other" popup'ı açılınca focus-trap,
SSE ile gelen yeni içerik için `aria-live` bölgesi, görünür odak halkaları
(`:focus-visible`).

**Neden (net fayda):** Arayüz tamamen klavyeyle çalışacak şekilde tasarlanmış
(`1–4`, `← →`, `u`) ama bu klavye desteği ekran okuyucu / odak semantiği ile
eşlenmemiş. Ponytail bile a11y temellerini "asla atlama" listesine koyar.
**Fayda: kullanılabilirlik herkese genişler** ve klavye-öncelikli mevcut tasarımla
zaten felsefi olarak hizalı — eksik olan sadece semantik etiketler.

**Nasıl (fizibilite):** Saf JSX/CSS; yeni dosya/dep yok. `views.js` bileşenlerine
ARIA öznitelikleri + `app.js`'te bir `useEffect` ile soru değişiminde `ref.focus()`.
Token sistemine dokunmadan `:focus-visible` stilleri `styles.css`'e eklenir.

**Riskler / dikkat:** Focus-trap'i yanlış kurmak klavye akışını bozabilir;
mevcut klavye kısayollarıyla çakışmamalı. Headless görsel doğrulama (THEMES'te
kurulu harness deseni) ile spot-check.

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 7 | 8 | 6 | 6 | 9 |

---

### Öneri 7 — Sistem teması auto + tema genişletme
**Kategori:** Design · **Öncelik: 6.95**

**Ne:** Tema seçicisine "System" seçeneği: `window.matchMedia('(prefers-color-scheme: light)')`
ile işletim sistemi tercihine göre AMOLED ↔ Paper (veya uygun açık tema) otomatik
geçiş. Ayrıca THEMES.md'nin "ileride yüzlerce tema" hedefi doğrultusunda 1-2 yeni
delta-tema (registry zaten buna hazır).

**Neden (net fayda):** Kullanıcının sistemini gece moduna alması arayüze yansımıyor;
manuel seçim gerekiyor. `prefers-color-scheme` native bir platform sinyali. **Fayda:
kullanıcı deneyimi inceliği** — arayüz kullanıcının ortamına saygı gösterir, "flaş
yok" açılış kuralı (THEMES) korunur.

**Nasıl (fizibilite — kolay):** Native media query, sıfır dep. `web/themes.js`
registry'sine "system" pseudo-tema + `matchMedia` dinleyicisi. Yeni temalar zaten
"`LIST`'e delta nesne ekle" kadar basit (THEMES "Yeni tema nasıl eklenir"). Test:
mevcut `themes.test.js` token sözleşmesi yeni temaları otomatik denetler.

**Riskler / dikkat:** "System" seçimi `localStorage` persistansıyla çakışmamalı
(seçim = "system" ise media query kazanır). Güvenlik/sağlamlık katkısı düşük —
saf kozmetik/UX iyileştirmesi.

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 6 | 9 | 8 | 4 | 9 |

---

### Öneri 8 — Soru/şık metninde güvenli markdown + kod render
**Kategori:** UI-UX · **Öncelik: 5.75 (en düşük — dikkatle)**

**Ne:** Soru metni ve şık açıklamalarında küçük bir **güvenli markdown alt kümesi**
(inline `kod`, **kalın**, `*italik*`, satır sonu) render etmek. Tam markdown değil
— yalnızca okunabilirliği artıran birkaç işaret.

**Neden (net fayda):** Model soruları sık sık dosya yolu, fonksiyon adı veya kısa
kod parçası içerir; bunlar düz metin olarak okunması zor. Monospace render
netleştirme sorularını daha okunur kılar. **Fayda: okunabilirlik / UX**, özellikle
teknik soru setlerinde.

**Nasıl (fizibilite — orta, dikkatli):** Sıfır-dep kuralı tam markdown
kütüphanesini yasaklar; bu yüzden **küçük, kasıtlı kısıtlı** bir tokenizer (birkaç
regex, yalnızca whitelisted etiketler). Bu önerinin asıl maliyeti güvenliktir:
**XSS yüzeyi açar.** Bu nedenle yalnızca `textContent`/whitelist tabanlı,
`innerHTML` kullanmayan bir yaklaşım kabul edilebilir.

**Riskler / dikkat:** En düşük puanın sebebi: yanlış yapılırsa güvenlik açığı
(GS=4) ve sıfır-dep kısıtı işi büyütür (DE=5). Eğer "el yazımı parser" çok
genişlerse Kural "sıfır build/dep" ruhunu zorlar. **Öneri: ya çok dar tut, ya da
maliyet/fayda Sprint 3'te yeniden tartışılsın.**

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 7 | 6 | 5 | 4 | 6 |

---

### Öneri 9 — Opt-in yerel debug log + zengin `/health`
**Kategori:** Observability / DevEx · **Öncelik: 6.75**

**Ne:** `ASKUI_DEBUG` truthy olduğunda hook/MCP/server kilit olayları
(`spawn`, `409`, `timeout`, `fallback` sebebi) `os.tmpdir()` altındaki bir log
dosyasına satır-satır yazılır. `/health` çıktısı app kimliği + versiyon + uptime
+ son fallback sebebi ile zenginleştirilir.

**Neden (net fayda):** Kural 1 gereği sistem hata anında **sessizce** native
picker'a düşüyor — bu mükemmel UX ama **teşhis için kabus**: "neden özel UI
açılmadı?" sorusunun cevabı görünmez. Opt-in log bunu görünür kılar. **Fayda:
sağlamlık + geliştirici deneyimi** — sorunlar tahmin yerine kanıtla çözülür.

**Nasıl (fizibilite — kolay):** `fs.appendFileSync`, native. Varsayılan kapalı
(opt-in), yani normal kullanıcı hiç etkilenmez ("Kural 1" ihlali yok). `/health`
zenginleştirmesi repo'daki mevcut app-kimliği desenine (`lib/app-id.cjs`) eklenir.

**Riskler / dikkat:** Log'a hassas cevap içeriği yazılmamalı (yalnızca olay/sebep
metadatası). Düşük KD çünkü son kullanıcı doğrudan görmez — değeri bakım/destek
tarafında.

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 4 | 9 | 8 | 7 | 8 |

---

### Öneri 10 — Gönderim öncesi validasyon (required / min-max select)
**Kategori:** New Feature / UX · **Öncelik: 7.15**

**Ne:** Soru şemasına opsiyonel `required` ve multiSelect için `minSelect`/`maxSelect`
alanları. Review/Summary ekranında kurallar ihlal edilmişse gönderim engellenir,
eksik soru vurgulanır ve oraya atlama sunulur (mevcut "sonraki cevaplanmamışa atla"
altyapısı yeniden kullanılır).

**Neden (net fayda):** Büyük setlerde (N>8) kullanıcının yanlışlıkla bir soruyu
atlaması kolay; model eksik cevapla geri döner ve tur boşa gider. Validasyon bunu
gönderimden **önce** yakalar. **Fayda: veri kalitesi + daha az ileri-geri** —
modelin doğru bağlamı ilk seferde alması, projenin "netleştirmeyi hızlandır"
amacını doğrudan güçlendirir.

**Nasıl (fizibilite):** `answer-map.js`'e saf bir `validate(questions, state)`
fonksiyonu (test edilebilir, mevcut test kültürüne uygun). UI'da Summary'de
gönder düğmesini koşullandırma. Şema alanları opsiyonel → geriye dönük tam uyum.
B-serisi UI ölçekleme özellikleriyle (atla/filtrele) doğal birleşir.

**Riskler / dikkat:** Validasyon asla Kural 1'i bozup gönderimi tümden
kilitlememeli — kullanıcı yine de iptal edip native'e düşebilmeli. Aşırı katı
kurallar UX'i bozar; varsayılan "hiçbir şey zorunlu değil" olmalı.

| KD | TF | DE | GS | MU |
|----|----|----|----|----|
| 7 | 8 | 7 | 6 | 8 |

---

## Sprint 3 için önerilen sıralama (yorum)

- **İlk dalga (hızlı kazanç, düşük risk):** Öneri 3 (autosave), 4 (çapraz platform),
  7 (sistem teması) — hepsi saf-web/tek-satır sınıfı, yüksek değer/efor oranı.
- **İkinci dalga (sağlamlık & güven):** Öneri 1 (token), 9 (debug log), 2 (snapshot),
  6 (a11y) — sistemi daha güvenli ve dayanıklı yapar, orta efor.
- **Üçüncü dalga (ifade gücü):** Öneri 5 (input tipleri), 10 (validasyon) — şemayı
  genişletir, test güncellemesi gerektirir.
- **Tartışmalı:** Öneri 8 (markdown) — sıfır-dep + XSS gerilimi nedeniyle ya çok
  dar kapsamla yapılsın ya ertelensin.

> **Değişmez:** Hiçbir öneri "Kural 1" (asla araya girip bozma) ve "Kural 2"
> (sıfır kurulum yükü) ilkelerini ihlal etmemek üzere tasarlanmıştır. Her öneri
> başarısızlık durumunda mevcut güvenli fallback davranışını korur.
