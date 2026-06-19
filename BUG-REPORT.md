# askuseroz — Kapsamlı Hata Raporu

> Tarih: 2026-06-11 (ilk rapor) · Güncelleme: 2026-06-15 · Yöntem: tüm kaynak kod
> statik inceleme + hedefli dinamik doğrulama (`node --test`, izole portta server,
> hook payload simülasyonu, jq idempotency simülasyonu, spawn ENOENT testi). Test
> seti şu an **44/44 geçiyor** (B18 ile styles.css ↔ KNOWN_TOKENS testi eklendi).
>
> **Güncel durum (2026-06-15):** Aşağıdaki bulguların çoğu çözüldü — durum
> sütununa bak. Çözülenler: B4, B6, B7, B8, B10, B13, B14, B16, B17, B18 (ve hook
> tarafı B5/B9). Açık kalan düşük öncelikliler: B1/B2 (install.sh curl yolu),
> B11, B12, B15.

## Şiddet özeti

| # | Şiddet | Bileşen | Tek cümle | Durum |
|---|--------|---------|-----------|-------|
| B1 | 🔴 MAJOR | install.sh | `curl \| bash` kurulumu hook'u silinen temp dizine yazar → kurulum anında bozuk | Kod-aşikâr |
| B2 | 🔴 MAJOR | install.sh | Idempotent değil; her çalıştırmada bir kopya daha → çift/çakışan hook (#15897) | **Doğrulandı** |
| B3 | 🔴 MAJOR | server / web | Hook kopması/timeout sonrası SSE'ye `null` push edilmez → tarayıcı ölü soruyu gösterir | **Doğrulandı** |
| B4 | 🔴 MAJOR | web (answer-map) | multiSelect'te "Other" bir kez kaydedilince geri alınamaz (deselect yolu yok) | ✅ **Çözüldü** (savePopupState: boş metin → custom kaldırılır) |
| B5 | 🟠 MEDIUM | hook | `process.exit(0)` stdout'u flush etmeden keser → büyük payload yarım gider | **Doğrulandı** |
| B6 | 🟠 MEDIUM | web (live/app) | `postAnswers` HTTP yanıtını/hatasını yutar + iyimser "submitted" → sessiz veri kaybı | Kod-aşikâr |
| B7 | 🟠 MEDIUM | install | Hook komutu tırnaksız (`node /yol/...`) → kurulum yolunda boşluk varsa çalışmaz | ✅ **Çözüldü** (`bin/install.js`: `node "${hook}"`) |
| B8 | 🟠 MEDIUM | web (app/views) | Boş/eksik cevapla "Submit" serbest → Claude'a `answers: {}` gider | ✅ **Çözüldü** (boş submit guard + `canSubmit`/`disabled`) |
| B9 | 🟠 MEDIUM | hook | Linux/Windows'ta `open` yok → unhandled `error` → hook çöker (exit 1) | **Doğrulandı** |
| B10 | 🟠 MEDIUM | web (app) | Aynı metinli ardışık soru seti → React remount olmaz → eski "submitted" + klavye kilidi | Kod-aşikâr |
| B11 | 🟡 MINOR | web (app/views) | Aynı `question` metnine sahip iki soru → state çakışması + tekrar eden React key | Kod-aşikâr |
| B12 | 🟡 MINOR | web (app) | 9'dan fazla seçenekli soruda "Other" (ve 10.+ şık) klavyeden seçilemez | ⚠️ Açık (düşük öncelik — pratikte <9 şık; rakam kısayolu hâlâ 1–9) |
| B13 | 🟡 MINOR | hook | `main()` üst seviye `catch` yok → beklenmedik hata "her zaman exit(0)" değişmezini kırar | Kod-aşikâr |
| B14 | 🟡 MINOR | web (live) | SSE reconnect: unmount sırasında `setTimeout` iptal edilmez → orphan EventSource | Kod-aşikâr |
| B15 | 🟡 MINOR | server | Statik servis `startsWith(WEB_DIR)` sınır kontrolü zayıf (kardeş-dizin prefix) | Kod-aşikâr |
| B16 | 🟡 MINOR | web (app) | "confirmed" gönderim için kozmetik; armed ama onaylanmamış seçim de gönderilir | Kod-aşikâr |
| B17 | 🟡 MINOR | web (views) | Summary "Submit" butonu submitted sonrası da tıklanabilir (klavye korumalı, buton değil) | ✅ **Çözüldü** (`disabled={!canSubmit || submitted}` + submit double-guard) |
| B18 | 🟡 MINOR | docs/test | ARCHITECTURE §9 "test styles.css ↔ KNOWN_TOKENS eşleşmesini doğrular" — böyle test yoktu | ✅ **Çözüldü** (`test/themes.test.js`'e gerçek `:root` ↔ KNOWN_TOKENS birebir eşleşme testi eklendi) |

---

# MAJOR

## B1 — `curl | bash` kurulumu hook'u **silinen** geçici dizine yazar

**Dosya:** `install.sh:9-16`, `install.sh:19`, `install.sh:32-37`
**Şiddet:** MAJOR — README'deki **birincil/önerilen** kurulum yöntemi (tek satır
curl) kurulumdan saniyeler sonra bozulur.

### Nasıl oluşuyor
`curl | bash` ile çalışınca script repo'yu bir temp dizine indirir ve `DIR`'i
oraya işaret eder:

```bash
TMPDIR="$(mktemp -d)"
trap "rm -rf $TMPDIR" EXIT            # ← script ÇIKINCA temp dizini siler
...
DIR="$TMPDIR/AskUserQuestionsPro-main"
HOOK="$DIR/hooks/askuserquestionspro-bridge.mjs" # ← hook yolu temp dizinin İÇİNDE
```

Sonra `settings.json`'a `command: "node $HOOK"` yazılır; yani
`node /var/folders/.../AskUserQuestionsPro-main/hooks/askuserquestionspro-bridge.mjs`. Script
başarıyla bitince `trap ... EXIT` tetiklenir ve **bütün temp dizini (hook dahil)
silinir**. Geriye `settings.json` içinde **var olmayan bir dosyaya** işaret eden
bir hook kalır.

### Nasıl denenir
```bash
curl -fsSL https://raw.githubusercontent.com/ozkayhan/AskUserQuestionsPro/main/install.sh | bash
# kurulum "Bitti" der. Şimdi:
jq -r '.hooks.PreToolUse[] | select(.matcher=="AskUserQuestion") | .hooks[0].command' ~/.claude/settings.json
# → node /var/folders/xx/.../AskUserQuestionsPro-main/hooks/askuserquestionspro-bridge.mjs
ls -l "$(... yukarıdaki yol ...)"   # → No such file or directory
```
Yeni bir `claude` oturumunda her `AskUserQuestion`'da hook `node ENOENT` ile
başarısız olur; özel arayüz hiç açılmaz (sessizce native picker'a düşer).

### Teknik açıklama
`mktemp -d` + `trap EXIT` ile geçici çalışma alanı doğru, ama **kalıcı kurulum**
yapan bir script geçici alana **referans bırakamaz**. Hook'un kaynak dosyaları
kalıcı bir yere kopyalanmalı.

### Önerilen çözüm
Kalıcı bir kurulum dizinine kopyala ve hook'u oradan kaydet:

```bash
# curl | bash dalında:
INSTALL_DIR="$HOME/.local/share/askuserquestionspro"   # veya ~/.claude/askuserquestionspro
rm -rf "$INSTALL_DIR"; mkdir -p "$INSTALL_DIR"
cp -R "$TMPDIR/AskUserQuestionsPro-main/." "$INSTALL_DIR/"
DIR="$INSTALL_DIR"                                # trap yalnızca TMPDIR'i siler
```
`HOOK="$DIR/hooks/askuserquestionspro-bridge.mjs"` artık kalıcı. (En sağlamı: `curl | bash`
yöntemini bırakıp README'de `npm i -g askuserquestionspro && askuserquestionspro install`'i
birincil yapmak — npm global yolu kalıcıdır.)

---

## B2 — `install.sh` idempotent değil → çift/çakışan hook

**Dosya:** `install.sh:25-37` · **Yanlış doküman:** `README.md:39`
("...aynı hook entry'sini yazar (idempotent)."), `CODEMAP.md:72`
**Şiddet:** MAJOR — projenin kaçınmaya çalıştığı tam senaryoyu (#15897, "tek
PreToolUse hook olmalı") kendi kurulumu üretir.

### Nasıl oluşuyor
Shell script yalnızca `"AskUserQuestion"` geçiyorsa **uyarır**, ama yine de jq ile
**koşulsuz `+=` ekler**:

```bash
if grep -q '"AskUserQuestion"' "$SETTINGS"; then echo "UYARI: ..."; fi   # sadece uyarı
jq '... .hooks.PreToolUse += [{ "matcher":"AskUserQuestion", ... }]' ...   # her zaman EKLER
```

CLI tarafı (`bin/install.js` `addHook`) `already`/`conflict` ile doğru davranır;
ama `install.sh` bu mantığı taşımaz.

### Nasıl denenir (doğrulandı)
```bash
# boş {} settings üzerinde install.sh jq bloğu 3 kez:
# sonuç: AskUserQuestion entry sayısı = 3   (beklenen 1)
```
Gerçek koşum çıktısı: 3 çalıştırma → **3** AskUserQuestion entry.

### Teknik açıklama
`+=` her zaman ekler; "zaten var mı?" / "bizim entry mi?" kontrolü yok. README
idempotent olduğunu iddia ettiği için kullanıcı güvenle tekrar çalıştırır ve
settings'i kirletir.

### Önerilen çözüm
jq içinde idempotency uygula (bizim komutumuz zaten varsa ekleme):

```bash
jq --arg cmd "node $HOOK" '
  .hooks //= {} | .hooks.PreToolUse //= [] |
  if any(.hooks.PreToolUse[]?; .hooks[]?.command == $cmd) then .
  else .hooks.PreToolUse += [{ "matcher":"AskUserQuestion",
        "hooks":[{ "type":"command","command":$cmd,"timeout":360 }] }] end
' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
```
Daha iyisi: `install.sh`'ı `node bin/cli.js install`'i çağıracak şekilde inceltmek
— tek doğrulanmış kod yolu (`addHook`) kullanılır, jq bağımlılığı da kalkar.

---

## B3 — Hook kopması/timeout sonrası tarayıcı "ölü" soruyu göstermeye devam eder

**Dosya:** `server/server.js:78-80` (cancel'da `broadcastCurrent()` yok),
karşıtı `server/server.js:100-101` (`/answer` broadcast eder)
**Şiddet:** MAJOR — yanlış cevap/sahte başarı; bridge boşalsa da UI bunu bilmez.

### Nasıl oluşuyor
İstemci (hook) `/ask` long-poll'ünü yanıttan önce kaparsa (5 dk timeout/abort,
Claude Code hook'u öldürür, ya da süreç çökerse), server `res 'close'` ile
`bridge.cancel(...)` çağırır — ama **SSE'ye yeni durum yayınlamaz**:

```js
const onClose = () => { if (!settled) bridge.cancel('client disconnected'); };
res.on('close', onClose);
// ↑ cancel sonrası broadcastCurrent() ÇAĞRILMIYOR
```

Bridge `_pending = null` olur (deadlock yok, bu iyi), ama açık tarayıcı sekmeleri
hâlâ eski soruyu gösterir. Kullanıcı seçim yapıp gönderir → `/answer` →
`provideAnswers` "No pending question set" fırlatır → **409**. Ama UI yanıtı yok
sayar (bkz. B6) → "Answers sent back to the agent." toast'u gösterir. Kullanıcı
cevapladığını sanır; aslında o soru çoktan native picker'a düşmüştür.

### Nasıl denenir (doğrulandı)
İzole portta: SSE bağlan → `/ask` POST (long-poll) → bridge pending=true → `/ask`
isteğini **abort** et → SSE olayları: `[{questions:null}(ilk), {questions:[Q?]}]`.
Abort'tan sonra **yeni `null` push'u YOK** → sekme `Q?`'yu göstermeye devam eder.
Ardından ölü soruya `/answer` → HTTP **409**.

### Teknik açıklama
`/answer` yolu durum değişiminde `broadcastCurrent()` çağırır; `cancel` yolu
çağırmaz. Durum makinesinin _her_ terminal geçişi (resolve **ve** cancel) SSE
yayınını tetiklemeli.

### Önerilen çözüm
Cancel sonrası da yayınla:

```js
const onClose = () => { if (!settled) { bridge.cancel('client disconnected'); broadcastCurrent(); } };
```
Ek olarak istemci tarafında "soru bizden alındı" durumunu da ele al: yeni `null`
gelince Flow zaten Waiting'e döner (`app.js:9`), bu da "ölü soru" ekranını
temizler.

---

## B4 — multiSelect'te "Other" kaydedildikten sonra **geri alınamaz**

> ✅ **Çözüldü (2026-06-15).** `answer-map.js` `savePopupState` saf helper'ı
> eklendi: popup'ta metin boş bırakılıp Save edilince custom şık `sel`'den çıkar
> ve `customText` temizlenir → "Other" geri alınabilir. Regresyon testi
> `test/answer-map.test.js`'te.

**Dosya:** `web/answer-map.js:44-47`
**Şiddet:** MAJOR — kullanıcı yanlış girdiği serbest-metin cevabını listeden
çıkaramaz; o cevap zorla gönderilir.

### Nasıl oluşuyor
multiSelect dalında, seçili bir şıka tekrar basılınca normal şıklar toggle ile
**çıkarılır**, ama "Other" custom ise **her zaman popup açılır** (çıkarma yok):

```js
if (inSel) {
  if (isCustom) return { type: 'popup', optIdx, draft: a.customText }; // ← deselect DEĞİL
  return { type: 'toggle', sel: a.sel.filter(i => i !== optIdx) };     // normal: çıkar
}
```

"Other"ı silmenin hiçbir yolu yok: tekrar tıklama → popup; popup'ta metni silip
Save → `savePopup` `if(!text) return` ile no-op (popup açık kalır, sel değişmez);
Cancel → seçim aynen kalır.

### Nasıl denenir (doğrulandı)
```
decideActivate({options:[A,B], multiSelect:true}, {sel:[2], customText:'foo'}, 2)
  → { type:'popup', optIdx:2, draft:'foo' }      // çıkmaz
decideActivate(... , {sel:[0]}, 0)
  → { type:'toggle', sel:[] }                     // normal şık ÇIKAR
```

### Teknik açıklama
Custom şık için "düzenle" niyeti ile "kaldır" niyeti ayrıştırılmamış. Tek
etkileşim (tekrar tıklama) her zaman düzenlemeye gider.

### Önerilen çözüm (birkaç seçenek)
1. **Boş metinle kaydetme = kaldır:** `savePopup`'ta `if (!text)` → o `optIdx`'i
   `sel`'den çıkar ve `customText=''` yap (no-op yerine).
2. **Ayrı kaldır kontrolü:** Seçili custom şıkta bir "×" düğmesi veya
   modifier'lı tıklama (örn. multiSelect'te custom kutusuna basış toggle-off,
   etikete basış düzenle).
3. En azından `decideActivate`'e `intent` parametresi ekleyip multiSelect custom
   için toggle-off yolunu açmak. Saf fonksiyon + `test/answer-map.test.js`'e
   regresyon testi ile.

---

# MEDIUM

## B5 — `process.exit(0)` stdout'u flush etmeden keser (büyük payload kaybı)

**Dosya:** `hooks/askuserquestionspro-bridge.mjs:70-71`
**Şiddet:** MEDIUM (latent — yalnızca büyük payload'larda).

### Nasıl oluşuyor
```js
process.stdout.write(JSON.stringify(buildHookOutput(toolInput, answers)));
process.exit(0);   // ← write tamamlanmadan süreç biter
```
stdout bir **pipe** olduğunda (Claude Code hook çıktısını pipe ile okur), Node'da
`process.exit()` bekleyen yazma tamponunu **flush etmeyi garanti etmez**. Payload
OS pipe tamponunu (macOS'ta 64 KB) aşarsa, fazlası gönderilmeden süreç ölür →
Claude **yarım/bozuk JSON** alır → hook çıktısı yok sayılır (en iyi ihtimalle
native picker).

### Nasıl denenir (doğrulandı)
Hook'un son iki satırını taklit eden bir script ~851 KB JSON yazıp `process.exit(0)`
yaptı; pipe'a (`| wc -c`) ulaşan: tam **65.536** bayt (64 KB). Geri kalan ~785 KB
kayıp.

### Teknik açıklama
`process.exit` asenkron `write`'ı beklemez. Çok seçenekli/uzun açıklamalı büyük
bir soru seti + cevaplar 64 KB'ı geçebilir.

### Önerilen çözüm
Çıkışı `exitCode` ile bırak ve doğal flush'ı bekle; ya da `write` callback'inde çık:

```js
process.exitCode = 0;
process.stdout.write(JSON.stringify(buildHookOutput(toolInput, answers)));
// process.exit() çağırma — event loop boşalınca doğal çıkış stdout'u flush eder
```
(Diğer `process.exit(0)` çağrıları stdout'a yazmadığı için sorunsuz; ama
tutarlılık için hepsini `process.exitCode = 0; return;` yapmak daha güvenli.)

---

## B6 — `postAnswers` yanıtı/hatayı yutar + iyimser "submitted" → sessiz veri kaybı

**Dosya:** `web/live.js:24-30`, `web/app.js:110-119`
**Şiddet:** MEDIUM.

### Nasıl oluşuyor
```js
async function postAnswers(answers) {
  await fetch("/answer", { method:"POST", ... });   // res.ok kontrol edilmiyor, dönüş yok
}
```
`submit()` ise önce `setSubmitted(true)` (toast + kilit) yapıp **sonra** `postAnswers`
çağırır. POST 409 dönerse (bridge'de pending yok — bkz. B3), 4xx/5xx dönerse, ya
da ağ koparsa kullanıcı yine "Answers sent back to the agent." görür; Claude ise
hiçbir şey almamıştır (5 dk timeout'a kadar bekler, sonra native).

### Nasıl denenir
B3 reprosunun devamı: ölü soruya gönder → `/answer` 409 → UI yine "submitted".
Veya server'ı `/answer` POST'tan hemen önce kapat → toast yine çıkar.

### Teknik açıklama
İyimser UI güncellemesi + hatanın asla okunmaması. Long-poll mimarisinde "cevap
gerçekten teslim edildi mi" yalnızca `/answer` 200'ü ile bilinebilir.

### Önerilen çözüm
`postAnswers`'ı sonuç döndürür yap; başarıda submitted'a geç, başarısızlıkta hata
göster ve kilidi aç:

```js
async function postAnswers(answers) {
  const r = await fetch("/answer", { method:"POST",
    headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ answers }) });
  if (!r.ok) throw new Error(`/answer ${r.status}`);
  return r.json();
}
// app.js submit():
const submit = useCallback(() => {
  const mapped = AnswerMap.mapAnswers(QUESTIONS, stateForMap);
  setSubmitted(true);
  postAnswers(mapped).catch(() => {
    setSubmitted(false);                 // kilidi aç, tekrar denenebilsin
    /* "Gönderilemedi — tekrar deneyin" hata durumu göster */
  });
}, [QUESTIONS]);
```

---

## B7 — Hook komutu tırnaksız → kurulum yolunda boşluk varsa hook çalışmaz

**Dosya:** `bin/install.js:11-13`, `install.sh:19,32`
**Şiddet:** MEDIUM.

### Nasıl oluşuyor
```js
function hookCommand(hookAbsPath) { return `node ${hookAbsPath}`; }   // tırnak yok
```
Kurulum yolu boşluk içeriyorsa (örn. macOS `~/Library/Application Support/...`,
veya kullanıcı adında boşluk), Claude Code komutu `node /yol içinde boşluk/hook.mjs`
olarak çalıştırır; `node` ilk parçayı dosya, gerisini argüman sanır → `Cannot find
module '/yol'`.

### Nasıl denenir
`askuserquestionspro`'yi yolu boşluk içeren bir dizine kur, `askuserquestionspro install`,
sonra AskUserQuestion tetikle → hook "module not found" ile düşer.

### Önerilen çözüm
Yolu tırnakla:
```js
function hookCommand(hookAbsPath) { return `node "${hookAbsPath}"`; }
```
`install.sh` için de: `--arg cmd "node \"$HOOK\""` (ya da daha sağlamı: komutu
`node` + ayrı `args` alanı destekleniyorsa argüman dizisi olarak vermek).
Not: `install.test.js`'teki `CMD = \`node ${HOOK}\`` beklentisi de güncellenmeli.

---

## B8 — Boş/eksik cevapla "Submit" serbest → Claude'a `answers: {}` gider

> ✅ **Çözüldü (2026-06-15).** `app.js`'te `submit()` başında boş submit guard
> (`if (Object.keys(mapped).length === 0) return`) + `canSubmit = answered > 0`.
> `views.js` Summary butonu `disabled={!canSubmit || submitted}` ve "Answer at
> least one" etiketi gösterir.

**Dosya:** `web/app.js:110-119`, `web/views.js:230-232` (buton hep aktif),
`web/answer-map.js:15` (cevaplanmamış soru atlanır)
**Şiddet:** MEDIUM.

### Nasıl oluşuyor
Summary ekranında "Submit answers" butonunun hiçbir koşulu yok; hiç soru
cevaplanmadan basılabilir. `mapAnswers` cevaplanmamışları atladığı için sonuç
`{}` olur; hook `answers == null` kontrolünü `{}` geçer (null değil) →
`updatedInput.answers = {}` ile Claude'a gider. Model "kullanıcı hiçbir şey seçmedi"
girdisiyle devam eder (muhtemelen istenmeyen davranış).

### Nasıl denenir
Soru gelince hiçbir şey seçme → `→` ile Summary'ye git → "Submit answers" → hook
çıktısında `answers: {}`.

### Teknik açıklama
"En az gerekli soruları cevapla" doğrulaması yok; confirmed sayısı gönderimi
etkilemiyor (bkz. B16).

### Önerilen çözüm
- Hiç cevap yoksa Submit'i devre dışı bırak / uyar:
  `disabled={Object.keys(mapAnswers(...)).length === 0}`.
- İdeali: her soru için (multiSelect'te ≥1) cevap zorunluluğu — eksikse "B" ile
  ilk eksik soruya yönlendiren mevcut akışı kullan, Submit'i blokla.
- Tamamen boşsa hook tarafında da `Object.keys(answers).length === 0` → `exit(0)`
  (native picker) ile ele almak savunma katmanı olur.

---

## B9 — Linux/Windows'ta `open` yok → unhandled `error` → hook çöker

**Dosya:** `hooks/askuserquestionspro-bridge.mjs:38-40`
**Şiddet:** MEDIUM (macOS dışı platformlarda her çağrıda).

### Nasıl oluşuyor
```js
function openBrowser() {
  spawn("open", [BASE], { stdio:"ignore", detached:true }).unref();   // 'error' listener YOK
}
```
`open` yalnızca macOS'ta var. Linux/Windows'ta `spawn` ENOENT ile asenkron bir
`'error'` olayı yayınlar; dinleyici olmadığı için Node bunu **fırlatır** ve süreç
**exit code 1** ile çöker. Çökme `main()` `await askPromise` beklerken olur →
hook ölür → "her zaman temiz exit(0)" değişmezi (ARCHITECTURE §7) kırılır. macOS'ta
`open` var olduğundan orada sorun çıkmaz, ama `open` herhangi bir sebeple
başarısız olursa aynı çökme orada da olur.

### Nasıl denenir (doğrulandı)
`spawn('var-olmayan-binary', ...).unref()` (error listener'sız) → süreç exit 1 ile
çöküp `Unhandled 'error' event` basar; sonraki kod hiç çalışmaz.

### Önerilen çözüm
Hata dinleyicisi ekle (en azından yut) ve platforma göre komut seç:
```js
function openBrowser() {
  const cmd = process.platform === "darwin" ? "open"
            : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c","start","",BASE] : [BASE];
  const c = spawn(cmd, args, { stdio:"ignore", detached:true });
  c.on("error", () => {});   // tarayıcı açılamazsa sessiz geç — akış bozulmasın
  c.unref();
}
```
(Tarayıcı açılmasa bile hook çalışmalı: kullanıcı sekmeyi elle açabilir; B9 düzeltmesi
bunu mümkün kılar.)

---

## B10 — Aynı metinli ardışık soru seti → "submitted" takılır, klavye kilitlenir

**Dosya:** `web/app.js:16` (`key=questions.map(q=>q.question).join("|")`),
`web/app.js:32,124` (`submitted` state + onKey erken dönüş)
**Şiddet:** MEDIUM (düşük sıklık — ardışık özdeş sorular).

### Nasıl oluşuyor
`Flow` bileşeninin `key`'i sorular metninin birleşimidir. İki ardışık
`AskUserQuestion` çağrısı **aynı soru metinlerine** sahipse key değişmez → React
`Flow`'u **remount etmez** → bir önceki turdan kalan `submitted=true`,
`confirmed`'lar, toast korunur. Yeni tur için `onKey` ilk satırda
`if (R.popup || R.submitted) return` ile **klavyeyi tamamen devre dışı bırakır**;
kullanıcı yeni soruyu klavyeyle yanıtlayamaz (fare ile Submit hâlâ çalışır ama
eski state üzerinden).

### Nasıl denenir
Agent'a peş peşe iki kez aynı `AskUserQuestion`'ı sordur (aynı `question`
metinleri) → ikinci turda ekranda "Answers sent" toast'u + tüm cevaplar "done";
ok/rakam tuşları çalışmaz.

### Teknik açıklama
Soru içeriği remount için yeterince benzersiz bir kimlik değil. Her `/ask` ayrı bir
turdur; kimlik tur başına olmalı, içerik başına değil.

### Önerilen çözüm
Tur başına benzersiz bir kimlik üret (server `/ask`'te bir `askId` ekleyip SSE ile
yollasın), `Flow key={askId}` yap. Server tarafı minimal değişiklik:
`bridge.submitQuestions` bir artan `id` tutar; `getCurrent()` `{id, questions}`
döner; SSE/`/current` payload'ına `id` eklenir; web `key`'i `id` yapar. Alternatif
hızlı çözüm: yeni `null→questions` geçişinde web state'i sıfırlamak için
`useLiveQuestions`'a bir "tur sayacı" eklemek.

---

# MINOR

## B11 — Aynı `question` metnine sahip iki soru → state çakışması + tekrar React key
**Dosya:** `web/app.js:24-28,16`, `web/views.js:69,207`
Tüm state `answers[q.question]` ile metne göre anahtarlanır; React listelerinde
`key={q.question}` kullanılır. İki sorunun metni aynıysa aynı state objesini
paylaşır (birini cevaplamak diğerini de "cevaplanmış" yapar) ve React tekrar eden
key uyarısı verir/yanlış reconcile eder.
**Çözüm:** state'i ve key'i indeks-tabanlı yap (`answers[i]`, `key={i}` veya
`key={i + "::" + q.question}`); `mapAnswers`/`Summary`/`Sidebar` aynı anahtarı
kullansın.

## B12 — 9'dan fazla seçenekli soruda "Other" klavyeden seçilemez
**Dosya:** `web/app.js:132` (`/^[1-9]$/`)
Rakam kısayolu 1–9 ile sınırlı; `fullOptions` "Other"ı sona ekler. 9 gerçek
seçenek + Other = 10 şık → 10. (Other) ve 9.'dan sonrası klavyeyle erişilemez
(fare çalışır). `Hints` "1–{length}" yazıp yanıltır.
**Çözüm:** Pratikte AskUserQuestion az seçenek kullanır; yine de Other'a sabit bir
tuş (örn. `0` veya `o`) atamak ve hint'i buna göre güncellemek.

## B13 — Hook `main()` üst seviye `catch` yok → "her zaman exit(0)" garantisi kırılabilir
**Dosya:** `hooks/askuserquestionspro-bridge.mjs:74` (`main();`)
`try/catch` yalnızca fetch bloğunu sarar. Beklenmedik bir senkron/promise hatası
(örn. B9, ya da ileride eklenecek kod) yakalanmaz → unhandled rejection → non-zero
exit. ARCHITECTURE §7'deki "hiçbir koşulda Claude'u kilitleme / her sapma exit(0)"
değişmezi resmî olarak garanti edilmiyor.
**Çözüm:** `main().catch(() => process.exit(0));` + `process.on('uncaughtException',
() => process.exit(0))` savunma ağı.

## B14 — SSE reconnect: unmount sırasında `setTimeout` iptal edilmez
**Dosya:** `web/live.js:15-18`
`es.onerror` → `setTimeout(connect, 1000)`. Bu 1 sn içinde bileşen unmount olursa
cleanup yalnızca mevcut `es`'i kapatır; bekleyen `setTimeout` `connect()`'i yine
çağırıp unmount sonrası orphan `EventSource` yaratır. App tek kök olduğu için
pratik etki düşük, ama doğru temizlik:
**Çözüm:** `let timer; ... timer = setTimeout(connect,1000); return () => { es?.close();
clearTimeout(timer); };`

## B15 — Statik servis `startsWith(WEB_DIR)` sınır kontrolü zayıf
**Dosya:** `server/server.js:37-38`
`path.join(WEB_DIR, path.normalize(rel))` traversal'ı pratikte engelliyor (req.url
hep `/` ile başlar, normalize kök `..`'ları yutar). Ancak `file.startsWith(WEB_DIR)`
sınır duyarsız: `WEB_DIR` `/app/web` iken `/app/website` da prefix'i geçer. Sömürü
yolu görünmüyor (join içeride tutuyor) ama sağlamlaştırma önerilir.
**Çözüm:** `if (file !== WEB_DIR && !file.startsWith(WEB_DIR + path.sep))` ile
sınır kontrolü; ayrıca yalnızca `MIME` uzantılarına izin vermek.

## B16 — "confirmed" gönderim için kozmetik; armed-onaylanmamış seçim de gönderilir
**Dosya:** `web/app.js:110-116` (submit `a.sel` kullanır), `web/app.js:138`
(`answered` `confirmed` sayar)
`submit()` ham `sel`'i `mapAnswers`'a verir; "confirmed" bayrağına bakmaz. Bir
seçeneği "armed" yapıp (sel dolu) onaylamadan ok tuşuyla Summary'ye geçip
gönderirseniz o cevap dahil edilir — ama progress sayacı onu "answered" saymaz.
Tutarsız zihinsel model.
**Çözüm:** Ya gönderimi `confirmed` olanlarla sınırla, ya da progress sayacını
`sel.length>0`'a göre hesapla — ikisini tek doğruluk kaynağında birleştir.

## B17 — Summary "Submit" butonu submitted sonrası tekrar tıklanabilir
> ✅ **Çözüldü (2026-06-15).** `views.js` Summary butonu artık
> `disabled={!canSubmit || submitted}`; `app.js` `submit()` başında double-submit
> guard. Buton submitted sonrası "Submitted ✓" gösterir ve tıklanamaz.

**Dosya:** `web/views.js:230-232`, `web/app.js:159-167`
Klavye `submitted`'da kilitli ama `onSubmit` butonu değil; tekrar tıklama yeni bir
`/answer` POST'u atar (bridge boş → 409, yutulur). Zararsıza yakın ama gereksiz.
**Çözüm:** `<button ... disabled={submitted} ...>` ve/veya `submit()` başında
`if (ref.current.submitted) return`.

## B18 — Doküman: "test styles.css ↔ KNOWN_TOKENS eşleşmesini doğrular" iddiası yanlış
> ✅ **Çözüldü (2026-06-15).** `test/themes.test.js`'e gerçek test eklendi:
> styles.css `:root` bloğu `fs` ile okunur, `--token:` anahtarları regex ile
> çıkarılır, KNOWN_TOKENS ile **birebir** (iki yönlü) karşılaştırılır — `:root`'ta
> fazla token (sözleşme dışı) ve KNOWN_TOKENS'ta olup defaultu olmayan token
> ayrı ayrı yakalanır. Bir token silinir/yanlış yazılırsa CI kırılır. Şu an
> 37↔37 birebir eşleşiyor; test geçiyor.

**Dosya:** `living_docs/ARCHITECTURE.md §9` / `web/themes.js:9-10` yorum
Yorum/dokümanda KNOWN_TOKENS'ın styles.css `:root` ile birebir aynı olduğunu
"test doğrular" deniyor; `test/themes.test.js` yalnızca tema tokenlarının
KNOWN_TOKENS **alt kümesi** olduğunu kontrol ederdi — styles.css'i hiç okumazdı. Bir
token `:root`'tan silinse veya yanlış yazılsa test yakalamazdı.
**Çözüm:** styles.css `:root`'u parse edip her KNOWN_TOKEN'ın tanımlı olduğunu (ve
fazlalık olmadığını) doğrulayan bir test ekle; veya doküman iddiasını düzelt.

---

# Ek notlar (hata değil, bilinçli sınırlama / izlenecek)

- **Paylaşılan tek-uçuş köprü (port 4517):** İki ayrı Claude oturumu aynı
  daemon'u paylaşır; ikinci eşzamanlı soru 409 ile native picker'a düşer
  (tasarım gereği, ARCHITECTURE §2). Çoklu-oturum kullanıcıları için sürpriz
  olabilir; oturum-başı port (örn. `ASKUSER_PORT` türetme) düşünülebilir.
- **Zombi daemon:** Spawn edilen server süreci kendiliğinden kapanmaz; reboot'a
  kadar yaşar. Zararsız ama belgelenmemiş yaşam döngüsü (idle timeout eklenebilir).
- **Birden çok tarayıcı sekmesi:** Her `AskUserQuestion`'da `open` çağrılır;
  zamanla biriken sekmeler aynı soruyu görür ve ilk gönderen kazanır (B6 ile
  birleşince diğer sekmeler sahte "submitted" gösterir).

# Önerilen düzeltme sırası
1. **B1, B2** (kurulum tamamen bozuk/kirletici — kullanıcı hiç başlayamıyor).
2. **B3 + B6** (birlikte: sahte başarı + sessiz veri kaybı — güven kırıcı).
3. **B4** (temel etkileşim kusuru), **B9** (taşınabilirlik + invariant), **B7**.
4. **B5, B8, B10** ve MINOR'lar.
