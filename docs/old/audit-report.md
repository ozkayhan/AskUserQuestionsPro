# Kod Denetim Raporu — askuserquestionspro (valencia)

## Yönetici Özeti

Bu denetim, Claude Code icin "AskUserQuestion" yerine gecen tam-ekran web UI köprüsünü olusturan **16 bileseni** kapsar: Bridge cekirdegi, HTTP daemon, MCP sunucusu, PreToolUse hook, CLI, shell kurulum scriptleri, ayar kaliciligi, web UI (durum makinesi / SSE / sunum), cevap-haritalama mantigi, tema sistemi, test paketi ve CI/CD yapilandirmasi.

**Toplam dogrulanmis bulgu: 195.**

### Severity dagilimi

| Severity | Adet | Oran  |
| -------- | ---- | ----- |
| Critical | 3    | %1.5  |
| High     | 53   | %27.2 |
| Medium   | 91   | %46.7 |
| Low      | 48   | %24.6 |

> Not: "Low" kovasinda 4 adet bulgu acikca **dogrulama (bulgu degil)** olarak isaretlidir — bunlar kodun belirli bir invariant'i dogru koruduğunu kanitlar; gercek kusur degildir (örn. bridge senkron okuma atomikligi, live.js closed-guard, JSON.parse sessiz catch'in state'i bozmamasi).

### En kritik 3 tema

1. **Cross-round veri karismasi (Bridge kimlik dogrulamasi yoklugu).** Bridge tur basina monoton `id` uretiyor ama `cancel`/`provideAnswers` HANGI turu hedeflediklerini dogrulamiyor. Sonuc: bir turun gec gelen `/answer` POST'u ya da gec gelen socket-close'u, BASKA (yeni) bir turu yanlis cevaplarla resolve/iptal edebiliyor. Bu **sessiz veri bozulmasidir** ve ajan yanlis sorulara ait cevaplari alir.

2. **Ranking/tree OOB indeks crash'leri (uc Critical bulgunun ikisi).** `mapAnswers` ve `summaryText` icindeki ranking/tree dallari `q.options[i].label`'i korumasiz okuyor. Sinir-disi bir indeks (`isAnswered` bunu engellemez — yalnizca `order.length>0` bakar) **tum cevap haritalamasini** ya da **tum ozet render'ini** TypeError ile cokertir; tek soru degil, butun yanit kaybolur.

3. **Savunmasiz hata yutma (sinyalsiz basarisizlik).** `settings.js write()` disk yazimi basarisiz olsa bile `next` dondurup sahte basari bildiriyor; `mcp-server` tek `catch{}`'i AbortError'u network hatasindan ayirt edemiyor; `ensureServer` spawn hatasini yutuyor; hook `writeAndExit` EPIPE'i yutuyor. Hata gorunurlugu kullanici deneyimi adina tumuyle feda edilmis.

### Genel risk degerlendirmesi

Sistem **fonksiyonel olarak calisir durumda** (happy-path saglam, sunucu validQuestions() guclu) ancak **uretim sertligi (production hardening) acisindan olgunlasmamis**. En agir riskler tek-kullanici masaustu baglaminda olasiligini dusuruyor (cross-round race, lost-update) fakat **kullanici-yuzu veri kaybi** (sahte "kaydedildi", sessizce dusen binary cevap, OOB crash) gercek ve tetiklenebilir. Erisilebilirlik (a11y) tum web UI yuzeyinde sistematik olarak eksik. Test paketi happy-path'e asiri bagimli; bulunan hata yollarinin cogu **hic test edilmiyor** ve global state sizinitisi test guvenilirligini belirsizlestiriyor. **Supply-chain** (pipe-to-bash, pin'lenmemis GitHub Action'lari) odaklanmis ama tamamlanmamis.

**Onerilen oncelik sirasi:** (1) Bridge'e tur-id sahiplik dogrulamasi ekle, (2) ranking/tree OOB guard'larini kapat, (3) `write()` ve hata-yutan catch'leri sinyal verir hale getir, (4) a11y temel ARIA katmanini ekle, (5) hata-yolu testlerini doldur.

---

## Sistemik Temalar

### Tema A — Savunmasiz Hata Yutma (Sinyalsiz Basarisizlik)

Kritik hata yollarinda catch bloklari exception detayini siliyor; sistemin her katmaninda tekrarliyor. **Kök neden:** "kullanici deneyimini bozmama" kaygisinin hata gorunurlugunu tumuyle feda etmesi.
Bagli bulgular: `settings.js write()` sahte basari (high ×3), `mcp-server` tek `catch{}` (high), `bridge-client ensureServer` spawn yutma (medium ×2 + low), hook `writeAndExit` EPIPE (medium), hook `uncaughtException/unhandledRejection` arg drop (low), `settings-schema applyAll` bos catch (low), `live.js` SSE parse sessiz catch (low), `askBridge` AbortError ayrimsizligi (high).

### Tema B — Kontrat/Invariant Dogrulamasinin Katman Sinirinda Kaybolmasi

Her sinir gecisinde (Claude→Hook→HTTP→Bridge→UI) gelen verinin yapisal dogrulamasi ya eksik ya yanlis katmanda. Sunucu `validQuestions()` guclu ama hook/MCP/UI katmani girdiyi ham kabul ediyor. **Kök neden:** "hangi katman dogrular?" sorusu yanitsiz; ayni dogrulama bazen uc kez, bazen sifir kez.
Bagli bulgular: nested tree children label dogrulanmiyor (high), `provideAnswers` arguman dogrulanmiyor (high), `askBridge` `.answers` null guard yok (high), ranking/tree OOB her katmanda (critical ×2 + high ×4), `CustomPopup` stale `q` (high), number-key binary bounds yok (high).

### Tema C — Durumu Senkronize Tutma Basarisizligi (Stale Reference / Stale State)

`ref.current`, React state ve local degiskenler arasi senkronizasyon tutarsiz. **Kök neden:** closure/ref/state uclusu arasinda "tek gercek kaynak" yoklugu.
Bagli bulgular: `submit()` stale `ref.current.answers` (medium), `goBack()` confirmed sifirlamiyor (medium), `jumpToNextUnanswered` stale `ref.current.current` (medium), settings-panel baseline vs draft in-flight bozulmasi (high + medium ×2), RankingCard stale cursor closure (medium), TreeCard `confirmed` reset edilmiyor (high).

### Tema D — Test Izolasyonu ve Kuresel Durum Sizintisi

Test suite global state'e (ENABLED haritasi, Bridge instance, process.env, singleton server) dogrudan bagimli; assertion erken patlarsa manuel restore atlanir. **Kök neden:** beforeEach/afterEach yoklugu ve modul-singleton mutasyonu.
Bagli bulgular: `setEnabled` global leak (high + medium ×3), MCP test zombie process (high ×4), bridge-client XDG_CONFIG_HOME set etmiyor (medium), time-based sleep senkronizasyonu (medium ×2).

### Tema E — Operasyonel Gorunurluk Eksikligi (Gozlemlenemezlik)

Sunucu/hook/MCP loglari minimal ve yapilandirilmamis. Spawn hatasi, settings yazma hatasi, SSE istemci dusmesi, bridge cancel gibi olaylar ya stderr'e ham metin ya da hic yazilmiyor. Distributed tracing, round-ID log correlation, yapilandirilmis log formati yok.
Bagli bulgular: `ensureServer` spawn sessiz (medium ×2), `mcp-server catch{}` (high), `live.js` SSE parse sessiz (low), hook `uncaughtException` drop (low), `broadcastCurrent` failed write yutma (medium).

---

## Bulgular

### [CRITICAL] writeSettings() atomik degil: ENOSPC/crash settings.json'i bos/yarim birakir

**Dosya:** bin/install.js:91-92
**Lens:** errorhandling
**Sorun:** `writeFileSync()` dosyayi O_TRUNC ile acip ilk byte yazilmadan sifirliyor. Yazim sirasinda ENOSPC/EACCES/process-kill olursa dosya 0 byte veya kismi-gecerli JSON kalir. Sonraki okuma `{}` doner ya da "Invalid JSON" firlatir. tmp→rename deseni hic yok.
**Repro:** Diski kapasitenin ~50 byte altina kadar doldur, `askuserquestionspro install` calistir — yazim ortada kalir, settings.json 0 byte olur.
**Onerilen Fix:** Kardes bir `.tmp.<pid>` dosyasina yaz, sonra `fs.renameSync()` ile yerine tasi. POSIX'te rename FS seviyesinde atomiktir.

### [CRITICAL] mapAnswers: ranking OOB indeks TypeError ile cokertir (q.options[i] guard yok)

**Dosya:** web/answer-map.js:65-67
**Lens:** testcoverage
**Sorun:** Satir 66 `.map()` icinde `q.options[i].label`'i kosulsuz okuyor. `s.order` icinde `q.options.length`'i asan bir eleman varsa `q.options[i]` undefined olup `.label` firlatir. `isAnswered()` ayni state icin `true` doner (yalnizca `order.length>0`), bu yuzden cagiranlar isAnswered'i guard olarak kullanamaz.
**Repro:** `mapAnswers([{question:'R?',type:'ranking',options:[{label:'A'},{label:'B'}]}], {'R?':{order:[0,5]}})` → TypeError.
**Onerilen Fix:** Null guard: `.map(i => { var o = q.options[i]; return o ? o.label : ''; }).filter(x => x !== '')`. Hepsi elenirse soruyu atla. single/multi'deki (43-51) ayni deseni uygula.

### [CRITICAL] summaryText: ranking OOB indeks ayni TypeError ile cokertir

**Dosya:** web/answer-map.js:185-187
**Lens:** testcoverage
**Sorun:** Satir 186 satir 66 ile ayni korumasiz desen: `a.order` uzerinde `q.options[i].label`. Herhangi OOB indeks summaryText'i cokertir; sidebar/ozet render'inda patlar. Mevcut test (309-315) yalnizca gecerli indeks kullaniyor.
**Repro:** `summaryText({type:'ranking',options:[{label:'Auth'},{label:'Cache'}]}, {order:[0,5]})` → TypeError.
**Onerilen Fix:** `.map(i => { var o=q.options[i]; return o?o.label:null; }).filter(Boolean).join(' → ')`. Sonuc bossa '' don.

---

### [HIGH] provideAnswers() answers argumani dogrulanmiyor — undefined/null sessizce resolve

**Dosya:** server/bridge.js:33-38
**Lens:** errorhandling
**Sorun:** `provideAnswers()` ya da `provideAnswers(undefined)` cagrisinda `_pending` null yapilip `p.resolve(undefined)` calisir; submitQuestions promise'i undefined ile resolve olur, downstream bunu gercek cevap sanar. Veri kaybi.
**Repro:** `bridge.provideAnswers()` argumansiz — promise undefined ile resolve, `_pending` temizlenir, hata yok.
**Onerilen Fix:** Girise `if (answers == null) throw new Error('answers must be provided')` (veya Array kontrolu). Throw, `_pending` null yapilmadan ONCE gerceklesmeli.

### [HIGH] Tree nested children label'lari hic dogrulanmiyor

**Dosya:** server/server.js:129-160
**Lens:** correctness
**Sorun:** `checkChildren()` ozyinelemeli olarak yalnizca `children`'in array oldugunu kontrol ediyor; nested label'i dogrulamiyor. Label uzunluk/tip kontrolu yapan dongu (151-160) yalnizca en-ust `it.options`'ta geziyor. Derinlik 2+ bir label eksik/string-disi/bos/>500 char olabilir ve UI'a ulasir.
**Repro:** `POST /ask {"questions":[{"type":"tree","question":"q","options":[{"label":"A","children":[{"label":12345}]}]}]}` → 200 ile kabul.
**Onerilen Fix:** `checkChildren()`'i her dugumun label'ini de dogrulayacak sekilde genislet (`typeof===string && 1..500`).

### [HIGH] Bridge durum makinesi atomik degil: pending sahipligi dogrulanmiyor

**Dosya:** server/bridge.js:12-48
**Lens:** concurrency
**Sorun:** `cancel(reason)` ve `provideAnswers(answers)` yalnizca "bir pending var mi" bakiyor; HANGI pending oldugunu dogrulamiyor. `++this._seq` monoton id uretiliyor ama iptal/cevap yollarinda hic kullanilmiyor. Bir tur icin tetiklenen iptal (server.js:264 client disconnected) o sirada pending olan herhangi bir turu sessizce reject edebilir.
**Repro:** (saglanmadi — kavramsal: tur A pending iken cancel, tur B'yi etkiler)
**Onerilen Fix:** `cancel(reason, expectedId)` ve `provideAnswers(answers, expectedId)` ekleyip `if (this._pending.id !== expectedId) return false/throw`. Cagiranlar peek'ten aldiklari id'yi gecirsin.

### [HIGH] readBody: req.destroy() sonrasi data event'leri devam eder, kismi data sessizce resolve

**Dosya:** server/server.js:32-46
**Lens:** errorhandling
**Sorun:** 8MB asiminda `req.destroy()` cagrilir ama promise O ANDA reject EDILMEZ. Buffered 'data' event'leri destroy'dan sonra fire edebilir; 'end' 'close'tan once fire ederse `resolve(data)` kismi data ile cagrilir ve boyut guard'i tumuyle atlanir.
**Repro:** >8MB body cok sayida kucuk chunk ile; 'end' ile 'close' TCP buffer durumuna gore yarisir.
**Onerilen Fix:** Closure'a `rejected` flag ekle, 'data' handler'inda destroy'dan ONCE reject() cagir; 'end' handler'ini `if (!rejected) resolve(data)` ile koru.

### [HIGH] readBody: req.readableEnded true iken 'close' fire ederse promise asili kalir

**Dosya:** server/server.js:34-45
**Lens:** correctness / invariant
**Sorun:** Reddetme 'close' handler'ina ertelenmis (`if (!req.readableEnded)`). Son chunk hem boyutu asip hem stream'i bitirirse `readableEnded===true` olur, reject dali atlanir; promise HTTP request timeout'a kadar asili kalir — ama timeout disabled (`requestTimeout=0`).
**Repro:** Son chunk'i tam 8MB'i asacak POST gonder, readableEnded ile oversize ayni anda olsun.
**Onerilen Fix:** Boyut asiminda destroy'dan once senkron reject; `rejected` flag ile cift-reject'i engelle.

### [HIGH] askBridge() timeout sonrasi AbortError'u baska hatalardan ayirt etme yolu yok

**Dosya:** lib/bridge-client.mjs:71-86
**Lens:** errorhandling
**Sorun:** `controller.abort()` tetiklendiginde fetch DOMException (AbortError) firlatir, yakalanmadan cagirana yayilir. Cagiran AbortError ile ag hatasi/HTTP 5xx/json parse hatasini ayirt edemez.
**Repro:** `timeoutMs=1` ile cagir; sunucu ayaktayken bile AbortError, kapaliyken de AbortError — ayirt edilemez.
**Onerilen Fix:** catch'te `if (e.name==='AbortError') throw new Error('askBridge timed out after '+timeoutMs+'ms')`; ya da ozel TimeoutError sinifi.

### [HIGH] askBridge() — r.json() basarili olsa bile .answers null/undefined ise undefined donuyor

**Dosya:** lib/bridge-client.mjs:82
**Lens:** errorhandling
**Sorun:** `return (await r.json()).answers;` — donen nesne `answers` icermiyorsa fonksiyon sessizce undefined doner; caller sifir-yanit ile gercek hatayi ayirt edemez, null-deref riski.
**Repro:** Sunucu `{ok:true}` dondursun (answers yok); askBridge undefined doner.
**Onerilen Fix:** `const body = await r.json(); if (body == null || body.answers == null) throw new Error('bridge response missing answers field'); return body.answers;`

### [HIGH] catch {} blogu exception detayini siliyor — AbortError ayirt edilemiyor

**Dosya:** mcp-server/askuserquestionspro-mcp.mjs:133-143
**Lens:** errorhandling
**Sorun:** `handleAsk` catch blogu parametre almiyor (`catch {}`). Timeout, network hatasi, "another set pending" tumu ayni jenerik mesajla doner; tip/mesaj/stack kayboluyor.
**Repro:** 1 saatlik timeout dolmadan bridge cokssun — caller hangi hatanin geldigini bilemez.
**Onerilen Fix:** `catch (e)` yapisina gec; `e.name`/`e.message`'i stderr'e logla ve donen text'e ekle; AbortError icin ayri dal.

### [HIGH] /answer round id tasimiyor — stale cevap yanlis soru setini resolve eder (cross-round race)

**Dosya:** server/server.js:282-304
**Lens:** concurrency
**Sorun:** Bridge her tura monoton id veriyor, UI bunu SSE'den aliyor ama `/answer` handler govdede yalnizca `answers` bekliyor, `id`yi okumuyor. Senaryo: Tur A pending iken socket kapanir → cancel → `_pending=null`; MCP yeni tur B baslatir (id=2); Tur A'nin gec gelen `/answer` POST'u id tasimadigi icin tur B'nin promise'ine A'nin cevaplarini resolve eder. **Sessiz veri karismasi.**
**Repro:** Tur A pending → /ask soketi kapanir → MCP tur B acar → A'nin gec /answer'i B'yi yanlis cevaplarla resolve eder.
**Onerilen Fix:** `/answer` body'sinden `id` al, `bridge.provideAnswers(id, answers)` icinde `if (this._pending.id !== id) return 409/stale`. UI `postAnswers` round.id'yi govdeye eklesin.

### [HIGH] cmdInstall/cmdUninstall: readSettings/writeSettings hatalari yakalanmiyor — ham stack trace

**Dosya:** bin/cli.js:44-58 (cmdInstall), 90-98 (cmdUninstall)
**Lens:** errorhandling
**Sorun:** readSettings (EACCES/malformed JSON) ve writeSettings (ENOSPC/EACCES/mkdir) throw eder; ne komut ne main() try/catch sarar. Kullanici ham Node traceback gorur, eylem yapabilir mesaj yok.
**Repro:** `chmod 000 ~/.claude/settings.json`, sonra `askuserquestionspro install`.
**Onerilen Fix:** Govdeyi try/catch ile sar; `process.stderr.write(\`Hata: ${err.message}\`)`+`process.exit(1)`.

### [HIGH] cmdServe/cmdMcp: spawn() 'error' listener yok — ENOENT'te unhandled EventEmitter crash

**Dosya:** bin/cli.js:101-110
**Lens:** errorhandling
**Sorun:** spawn() executable bulunamayinca 'error' EVENT'i emit eder (exception degil). `child.on('error')` yoksa Node sureci ham traceback ile cokertir; 'exit' listener fire etmez, exit kodu kontrolsuz.
**Repro:** server/server.js'i sil, `askuserquestionspro serve`.
**Onerilen Fix:** Her child'a `child.on('error', err => { stderr.write(...); process.exit(1); })`.

### [HIGH] cmdDoctor: fetch() timeout yok — bridge TCP kabul edip stall ederse sonsuz asili

**Dosya:** bin/cli.js:193-200
**Lens:** errorhandling
**Sorun:** Node fetch'inde default socket/response timeout yok. Port acik ama yanit gelmiyorsa (zombie bridge, port-hijack) `await fetch()` ne resolve ne reject olur; cmdDoctor sonsuz asili kalir, CLI SIGINT'e kadar takilir.
**Repro:** `nc -l 4517` (TCP accept, yanit yok), sonra `askuserquestionspro doctor`.
**Onerilen Fix:** AbortController + kisa timeout (2000ms), finally'de clearTimeout.

### [HIGH] main() .catch() olmadan cagriliyor — unhandled rejection ham stack ile cikar

**Dosya:** bin/cli.js:262
**Lens:** errorhandling
**Sorun:** `main();` ciplak; `.catch()` veya `unhandledRejection` guard'i yok. cmdDoctor (veya gelecekteki async komut) throw ederse Node 15+ sureci unhandled-rejection ile sonlandirir, eylem yapabilir mesaj yok.
**Repro:** cmdDoctor'a throw enjekte et, `askuserquestionspro doctor`.
**Onerilen Fix:** `main().catch(err => { stderr.write(\`Beklenmedik hata: ${err.message}\`); process.exit(1); });`

### [HIGH] install.sh idempotency TAM komut string'iyle dedupe ediyor — farkli path/quoting ikinci AskUserQuestion entry'si uretir

**Dosya:** install.sh:48
**Lens:** correctness
**Sorun:** Guard yalnizca saklanan komut taze CMD ile byte-ozdes ise eslesiyor (CMD `$HOME`-genisletilmis path + tirnaklar + timeout:3600 gomuyor). Farkli path'li mevcut askuserquestionspro hook'u (eski konum, yeniden adlandirilmis bridge) iki AskUserQuestion PreToolUse entry'si verir — issue #15897'deki "tam olarak bir tane olmali" kurali ihlal. reinstall.sh:48-49 dogru yaklasimi (substring `test("askuserquestionspro")`) kullaniyor; install.sh tutarsiz.
**Repro:** install.sh calistir, INSTALL_DIR/bridge adini degistir, tekrar calistir → iki entry.
**Onerilen Fix:** Niyet bazli eslestir: once `test("askuserquestionspro")` eslesen entry'leri sil, sonra tek kanonik entry ekle (reinstall.sh gibi).

### [HIGH] install.sh: jq corrupt settings'te basarisiz olurken yanlislikla 'Hook eklendi' yaziyor

**Dosya:** install.sh:45-55
**Lens:** correctness
**Sorun:** Satir 54 `jq ... && mv ...` ardindan KOSULSUZ `echo "Hook eklendi"`. `.hooks.PreToolUse` array degilse jq exit 5 ile cikar; `&&` sol tarafinda oldugu icin `set -e` abort etmez, mv atlanir ama success mesaji basilir. Kullaniciya kurulu denir, degildir; script MCP kaydina gecer.
**Repro:** settings.json'i `{"hooks":{"PreToolUse":{"x":1}}}` yap, install.sh calistir → "Hook eklendi" ama hook yok.
**Onerilen Fix:** Success echo'yu `&&`-zincirine al; basarisizlikta `{ rm -f "$tmp"; echo "jq hatasi" >&2; }` dali ekle (reinstall.sh:53 gibi).

### [HIGH] reinstall.sh: install.sh'i checksum/imza dogrulamasi olmadan 'curl | bash' ile calistiriyor (supply-chain RCE)

**Dosya:** reinstall.sh:65
**Lens:** security
**Sorun:** `curl -fsSL "$REPO/raw/main/install.sh" | bash` indirilen scripti butunluk kontrolu olmadan kabuga aktariyor. GitHub/branch ele gecirme, MITM veya partial-download'da saldirgan kodu HOME'da calisir; install.sh hook + global MCP kaydi ekledigi icin etki kalici kod yurutmedir. Ayni risk install.sh:13 zip indirmesinde de var.
**Repro:** Saldirgan main'deki install.sh'i degistirir/MITM yapar; her kullanicida arbitrary kod.
**Onerilen Fix:** Sabit tag/commit SHA indir, beklenen SHA-256'yi script icine gomup `shasum -a 256 -c` ile dogrula, sonra calistir. Mumkunse imzali release (cosign/minisign). Pipe-to-bash'i kaldir.

### [HIGH] reinstall.sh:16,25 — $pids/$remaining tirnaksiz, sozcuk bolunmesi yanlis kill

**Dosya:** reinstall.sh:16,25
**Lens:** errorhandling
**Sorun:** `kill $pids` / `kill -9 $remaining` tirnaksiz. lsof coklu PID dondurunce satir sonu icerir; beklenmedik karakterde kill hata verir, `2>/dev/null` yutar — sinyal gitmemis, surec hala calisir.
**Repro:** PORT'ta coklu surec calisirken reinstall.sh.
**Onerilen Fix:** `readarray -t pids < <(lsof -ti "tcp:$PORT" 2>/dev/null); [ ${#pids[@]} -gt 0 ] && kill "${pids[@]}"`.

### [HIGH] install.sh:24 — cp -R hata yakalanmiyor, aciklayici mesaj yok

**Dosya:** install.sh:24
**Lens:** errorhandling
**Sorun:** `set -euo pipefail` var, `cp -R "$DIR/hooks"` basarisizliginda erken cikar (dogru) ama hedef once `rm -rf` ile silindiginden kismi kurulum kalir ve kullaniciya kopyalama hatasi mesaji gosterilmez.
**Repro:** INSTALL_DIR yazma izni kaldir; cp basarisiz, script surpriz cikar, log'da neden yok.
**Onerilen Fix:** `cp -R ... || { echo "HATA: hooks kopyalanamadi"; exit 1; }`.

### [HIGH] reinstall.sh:65 — curl | bash oncesi ag/icerik dogrulamasi yok, hatada kismi bash

**Dosya:** reinstall.sh:65
**Lens:** errorhandling
**Sorun:** curl basarisizsa (`-f`) sifir-byte cikti doner; bash bos stdin'i alip sessizce cikar (exit 0). `set -uo pipefail`'da pipeline exit kodu 0; adim basarili gorunur ama 4/5 adim zaten geri alinmis — arac kaldirilmis, kurulmamis kalir.
**Repro:** Ag baglantisini kes, reinstall.sh — curl hata, bash bos, exit 0.
**Onerilen Fix:** Once mktemp'e indir, `-o` ile, `[ -s ]` ile bos kontrolu, sonra `bash "$tmp_install"`.

### [HIGH] write() basarisiz disk yaziminda yine 'next' dondurup sahte basari bildiriyor

**Dosya:** lib/settings.js:33-36
**Lens:** correctness
**Sorun:** writeFileSync/renameSync throw ettiginde hata yalnizca stderr'e yazilir, ardindan satir 36 yine bellek-ici `next` doner. Cagiran yazma basarisiz olsa bile yeni ayarlari diske yazilmis sanar. (a) server.js:322-323 basarisiz yazmada bile `200 {ok:true}` doner → reload'da kaybolur; (b) cli.js:159-160 basarisizlikta bile "kaydedildi" yazar.
**Repro:** XDG_CONFIG_HOME'u read-only dizine isaret ettir, `Settings.write({theme:'paper'})` → next.theme==='paper' ama disk degismez.
**Onerilen Fix:** Hata yolunda throw/yeniden-firlat ya da `{ ok:false, value: next }` don; cagiranlar (server→500, cli→hata) sinyali kullansin.

### [HIGH] write() basarisiz olunca caller'a false dondurmuyor — sessiz basari yanilsamasi

**Dosya:** lib/settings.js:26-37
**Lens:** errorhandling
**Sorun:** (Yukaridaki ile ayni kök; ayri lens) write() catch'te stderr'e tek satir yazip yine `next` doner. UI "Ayarlar kaydedildi" gosterir ama sonraki okumada eski deger gelir — gizli veri kaybi.
**Repro:** Salt-okunur path'e Settings.FILE isaret ettir, `write({theme:'dark'})` → dolu obje doner, disk degismez.
**Onerilen Fix:** Imza: `function write(patch): { ok: boolean; value?; error? }`.

### [HIGH] Number-key (1-9) scale/ranking/tree icin activate() cagiriyor — state kirleniyor, sahte 'Other' popup aciliyor

**Dosya:** web/app.js:274-277
**Lens:** correctness
**Sorun:** keydown handler herhangi 1-9 rakamini soru-tipi guard'i olmadan `activate(R.current, n-1)`'e yonlendiriyor. scale/ranking/tree kart govdesi onActivate kullanmaz; activate'te non-binary tip decideActivate'in 'single' fallback'ine duser, `opts=(q.options||[]).concat([Other])`. scale icin opts=[{Other}]; '1' → `{sel:[0]}` yazar; tekrar '1' → 'Other' popup acar. State + UI invariant ihlali; sahte sel mapAnswers/summaryText'e sizar.
**Repro:** scale soruyu render et, karti focusla, '1' sonra '1' bas → sel:[0] + Other popup.
**Onerilen Fix:** Number-key dalini soru-tipiyle guard et: `if (!['binary','single','multi'].includes(qType)) return;`.

### [HIGH] Binary activate() bounds kontrolu yok; 3-9 tuslari binary soruyu cevaplanmis isaretler ama submit'te sessizce duser

**Dosya:** web/app.js:98-103
**Lens:** correctness
**Sorun:** Binary fast-path decideActivate'ten ONCE bounds dogrulamasi olmadan `setQ({sel:[optIdx],confirmed:true}); advance()` yapar. '3'..'9' → sel:[2..8], confirmed:true. isAnswered true doner (sidebar/Summary cevaplanmis sayar, canSubmit true) ama mapAnswers `bOpts[s.sel[0]]→undefined→''`, entry atlanir. **Soru her yerde cevaplanmis gorunur ama payload'dan sessizce dusulur — veri kaybi.**
**Repro:** binary soru, karti focusla, '5' bas → confirmed/advanced; Summary'de bos ama cevaplanmis sayilir; submit o soruyu eksik gonderir.
**Onerilen Fix:** Binary dalina bounds check ekle (decideActivate'i ayna). Tercihen binary'yi de decideActivate uzerinden gecir.

### [HIGH] Double-submit guard ref.current.submitted in-flight sirasinda her zaman false — async retry race korunmuyor

**Dosya:** web/app.js:230-241
**Lens:** stateui
**Sorun:** Guard `ref.current.submitted` okuyor. .catch() sonrasi submitted=false, sendError=true. Kullanici onceki retry'in postAnswers'i hala in-flight iken Enter'a basarsa submit() yine cagrilir (submitted false). In-flight izleme yok; iki es zamanli postAnswers ikisi de basarip mukerrer cevap gonderebilir.
**Repro:** postAnswers yavas reject (1s), setSubmitted(false), Enter'a iki kez hizli bas — ikinci ikinci postAnswers'i baslatir.
**Onerilen Fix:** Ayri inflight ref: `const inflight = useRef(false)`; submit'te `if (ref.current.submitted || inflight.current) return;`; postAnswers oncesi true, .then/.catch'te false.

### [HIGH] CustomPopup popup.qid stale olunca undefined `q` aliyor

**Dosya:** web/app.js:345
**Lens:** errorhandling
**Sorun:** `QUESTIONS.find(q => q.question === popup.qid)` yeni round push edildiyse undefined doner; bu dogrudan `q` prop'u olarak CustomPopup'a gecer, ilk property erisiminde TypeError. find sonucunda null guard yok.
**Repro:** Popup acikken bridge yeni soru round'u push etsin; popup acik kalir, find undefined, CustomPopup ilk prop erisiminde cokssun.
**Onerilen Fix:** `const popupQ = popup ? QUESTIONS.find(...) : null;` ve `{popup && popupQ && <CustomPopup ... />}`; stale popup'i `useEffect([popup,QUESTIONS])` ile auto-dismiss.

### [HIGH] savePopup/removeCustom popup.qid prev'de yoksa sessizce throw eder

**Dosya:** web/app.js:170-198
**Lens:** errorhandling
**Sorun:** setAnswers updater'inda `prev[p.qid]` stale round'da undefined olabilir; `savePopupState(a=undefined, ...)` answer-map.js:134'te `a.sel.filter()`'da throw eder. React setState updater'indaki hatalari yutar — error boundary tetiklenmez, sendError set edilmez, popup temizlenmez. UI acik popup ile asili kalir.
**Repro:** 'Other' popup ac, server'dan yeni round tetikle, Save bas — updater sessizce throw, popup kalir.
**Onerilen Fix:** Iki updater basina `const a = prev[p.qid]; if (!a) return prev;` ekle; sonraki `setPopup(null)` yine yetim popup'i kapatir.

### [HIGH] Error toast 'Press Enter to retry' diyor ama Summary disindayken Enter retry yapmiyor

**Dosya:** web/app.js:261-270, 363-366
**Lens:** errorhandling
**Sorun:** postAnswers reject sonrasi sendError=true; toast kosulsuz "Press Enter to retry" der. Klavye handler Enter'da yalnizca `R.isSummary` ise submit() cagirir. Kullanici Summary'den ayrildiysa Enter confirmCurrent() cagirir; retry talimati yalan, kullanicinin klavyeyle resubmission yolu yok.
**Repro:** Soru kartinda (Summary degil), Summary'den submit et, network hata al, Summary'den ayril, Enter bas → confirmCurrent, retry yok.
**Onerilen Fix:** (A) submit-fail'de Summary'ye geri don; (B) Enter handler'ina `sendError && !R.isSummary` dali; (C) toast'a retry butonu.

### [HIGH] CustomPopup: kapaninca return-focus yok (focus kaybolur)

**Dosya:** web/app.js:66-67, 352
**Lens:** accessibility
**Sorun:** Popup acilista textarea focus alir (dogru) ama kapaninca (onCancel/savePopup/removeCustom → setPopup(null)) tetikleyen elemana focus geri verilmez; DOM unmount olur, focus `<body>`'ye duser, klavye kullanicilari yonsuz kalir.
**Repro:** Popup ac, Escape/Cancel ile kapat, Tab/ok bas — focus body'de.
**Onerilen Fix:** `triggerRef.current = document.activeElement` setPopup oncesi; her kapanis yolunda `triggerRef.current?.focus()`.

### [HIGH] CustomPopup overlay modal/dialog rolu degil; aria-modal/aria-labelledby yok

**Dosya:** web/views.js:908-958
**Lens:** accessibility
**Sorun:** `.overlay` ve `.popup` div'lerinin ARIA rolu yok; ekran okuyucu dialog olarak duyurmaz, sanal imleci icinde tutmaz, basligi soylemez. role="dialog"/aria-modal olmadan kullanici popup arkasinda gezebilir (WCAG 4.1.2).
**Repro:** NVDA/VoiceOver ile Other popup ac — "dialog" duyurulmaz, arka icerik okunur.
**Onerilen Fix:** `.popup`'a `role="dialog" aria-modal="true" aria-labelledby="popup-title"`; `.popup__title`'a `id="popup-title"`.

### [HIGH] Toast bildirimleri aria-live yok; hata/onay ekran okuyuculara gorunmez

**Dosya:** web/app.js:355-367
**Lens:** accessibility
**Sorun:** Iki toast div'i sade `<div>`; role="alert"/aria-live/aria-atomic yok. Live region olmadiklari icin DOM'a eklenince duyurulmaz.
**Repro:** Ekran okuyucu, 'Submit answers' tikla — success toast gorunur ama duyurulmaz.
**Onerilen Fix:** success → `role="status" aria-live="polite"`, error → `role="alert" aria-live="assertive"`, ikisine `aria-atomic="true"`.

### [HIGH] QuestionCard gecisi aria-live/aria-busy yok — ekran okuyucu icerik degisimini bilmiyor

**Dosya:** web/app.js:315-341
**Lens:** accessibility
**Sorun:** `current` degisince QuestionCard `key` ile takas edilir; `.stage` div'i aria-live ile sarili degil, aria-busy yok. Ekran okuyucu yeni soruyu otomatik tekrar okumaz; slide animasyonunun erisilebilir karsiligi yok.
**Repro:** NVDA Browse mode, ArrowRight — yeni soru basligi duyurulmaz.
**Onerilen Fix:** `.stage`'i `aria-live="polite" aria-atomic="true"` ile sar, ya da gorunmez aria-live region ile yeni soru metnini duyur.

### [HIGH] Coklu onerror timer'lari orphan birakip unmount sonrasi ghost EventSource acabilir

**Dosya:** web/live.js:22-25
**Lens:** performance
**Sorun:** Browser onerror'i hizla coklu fire ederse her cagri `timerRef.current`'i oncekini clear etmeden uzerine yazar. Cleanup yalnizca son timer'i iptal eder; onceki orphan timer'lar fire edip connect() cagirir, yeni EventSource olusturur — CONNECTING'de network socket sizdirir.
**Repro:** EventSource.onerror'i 3 kez senkron fire ettir; timerRef yalnizca son id'yi tutar, oncekiler hala connect() cagirir.
**Onerilen Fix:** onerror icinde yeni timer kurmadan once `clearTimeout(timerRef.current)`.

### [HIGH] settings-panel cancel() in-flight save sirasinda yapilan live preview degisikliklerini geri almaz

**Dosya:** web/settings-panel.js:101-130
**Lens:** correctness
**Sorun:** save() async iken kullanici 'live' ayar (theme/uiScale) degistirir; change() bunu aninda DOM'a uygular, saved=false yapar. Eski save resolve olunca .then kosulsuz saved=true + baseline=eski snapshot yapar. Sonraki cancel()'da `if (!saved)` false oldugu icin applyAll(baseline) calismaz; in-flight live preview kalici yapisir.
**Repro:** Settings ac → theme degistir → Save (yavas) → donmeden uiScale degistir → resolve (saved=true) → Cancel. uiScale geri alinmaz.
**Onerilen Fix:** saving guard tut; istek aninndaki draft'i yakala, yanit gelince yalnizca draft hala ayni ise saved=true yap; Save butonunu saving iken disable et.

### [HIGH] TreeCard: setQ({path}) confirmed:false sifirlamiyor — back-navigation'da bozuk state

**Dosya:** web/views.js:694
**Lens:** stateui
**Sorun:** handleSelect non-leaf icin `setQ({path})` cagirir; setQ shallow merge, confirmed sifirlamaz. Geri donup branch node secince state `{confirmed:true, path:<non-leaf>}` olur: isAnswered false ama sidebar checkmark gosterir, summaryText (leaf guard yok) kismi path'i "confirmed" gibi cizer.
**Repro:** Tree soruda leaf sec (auto-advance), ← geri don, non-leaf branch tikla → sidebar checkmark, summary kismi path.
**Onerilen Fix:** handleSelect'te non-leaf'e dalinca `setQ({path:newPath, confirmed:false})`; handleBack'te de confirmed reset.

### [HIGH] SettingsModal: save() in-flight race — Escape/cancel fetch beklerken modal kapanir, tutarsiz state

**Dosya:** web/settings-panel.js:107-129
**Lens:** stateui
**Sorun:** save() in-progress guard yok. Escape/overlay-click cancel() cagirir: applyAll(baseline) revert + onClose() unmount; sonra fetch resolve olup `window.__ASKUSER_SETTINGS__=res.settings` set eder ama UI revert etmistir. Sunucu yeni, DOM eski; needsReload gosterilmez; kullanici save'in basarili oldugunu bilmez. Cift Save da korunmuyor.
**Repro:** Settings ac, deger degistir, Save tikla, hemen Escape — server kaydeder, DOM revert eder, reload banner gosterilmez.
**Onerilen Fix:** isSaving flag (fetch oncesi true, .then/.catch'te false), Save disable + cancel/Escape baski; AbortController ile in-flight fetch'i unmount'ta iptal.

### [HIGH] Accordion toggle button eksik aria-expanded

**Dosya:** web/views.js:138
**Lens:** accessibility
**Sorun:** `.qgroup__header` accordion toggle ama aria-expanded yok; ekran okuyucu acik/kapali bilemez (APG ihlali).
**Repro:** Grup basligina focusla, Space/Enter ile toggle — 'expanded/collapsed' duyurulmaz.
**Onerilen Fix:** `aria-expanded={isOpen} aria-controls={\`qgroup-body-${title}\`}`; body'ye id ekle.

### [HIGH] Range input (ScaleCard) eksik aria-label ve aria-valuetext

**Dosya:** web/views.js:516-526
**Lens:** accessibility
**Sorun:** `<input type="range">` aria-label/labelledby/title tasimiyor; q.question iliskili degil; leftLabel/rightLabel ekran okuyuculara iletilmiyor (WCAG 1.3.1, 4.1.2).
**Repro:** Scale soruyu ekran okuyucuyla ziyaret et — slider'da anlamli etiket yok.
**Onerilen Fix:** `aria-label={q.question}` + `aria-valuetext`.

### [HIGH] RankingCard container role/aria-label tasimiyor

**Dosya:** web/views.js:596
**Lens:** accessibility
**Sorun:** `.ranking` div'i odak alan interaktif bolge ama role yok; ekran okuyucu sira/grabbed durumunu belirtmez.
**Repro:** Ranking soruda Space ile ogeyi kap — 'alindigi' duyurulmaz.
**Onerilen Fix:** `role="list" aria-label`; satirlara `role="listitem"`, grabbed'da aria-label; degisimi aria-live ile duyur.

### [HIGH] TreeCard container role tasimiyor

**Dosya:** web/views.js:738
**Lens:** accessibility
**Sorun:** `.tree` div'i klavye navigasyonu yapar ama role yok; hiyerarsik yapi duyurulmaz. Breadcrumb butonlari tabIndex={-1}, kisayollar ARIA ile belgesiz.
**Repro:** Tree soruda gez — hiyerarsi duyurulmaz.
**Onerilen Fix:** `role="tree" aria-label`; her opt'a `role="treeitem" aria-expanded={!isLeaf}`.

### [HIGH] SettingRow toggle switch eksik aria-label

**Dosya:** web/settings-panel.js:39-48
**Lens:** accessibility
**Sorun:** Toggle role="switch"/aria-checked tasiyor (dogru) ama erisilebilir isim yok; bitisik label programatik iliskili degil (WCAG 4.1.2).
**Repro:** Settings modalini VoiceOver ile ac, toggle'a focusla — hangi ayar oldugu duyulmaz.
**Onerilen Fix:** `aria-labelledby` ile label'i isaret ya da `aria-label={entry.label}`.

### [HIGH] ranking mapAnswers bounds yok → TUM mapAnswers cokebilir

**Dosya:** web/answer-map.js:64-67
**Lens:** correctness
**Sorun:** ranking dali `q.options[i].label`'i guardsiz okur; OOB indeks TypeError firlatir, forEach icinde yakalanmadigindan TUM mapAnswers cokup HIC cevap dondurmez. single/multi/binary/tree guard tutuyor; ranking tutmuyor.
**Repro:** options uzunlugu 3, state.order=[0,1,3] → `q.options[3].label` TypeError.
**Onerilen Fix:** `var o=q.options[i]; if(!o) return null;` sonra `.filter(Boolean)`; bos order'da soruyu atla.

### [HIGH] ranking summaryText bounds yok → summaryText cokebilir

**Dosya:** web/answer-map.js:184-188
**Lens:** correctness
**Sorun:** summaryText ranking dali da `a.order`'i guardsiz okur; OOB indekste TypeError; sidebar/ozet render'inda patlar (mapAnswers'tan daha gorunur). tree dali korumali — tutarsizlik.
**Repro:** `summaryText({type:'ranking',options:[{label:'A'},{label:'B'}]}, {order:[5,0]})` → TypeError.
**Onerilen Fix:** map icinde guard + filter; ortak guard'li yardimci cikar.

### [HIGH] tree mapAnswers kirik path'te son gecerli yaprakta partial cevap yayinliyor; isAnswered ile celisir

**Dosya:** web/answer-map.js:73-83
**Lens:** correctness
**Sorun:** Gecersiz path adiminda dongu break eder ama lastNode son gecerli dugumde kalir; o yaprak ise TRUNCATED path 'tam cevap' gibi out'a yazilir. isAnswered ise treeNodeAt ile ilk gecersiz indekste null doner → false. mapAnswers ile isAnswered ayrisir; iki invariant ihlal.
**Repro:** options=[{label:'A'}] (A leaf), state.path=[0,2] → mapAnswers ['A'] yayinlar; isAnswered false. Celiski.
**Onerilen Fix:** tree dalini treeNodeAt/isLeaf uzerinden tek kaynaktan yur: `node=treeNodeAt(q,s.path); if(!node || !isLeaf(node)) return;`.

### [HIGH] decideActivate multi: stale customText popup'siz sessiz re-add (test edilmemis armed-toggle yolu)

**Dosya:** web/answer-map.js:107-120
**Lens:** testcoverage
**Sorun:** Satir 119 guard'i `if (isCustom && !a.customText)` yalnizca customText falsy ise popup acar. customText bos-degil ama custom sel'de DEGIL ise (kullanici metin girip secimi temizledi), Other'a tekrar tiklayinca stale customText ile sessizce re-add eder; kullanici onaylayamaz. Test yalnizca `customText:''` gecirir.
**Repro:** `decideActivate(multiQ, {sel:[], customText:'stale answer'}, 2)` → `{type:'toggle', sel:[2]}` — popup yok.
**Onerilen Fix:** Guard'i `if (isCustom) return { type:'popup', optIdx, draft: a.customText || '' }` yap.

### [HIGH] isAnswered(ranking) mapAnswers'i cokerten state'ler icin true donuyor — kontrat tutarsizligi, test yok

**Dosya:** test/answer-map.test.js:258-263
**Lens:** testcoverage
**Sorun:** isAnswered ranking yalnizca `order.length>0` dogrular; indeks bounds dogrulamaz. Boylece mapAnswers'i cokerten state icin true doner. `isAnswered(ranking,{order:[0,99]})===false` test edilmiyor.
**Repro:** `isAnswered(rq,{order:[0,99]})` → true; `mapAnswers(...,{order:[0,99]})` → crash.
**Onerilen Fix:** Test ekle + isAnswered'a bounds dogrulamasi VEYA mapAnswers/summaryText'e null guard (defense in depth).

### [HIGH] swapFont: document.head null TypeError

**Dosya:** web/themes.js:305
**Lens:** testcoverage
**Sorun:** swapFont `typeof document==='undefined'` kontrol eder ama `document.head` null'a karsi korumasiz; frameless/test ortamlarinda `document.head.appendChild` TypeError. DOM mutasyon yolu try/catch'siz, sifir test.
**Repro:** `document.head` null jsdom'da `apply('paper')` → themes.js:323 swapFont cagrisi throw.
**Onerilen Fix:** `if (!document.head) return;` (304); ya da 293-308'i try/catch'le sar. Test ekle.

### [HIGH] read(): uc cascade dali (server-inject, URL param, localStorage) test edilmemis

**Dosya:** web/themes.js:255-284
**Lens:** testcoverage
**Sorun:** read() sifir test; uc oncelikli fallback dali (window.**ASKUSER_SETTINGS**, location.search, localStorage) her biri sessiz catch ile duser. Kritik test edilmemis modlar: bilinmeyen theme id, localStorage throw (Safari private), Node (no window).
**Repro:** Node test: `global.window={__ASKUSER_SETTINGS__:{theme:'nonexistent'}}`, read() → DEFAULT_ID beklenir.
**Onerilen Fix:** read'i export et (veya wrapper), her dali izole mock'la, gecersiz-id/exception varyantlari ekle.

### [HIGH] mcp-server.test.js: child process timeout/spawn-error'da zombie sizdiriyor

**Dosya:** test/mcp-server.test.js:18-65
**Lens:** testcoverage
**Sorun:** `child.kill()` (64) `await new Promise()` DISINDA. Promise reject olunca (5000ms timeout veya child.on('error')) await throw eder, satir 64'e ulasilmaz; spawned child test worker cikana kadar calisir.
**Repro:** Timeout'u artir / stdin yazimini boz; test sonrasi node surecini incele — child kalir.
**Onerilen Fix:** `try { await new Promise(...) } finally { child.kill() }`.

> Not: Bu zombie-process bulgusu test paketinde **bes ayri kez** dogrulanmis (test/mcp-server.test.js:18-65, 18-64, 19/64, 19-64, 18-63) — hepsi ayni kök neden.

### [HIGH] server.test.js: concurrent /ask (409) ve /answer pending-yok (409) yollari test edilmemis

**Dosya:** test/server.test.js
**Lens:** testcoverage
**Sorun:** Iki 409 dali var: pending iken ikinci /ask (server.js:257), pending yokken /answer (server.js:302). Hicbiri test edilmiyor; concurrent-/ask race'i gorunur HTTP semantigiyle test edilmemis.
**Repro:** /ask tut (cevaplamadan), ikinci /ask gonder — 409 beklenir, assertion yok.
**Onerilen Fix:** (a) iki es zamanli /ask → ikinci 409; (b) pending yokken /answer → 409.

### [HIGH] mapAnswers ranking: out-of-range indeks TypeError (tekrar dogrulanmis)

**Dosya:** web/answer-map.js:63-67
**Lens:** correctness
**Sorun:** `s.order.map(i => q.options[i].label)` bounds korumasi yok; order q.options'i asarsa TypeError. single/multi (`if(!o)return''`) ve tree (`if(!node)break`) korumali; ranking degil. mapAnswers cevabin hook'a gonderilmesinde kullanildigindan crash tum haritalamayi bozar.
**Repro:** options 3 eleman, state.order=[3,0,1].
**Onerilen Fix:** `var o=q.options[i]; return o?o.label:'';` + bos filtre.

### [HIGH] summaryText ranking: out-of-range indeks ayni crash (ozet render'inda)

**Dosya:** web/answer-map.js:182-188
**Lens:** correctness
**Sorun:** `a.order.map(i => q.options[i].label).join(' → ')` korumasiz; UI render path'inde patlar. tree korumali, tutarsizlik.
**Repro:** `summaryText({type:'ranking',options:[{label:'A'},{label:'B'}]}, {order:[2,0]})`.
**Onerilen Fix:** map icinde guard + filter.

---

### [MEDIUM] Bridge: provideAnswers/cancel \_pending'i resolve oncesi null yapiyor (dogru) ama gec onClose yeni turu iptal edebilir

**Dosya:** server/bridge.js:33-48
**Lens:** concurrency
**Sorun:** Bridge icinde sira dogru ama lifecycle kaniti server.js'te: resolve continuation mikrotaskta calisirken ayni request'in res 'close'u tetiklenirse onClose (settled hala false) cancel cagirir. O an yeni tur kurulmussa eski request'in gec onClose'u YENI turu iptal eder. cancel id ile dogrulamaz.
**Repro:** A /ask (id=1), /answer resolve, continuation oncesi A socket kapanir, B /ask (id=2) yeni pending, A'nin gec onClose'u B'yi iptal eder.
**Onerilen Fix:** cancel'a `expectedId` ekle; onClose sahiplendigi id ile cagirsin.

### [MEDIUM] submitQuestions senkron throw etmiyor; 409 yalnizca ikinci catch sayesinde calisiyor (kirilgan)

**Dosya:** server/server.js:253-258
**Lens:** correctness
**Sorun:** Kod 'pending var' durumunu 254-258 try/catch ile yakalamayi varsayiyor ama submitQuestions senkron throw ETMEZ, Promise.reject DONER. Try/catch tetiklenmez; 409 aslinda 274-276'daki ikinci catch'ten doner — 256-258 olu kod. Reddedilmis istek de close handler kaydeder, sahiplenmedigi pending'i iptal etme riski tasir.
**Repro:** /ask beklerken ikinci /ask → 409 ama 274-276'dan.
**Onerilen Fix:** /ask basinda `bridge.peek()` ile senkron kontrol + erken 409 (close handler kaydetmeden), VEYA submitQuestions'i senkron throw'a cevir.

### [MEDIUM] Daemon spawn yarisi: ensureServer eszamanli cagrilarda mukerrer surec; EADDRINUSE sessiz exit(0)

**Dosya:** lib/bridge-client.mjs:32-47
**Lens:** concurrency
**Sorun:** isUp() false → spawn. Iki surec ayni anda isUp()=false gorup ayri daemon spawn eder; ikinci listen EADDRINUSE alir, server.js:339 process.exit(0) ile sessizce cikar. Asil risk server.js:340 'throw e': EADDRINUSE disi hata detached/stdio:'ignore' surecte yakalanmaz, stack'siz olur; child exit izlenmedigi icin orphan olasiligi.
**Repro:** Iki MCP/hook ornegini eszamanli baslat (server kapali).
**Onerilen Fix:** server.js:340 throw'u stderr log + exit(1) yap; ensureServer'da kisa lock dosyasi (flock/O_EXCL) ile tek baslatici garanti et.

### [MEDIUM] readBody 8MB asiminda promise reject edilmiyor; 'close' yutulup istek asili kalabilir

**Dosya:** server/server.js:32-46
**Lens:** concurrency
**Sorun:** 8e6 asiminda req.destroy() cagirir ama o anda reject ETMEZ; reddetmeyi 'close' handler'ina (`if(!req.readableEnded)`) birakir. (1) 'end'/'close' yarisi: son chunk hem asip hem bitirirse 'end' once resolve(data) ile devasa govde akar; (2) reddetme deterministik tek noktaya bagli degil.
**Repro:** 8MB'i tek/son chunk'ta asan POST.
**Onerilen Fix:** Asim dalinda destroy ardindan hemen reject + `aborted` guard.

### [MEDIUM] readBody: destroy() sonrasi ne 'end' ne 'close' fire ederse promise kalici asili

**Dosya:** server/server.js:34-44
**Lens:** errorhandling
**Sorun:** req.destroy() 'close'un fire edecegini garanti etmez (socket zaten destroyed ise). 'close' ve 'end' fire etmezse promise hic settle olmaz; handler await'te takilir, response yazilmaz, baglanti sizar; await'i koruyan timeout yok.
**Repro:** Yari-destroyed socket ile >8MB chunked istek.
**Onerilen Fix:** 'data' handler'inda reject; destroy korunursa one-shot 'close' listener'i kosulsuz reject etsin.

### [MEDIUM] broadcastCurrent: basarisiz res.write() sessizce yutuluyor; olu SSE baglantilari birikiyor

**Dosya:** server/server.js:165-174
**Lens:** errorhandling
**Sorun:** catch yalnizca senkron throw'da fire eder; res.write() cogu Node yolunda 'error'i ASENKRON emit eder. Bu durumda istisna yutulur, istemci sseClients'ta kalir; olu baglantilar process-restart'a kadar sinirsiz birikir.
**Repro:** Tab kapanir; socket 'error'/'close' emit eder ama res.write() senkron throw etmez.
**Onerilen Fix:** /events handler'daki 'close' listener'ina guven (zaten siliyor); try/catch'i kaldir ya da `if(!res.writable){delete;continue;}`.

### [MEDIUM] readBody: Buffer chunk'larini string concat ile O(n²) bellek

**Dosya:** server/server.js:30-38
**Lens:** performance
**Sorun:** `let data=''` + `data += c` (c Buffer) her seferinde Buffer'i UTF-8'e cevirip kumulatif yeni string allocate eder. 8MB / 16KB chunk (~500 iter) ~2GB ara string; heap baskisi/GC pause.
**Repro:** 6-8MB JSON ile POST /ask, V8 heap'i izle.
**Onerilen Fix:** `chunks.push(c)`, sonda `Buffer.concat(chunks).toString('utf8')`.

### [MEDIUM] serveStatic: her static asset isteginde cache'siz fs.readFile

**Dosya:** server/server.js:187
**Lens:** performance
**Sorun:** Her GET'te fs.readFile; in-memory cache yok, non-index asset'lerde ETag/Cache-Control yok (tarayici da cache'leyemez). index.html her istekte UTF-8 decode + regex replace.
**Repro:** DevTools Network, sayfayi reload — her asset 200, cache header yok.
**Onerilen Fix:** Immutable asset'lere Cache-Control immutable; non-hash'lere ETag (mtime/hash) + 304; index.html base HTML'i startup'ta cache'le.

### [MEDIUM] Settings.read() her index.html ve /settings POST'unda fs.readFileSync — event loop bloke

**Dosya:** server/server.js:195
**Lens:** performance
**Sorun:** serveStatic'te async readFile callback'i icinde senkron Settings.read() (fs.readFileSync). POST /settings'te write→read+writeFileSync+renameSync uc bloke syscall. Es zamanli /ask long-poll bu sure boyunca stall eder.
**Repro:** /ask long-poll aktifken /settings POST tetikle.
**Onerilen Fix:** Settings'i bellekte cache'le, write'ta invalidate; senkron FS'leri fs.promises'a cevir.

### [MEDIUM] askBridge() — r.json() parse hatasi yakalanmiyor, timeout gibi gorunuyor

**Dosya:** lib/bridge-client.mjs:82
**Lens:** errorhandling
**Sorun:** isUp() parse hatasini yutuyor (bilincli) ama askBridge:82'de .catch yok; sunucu gecersiz JSON (503/HTML) dondurUrse SyntaxError finally'den gecip caller'a ulasir, timeout gibi gorunUr, log'lari kirletir.
**Repro:** Sunucu 200 OK ama body='<html>error</html>'.
**Onerilen Fix:** `await r.json().catch(e => { throw new Error('bridge returned invalid JSON: '+e.message); })`.

### [MEDIUM] ensureServer() — spawn hatasini sessizce yutuyor, polling neden basarisiz bilinmiyor

**Dosya:** lib/bridge-client.mjs:40
**Lens:** errorhandling
**Sorun:** `child.on('error', () => {})` spawn hatasini (ENOENT/izin) tumuyle yutar; 3sn polling sonra sessizce false. Caller spawn mi yavas mi port-mu-tutulu bilemez.
**Repro:** server.js'i sil; ensureServer 3sn bekleyip false, log yok.
**Onerilen Fix:** `let spawnError; child.on('error', e => spawnError=e)`; poll sonrasi `if(spawnError) throw/console.error`.

### [MEDIUM] sendResponse — STDOUT write hatasi yutulmuyor ama yanit kaybi sessiz

**Dosya:** mcp-server/askuserquestionspro-mcp.mjs:94-97
**Lens:** errorhandling
**Sorun:** process.stdout.write throw ederse (broken pipe) exception handleMessage catch'ine ulasir, sendError de yine throw eder, uncaughtException'a duser. Client ilgili id icin hic yanit almaz, sunucu kayit tutmaz. Partial-write'ta bozuk JSON gider.
**Repro:** MCP host stdin'i kapatirken yanit gonderiliyorsa (race).
**Onerilen Fix:** sendResponse'i try/catch ile sar, stderr'e logla; write callback'i kontrol et.

### [MEDIUM] ensureServer — spawn hatasi stderr'e hic loglanmiyor

**Dosya:** lib/bridge-client.mjs:40
**Lens:** errorhandling
**Sorun:** (Yukaridakiyle ayni kök, ek vurgu) spawn hatasi tumuyle sessiz; operator server'in neden baslatilamadigini ogrenemez.
**Repro:** server/server.js silinmis/izin yok iken MCP tool cagrisi.
**Onerilen Fix:** `child.on('error', e => process.stderr.write('[mcp] server spawn failed: '+e+'\n'))`.

### [MEDIUM] readStdin() suresiz asilabilir — hata yolu native picker'a dusmez

**Dosya:** hooks/askuserquestionspro-bridge.mjs:14-21
**Lens:** correctness
**Sorun:** readStdin yalnizca 'end'/'error'da resolve; timeout yok. Parent stdin yazma ucunu acik tutarsa 'end' gelmez, Promise cozulmez, main() suresiz asili; ne cikar ne native picker'a duser. uncaughtException/unhandledRejection HANG'i yakalayamaz.
**Repro:** Hook'u stdin yazma ucu acik (EOF yok) cagir.
**Onerilen Fix:** readStdin'e watchdog timeout / Promise.race(setTimeout); sure dolarsa process.exit(0).

### [MEDIUM] writeAndExit: stdout write hatasi (EPIPE) sessizce yutulup yine process.exit(0)

**Dosya:** hooks/askuserquestionspro-bridge.mjs:24-27
**Lens:** errorhandling
**Sorun:** `process.stdout.write(payload, () => process.exit(0))` callback'i (err) imzasiyla cagrilir; mevcut kod err'i almiyor — EPIPE/EBADF sessizce yutulur. Hook stdout'a hicbir sey yazmamis olsa da exit(0); native fallback kazara dogru ama veri kaybi nedeni izlenemez.
**Repro:** Hook calisirken Claude stdin pipe'ini erkenden kapat.
**Onerilen Fix:** `(err) => { if (err && process.stderr.writable) stderr.write('stdout write error: '+err.message); process.exit(0); }`.

### [MEDIUM] reinstall.sh:59 — rm -rf INSTALL_DIR basarisiz olsa bile 'silindi' basiliyor

**Dosya:** reinstall.sh:59
**Lens:** errorhandling
**Sorun:** `rm -rf && echo "silindi"` dogru ama `set -e` yokken rm gercekten basarisizsa (kilitli dizin) hata gosterilmez, script sessizce devam edip eski dosyalarla yeniden kurar.
**Repro:** INSTALL_DIR altinda baska kullaniciya ait dosya olustur.
**Onerilen Fix:** `... || echo "UYARI: $INSTALL_DIR silinemedi — devam ediliyor"`.

### [MEDIUM] write() hata yolu icin test yok — kontrat boslugu kapsanmamis

**Dosya:** test/settings.test.js:191-232
**Lens:** correctness
**Sorun:** write() yalnizca happy-path test ediliyor; yazma basarisizligi (writeFileSync/renameSync throw) test edilmiyor — tam da kontrat ihlali olan yol. Regresyon sessizce gecer.
**Onerilen Fix:** Yazilamaz hedef (read-only / mock throw) ile test; basarisizligin caller'a iletildigini ve diskin degismedigini dogrula.

### [MEDIUM] Yazma basarisizliginda .tmp dosyasi diskte kaliyor — temizleme yok

**Dosya:** lib/settings.js:30-35
**Lens:** errorhandling
**Sorun:** writeFileSync(tmp) basarili, renameSync basarisiz (cross-device/izin) olursa `FILE+'.tmp'` kalir; surec o noktada olurse stale .tmp sonsuza kalir. catch'te unlink denenmiyor.
**Repro:** rename fail ettirip process.exit ile sureci oldur.
**Onerilen Fix:** catch'e `try { fs.unlinkSync(tmp); } catch {}`.

### [MEDIUM] goBack() ref.current.answers ile ilk unconfirmed ariyor — geri donuste confirmed sifirlanmadigindan hedef yanlis

**Dosya:** web/app.js:85-88
**Lens:** stateui
**Sorun:** goBack() confirmed===false ilk soruyu bulur ama confirmed back-navigation'da sifirlanmaz. Tum sorular confirmed iken (hepsi gezilip geri donuldu) goBack findIndex=-1 → n-1 (son soru)'ya gider, mevcut pozisyondan bir adim geri yerine.
**Repro:** 5 soruyu onayla, summary, ArrowLeft ile Q3'e don, 'b' bas → Q5'e gider (Q2 yerine).
**Onerilen Fix:** goBack semantik olarak 'son ziyaret edilen'; `const idx = ref.current.current >= n ? n-1 : Math.max(0, ref.current.current-1); goTo(idx,'left')`.

### [MEDIUM] jumpToNextUnanswered yonu stale ref.current.current ile hesaplaniyor

**Dosya:** web/app.js:202-207
**Lens:** stateui
**Sorun:** Yon idx ile ref.current.current karsilastirilarak belirlenir; React 18'de setCurrent queue'lanip render olmadan jumpToNextUnanswered cagrilirsa ref pre-navigation degeri olur, yon ters cevrilir (bir frame yanlis slide). Gorsel glitch, veri bozulmasi degil.
**Repro:** Q3'te 'u' iki kez hizli; ikinci cagri ilk navigation render'indan once.
**Onerilen Fix:** current'i useCallback closure'indan al (deps'e ekle), ref detour'u birak.

### [MEDIUM] key={QUESTIONS[current].question} ayni metinli sorularda cakisir — remount olmaz, stale state sizar

**Dosya:** web/app.js:329
**Lens:** stateui
**Sorun:** key olarak soru metni kullaniliyor. Ayni set'te iki ayni metinli soru olursa React remount etmez; internal state korunur. answers da metinle key'lendiginden `answers[q.question]` ikisi icin ayni objeyi doner — cevap izolasyonu ihlal.
**Repro:** questions=[{question:'Rate this',type:'scale'},{question:'Rate this',type:'binary'}] → remount yok, answer paylasilir.
**Onerilen Fix:** Stable unique id/index kullan (`key={q.id || i}` ya da `key={current}`); answers'i da index/id ile key'le.

### [MEDIUM] postAnswers catch error tipini atiyor — 4xx sessizce kaybolur, kullanici sonsuz retry

**Dosya:** web/app.js:236-240
**Lens:** errorhandling
**Sorun:** `.catch(() => {...})` error'u tumuyle atiyor. postAnswers hem network (recoverable) hem HTTP 4xx/5xx'te throw eder; 422/400/500 ayni 'bridge unavailable' toast'i + ayni retry talimati gosterir. 4xx retry hep basarisiz; cevap sessizce kaybolur, escalation yok.
**Repro:** Server /answer'da 500 dondursun → toast 'bridge unavailable', kullanici sonsuz Enter.
**Onerilen Fix:** `.catch(err => { const isNet = err instanceof TypeError; setSendError(isNet?'network':'server'); })`; ayri mesajlar.

### [MEDIUM] submit() cevaplari stale ref.current.answers'a karsi map ediyor (live state degil)

**Dosya:** web/app.js:214-228
**Lens:** errorhandling
**Sorun:** mappedAnswers() ref.current.answers'i okur; ref her render'da yazilir. submit() ayni React event batch'inde (answers pending, render olmamis) cagrilirsa ref bir render geride olabilir — stale-closure tehlikesi. Summary'de son setQ'dan hemen sonra Enter'da yuzeye cikar.
**Repro:** setQ patch ardindan ayni microtask'ta Enter keydown dispatch et — payload son degisimi atlar.
**Onerilen Fix:** answers'i mappedAnswers'a parametre olarak gec; submit deps'ine answers ekle, ref detour'u birak.

### [MEDIUM] Klavye kisayollari (1-9, Enter, u, b) aria-keyshortcuts ile ekran okuyuculara aciklanmiyor

**Dosya:** web/app.js:274-283
**Lens:** accessibility
**Sorun:** Global kisayol handler 1-9/Enter/u/b/oklar dinler; interaktif kontroller aria-keyshortcuts tasimaz. Legend gorsel Kbd gosterir ama ARIA ile baglanmamis (WCAG 2.1.4).
**Repro:** VoiceOver, option butonuna git — '1 ile sec' duyulmaz.
**Onerilen Fix:** Her aktive edilebilir kontrole `aria-keyshortcuts`; legend'i `<nav aria-label>` ile sar.

### [MEDIUM] SidebarSearch input: aria-label / <label> yok

**Dosya:** web/views.js:171-177
**Lens:** accessibility
**Sorun:** `<input placeholder="Filter questions…">` label/aria-label/labelledby yok; placeholder guvenilir accessible-name degil ve yazinca kaybolur (WCAG 1.3.1, 4.1.2).
**Repro:** VoiceOver ile input'a git — etiketsiz 'text field'.
**Onerilen Fix:** `aria-label="Filter questions"` ya da gizli `<label htmlFor>`.

### [MEDIUM] QItem sidebar butonlari: mevcut soru yalnizca data-active ile, aria-current/aria-pressed yok

**Dosya:** web/views.js:57-75
**Lens:** accessibility
**Sorun:** data-active/data-state CSS attribute'lari AT'ye gorunmez; ekran okuyucu hangi sorunun aktif oldugunu belirleyemez (WCAG 1.3.1).
**Repro:** NVDA, sidebar butonlarinda Tab — hicbiri 'current' demez.
**Onerilen Fix:** `aria-current="step"` (i===current); tamamlanma durumunu aria-label'a ekle.

### [MEDIUM] RankingCard: grabbed/cursor durumu aria-grabbed/aria-roledescription yok

**Dosya:** web/views.js:596-635
**Lens:** accessibility
**Sorun:** Custom klavye drag-drop (Space grab, Up/Down reorder); container role yok, satirlar data-cursor/data-grabbed kullaniyor ama ARIA esdeger yok, hareket duyurusu yok. Ekran okuyucu reorder'i iletemez.
**Repro:** VoiceOver, ranking, Space + Up — geri bildirim yok.
**Onerilen Fix:** `role="listbox"`, satirlar `role="option" aria-selected/aria-grabbed`; gizli `aria-live="assertive"` ile pozisyon duyur; `aria-roledescription="sortable item"`.

### [MEDIUM] Progress bar: progressbar role/aria-valuenow/aria-valuemax yok

**Dosya:** web/views.js:254-256
**Lens:** accessibility
**Sorun:** Ic ice iki div, role="progressbar"/valuenow/valuemin/valuemax yok (WCAG 4.1.2); ekran okuyucu ilerlemeyi bildiremez.
**Repro:** NVDA, sidebar — ilerleme duyurulmaz.
**Onerilen Fix:** `.progress__track`'e `role="progressbar" aria-valuenow={answered} aria-valuemin={0} aria-valuemax={n} aria-label`.

### [MEDIUM] BinaryCard option butonlari: secili/confirmed yalnizca data-attribute, ARIA yok

**Dosya:** web/views.js:457-478
**Lens:** accessibility
**Sorun:** data-sel/data-confirmed gorsel; aria-pressed/selected/checked yok; ekran okuyucu secimi belirleyemez. Ic Check ikonunda aria-hidden yok (cift duyuru).
**Repro:** VoiceOver, binary, secim → 'selected' duyulmaz.
**Onerilen Fix:** `aria-pressed={sel}`; Check SVG'ye `aria-hidden="true"`; single/multi (814-855) icin de.

### [MEDIUM] SidebarGrouped accordion toggle butonlari eksik aria-expanded

**Dosya:** web/views.js:138-144
**Lens:** accessibility
**Sorun:** `.qgroup__header` aria-expanded yok; collapsed/expanded durum AT'ye iletilmiyor (WCAG 4.1.2). (Bu high severity'deki 138 bulgusunun N>8 grup baglamindaki muadili.)
**Repro:** VoiceOver (N>8), accordion header — 'expanded/collapsed' demez.
**Onerilen Fix:** `aria-expanded={isOpen} aria-controls`.

### [MEDIUM] SSE onerror — sonsuz reconnect, backoff yok, surekli hatada firtina

**Dosya:** web/live.js:22-25
**Lens:** errorhandling
**Sorun:** 1sn reconnect var ama max-retry/exponential backoff yok. Sunucu coktugunde saniyede bir EventSource ac/kapa; surekli ag baskisi + log gurultusu; kaynak tuketimi birikir.
**Repro:** Sunucuyu durdur, mount et — saniyede bir /events.
**Onerilen Fix:** Exponential backoff (1s→30s cap), onopen'da sifirla.

### [MEDIUM] postAnswers() — fetch'te timeout yok; ag takilirsa UI sonsuza bekler

**Dosya:** web/live.js:39-46
**Lens:** errorhandling
**Sorun:** AbortController/signal yok; ag yanit vermezse `await fetch` sonsuza askida, hata da firlatilmaz, UI yukleniyor durumunda kalir.
**Repro:** Sunucu 'accept et ama yanit verme' (iptables DROP / hanging proxy).
**Onerilen Fix:** AbortController + 10sn timeout, finally clearTimeout.

### [MEDIUM] Fixed 1s reconnect — backoff yok, stres altinda thundering herd

**Dosya:** web/live.js:24
**Lens:** performance
**Sorun:** Hardcoded 1000ms; sunucu cokunce tum istemciler her 1s eszamanli reconnect — degrade aninda sunucu yukunu buyutur. Jitter/cap/multiplier yok.
**Repro:** 50+ istemci bagliyken SSE sunucusunu yeniden baslat — t=1s,2s,3s lockstep.
**Onerilen Fix:** Exponential backoff + jitter, onopen'da reset.

### [MEDIUM] Her SSE mesajinda kosulsuz setRound — degismeyen veride bos re-render

**Dosya:** web/live.js:17
**Lens:** performance
**Sorun:** setRound her mesajda yeni obje referansiyla cagrilir; React kosulsuz re-render planlar. Heartbeat/tekrar state'lerde her mesaj tam subtree render tetikler.
**Repro:** 2s'de bir ayni round'u re-broadcast eden heartbeat ekle; Profiler surekli re-render.
**Onerilen Fix:** Functional updater + esitlik guard: `setRound(prev => prev.id===next.id && prev.questions===next.questions ? prev : next)`.

### [MEDIUM] Cift Save tiklamasinda yarisan istekler baseline'i out-of-order bozabilir

**Dosya:** web/settings-panel.js:107-130
**Lens:** correctness
**Sorun:** save() reentrancy guard yok. Hizli cift tik iki POST /settings; iki yanit herhangi sirada doner, son resolve baseline'i belirler. Farkli draft snapshot'lariyla gonderildiyse baseline/draft tutarsiz; needsReload yanlis.
**Repro:** Save'e iki kez hizli tikla.
**Onerilen Fix:** in-flight/saving bayragi + Save disable.

### [MEDIUM] fullOptions() kardinalitesi qType degrade olunca degisir; ans.sel.includes(i) stale indeksle yanlis secim

**Dosya:** web/views.js:809
**Lens:** correctness
**Sorun:** qType setEnabled ile binary→single/multi degrade edebilir. fullOptions binary 2 sik, single/multi q.options+'Other' doner; ayni q icin tip degisirse opts uzunlugu/indeks anlami degisir. binary'de sel=[1] single'da q.options[1] (farkli sik) gorunur; single 'Other' (sel=[len]) binary'ye gecince sel[0] bOpts sinirini asar.
**Repro:** binary 'Hayir' (sel=[1]) confirmed iken qtypeBinary'yi kapat → single render → q.options[1] yanlis secili.
**Onerilen Fix:** qType degisince answer state'i sifirla, ya da render'da sel'i `filter(i => i<opts.length)` ve indeks anlami degistiyse confirmed gecersiz say.

### [MEDIUM] RankingCard: stale cursor closure — grabbed iken hizli ArrowDown/Up'ta yanlis satir hareketi

**Dosya:** web/views.js:574-577
**Lens:** stateui
**Sorun:** grabbed=true ArrowDown'da moveRank(cursor,1) ve setCursor(cursor+1) render-time closure'dan 'cursor' okur. Iki keydown re-render'dan once fire ederse ikinci event ayni stale cursor'i gorur: (1) ayni cifti iki kez swap (net hareketsiz); (2) cursor gercek pozisyonun otesine artar. Non-grabbed yol functional setCursor kullanir; grabbed kullanmaz.
**Repro:** Ranking, Space ile kap, ArrowDown'i basili tut — satir belli pozisyonlari gecemez, cursor ile vurgu ayrisir.
**Onerilen Fix:** cursor'i ref'te tut ve setQ'dan once senkron guncelle; ya da functional form.

### [MEDIUM] Her soru kartinda <h1> — coklu h1 ile baslik hiyerarsisi bozuk

**Dosya:** web/views.js:888
**Lens:** accessibility
**Sorun:** QuestionCard hep `<h1>` kullanir; Sidebar + ana icerik birlikte render edildiginde coklu h1 potansiyeli. Sidebar baslik hiyerarsisi hic yok.
**Repro:** NVDA H tusu / VoiceOver rotor — h1 tekrar eder.
**Onerilen Fix:** Kart h1'lerini h2'ye indir; sayfaya tek gizli `<h1>` (sr-only) ekle.

### [MEDIUM] SidebarSearch input'u erisilebilir etiket tasimiyor (ikinci dogrulama)

**Dosya:** web/views.js:170-177
**Lens:** accessibility
**Sorun:** Placeholder disinda erisilebilir isim yok (WCAG 1.3.5, 1.4.5); placeholder yeterli etiket sayilmaz.
**Repro:** Tab ile focusla — 'edit text', islev belirsiz.
**Onerilen Fix:** sr-only `<label htmlFor>` ya da `aria-label`.

### [MEDIUM] 'Show unanswered only' toggle erisilebilir durum bildirmiyor

**Dosya:** web/views.js:179-190
**Lens:** accessibility
**Sorun:** data-active CSS; role="switch"/aria-pressed/aria-checked yok; aktif/pasif belirlenmiyor.
**Repro:** Filtreyi ac/kapa — yalnizca 'button'.
**Onerilen Fix:** `role="switch" aria-checked={showUnanswered}`.

### [MEDIUM] CustomPopup overlay ile modal focus trap yok

**Dosya:** web/views.js:896-959
**Lens:** accessibility
**Sorun:** .overlay'de role="dialog"/aria-modal yok; focus textarea'ya gidiyor ama Tab ile modal disina cikilabiliyor (WCAG 2.1.2). Ayni sorun SettingsModal'da.
**Repro:** Popup acikken surekli Tab — focus arkadaki butonlara gecer.
**Onerilen Fix:** `role="dialog" aria-modal="true" aria-label`; focus trap uygula.

### [MEDIUM] mapAnswers tree: OOB ara indeksle truncated path — invariant test edilmemis

**Dosya:** test/answer-map.test.js:198-216
**Lens:** testcoverage
**Sorun:** Satir 82 guard'i (lastNode intermediate ise return) dogru ama OOB-truncation senaryosu (root vs depth-2 vs valid-partial-to-leaf) test edilmiyor.
**Repro:** `mapAnswers(q, {'K?':{path:[0,99]}})` → {} (dogru ama test yok).
**Onerilen Fix:** Uc test: depth-1 OOB → {}, depth-2 non-leaf → {}, truncated leaf'e dusen → davranisi pinle.

### [MEDIUM] decideActivate multi: secili custom'a bos customText ile re-click test edilmemis

**Dosya:** test/answer-map.test.js:107-120
**Lens:** testcoverage
**Sorun:** inSel+isCustom dali (satir 110 popup) single icin test edili, multi icin degil. `decideActivate(multiQ, {sel:[0,2], customText:''}, 2)` → `{type:'popup',...}` calisiyor ama sifir test.
**Onerilen Fix:** Multi inSel+isCustom icin bos-text ve mevcut-text iki test ekle.

### [MEDIUM] amoled swatch.accent (#0070f3) gercek render --accent (#4d8dff) ile uyusmuyor

**Dosya:** web/themes.js:59
**Lens:** correctness
**Sorun:** amoled tokens bos ({}); gercek accent styles.css :root --accent #4d8dff'ten gelir ama swatch.accent #0070f3. Picker yanlis accent gosterir. Test yalnizca format kontrol eder, token esleşmesini degil.
**Repro:** Picker'da amoled swatch'i #0070f3 gosterir, uygulaninca #4d8dff.
**Onerilen Fix:** swatch.accent'i #4d8dff yap; testi token-eslesmesi dogrulayacak sekilde guclendir.

### [MEDIUM] aurora swatch.bg (#1a1340) gercek --bg token'i (#0a0a1f) ile uyusmuyor

**Dosya:** web/themes.js:190
**Lens:** correctness
**Sorun:** aurora swatch.bg #1a1340 ama token --bg #0a0a1f; picker yanlis arka plan gosterir. Diger temalar eslesirken yalnizca aurora.bg sapiyor (kopyala-yapistir tutarsizligi).
**Repro:** Picker aurora #1a1340, uygulaninca #0a0a1f.
**Onerilen Fix:** swatch.bg'yi #0a0a1f yap.

### [MEDIUM] swapFont idempotency ve font-null gecisi: sifir test

**Dosya:** web/themes.js:292-308
**Lens:** testcoverage
**Sorun:** Uc davranis test edilmemis: ayni font iki kez (href esitlik dup-onleme), font-temadan null-fonta gecis (link.remove dali), URL construction. Whitespace/encoding bug'i sessizce bozuk URL uretir.
**Onerilen Fix:** Mock DOM testleri: same-font href degismez, null-font link silinir, her tema font URL formati.

### [MEDIUM] apply() reset USED_KEYS kullaniyor (KNOWN_TOKENS degil) — uc token gelecekte sifirlanmayabilir

**Dosya:** web/themes.js:241-249, 317-319
**Lens:** testcoverage
**Sorun:** USED_KEYS module-init'te tema token birlesimi; --motion-ms/--ease/--font-mono hicbir tema set etmedigi icin USED_KEYS disinda. apply() yalnizca USED_KEYS sifirlar. USED_KEYS⊇KNOWN_TOKENS structural invariant'i test edilmiyor.
**Onerilen Fix:** USED_KEYS↔KNOWN_TOKENS drift testi + USED_KEYS'in dogru reset seti oldugunu belgele.

### [MEDIUM] apply() aurora→paper gecisi --surface-blur temizligi: test edilmemis

**Dosya:** web/themes.js:312-332
**Lens:** testcoverage
**Sorun:** Yalnizca aurora --surface-blur set eder; aurora→paper'da removeProperty (USED_KEYS) :root default 'none'u geri getirir (dogru) ama browser-bagimli invariant hic assert edilmemis. USED_KEYS aurora token'larini atlarsa paper/dusk/phosphor sessizce blur miras alir.
**Onerilen Fix:** jsdom: apply('aurora') → blur set; apply('paper') → '' (inline silindi).

### [MEDIUM] Tema token'lari icin CSS deger sozdizimi dogrulamasi yok (99 rgba/color, sifir validasyon)

**Dosya:** web/themes.js:56-229
**Lens:** testcoverage
**Sorun:** 5 tema 99+ rgba/color/gradient/px degeri; sozdizimsel gecerlilik test edilmiyor. `rgba(...0.1O)` (O harfi) veya `'16px '` (trailing space) gibi typo setProperty'de sessizce yok sayilir, gorsel regresyon, log yok.
**Repro:** paper --accent'i '#b2423O' yap; tarayici sessizce :root default'a duser.
**Onerilen Fix:** color/radius/motion pattern testleri (KNOWN_TOKENS kategorileriyle).

### [MEDIUM] bridge-client.test.js: server.js'i XDG_CONFIG_HOME set etmeden require ediyor, gercek user config'e dokunuyor

**Dosya:** test/bridge-client.test.js:5
**Lens:** testcoverage
**Sorun:** settings.js DIR'i module-load'da XDG_CONFIG_HOME'dan hesaplar; server.js require'i override'dan once oldugundan DIR gercek ~/.config/askuserquestionspro'ya cozulur. Bugun yazma yok ama gelecekteki settings-okuma yolu developer config'ini okur (machine-dependent). server.test.js dogru yapiyor.
**Onerilen Fix:** require oncesi `process.env.XDG_CONFIG_HOME = mkdtempSync(...)` ekle.

### [MEDIUM] server.test.js: readBody 8MB limiti ve connection-abort reject yolu test edilmemis

**Dosya:** test/server.test.js
**Lens:** testcoverage
**Sorun:** readBody iki non-happy yol: >8MB (req.destroy → close handler reject) ve mid-stream abort (error). Ikisi de test edilmemis. 8MB yolu ozellikle onemli cunku destroy 'error' emit etmez; close-guard'in promise'i gercekten cozdugu dogrulanmamis.
**Repro:** `Buffer.alloc(9e6,'x')` body → 400 + hang yok (mevcut testte hicbiri assert edilmiyor).
**Onerilen Fix:** >8MB → 400 + no-hang testi; mid-stream destroy → 400 testi.

### [MEDIUM] server.test.js: serveStatic path traversal (403) test edilmemis

**Dosya:** test/server.test.js
**Lens:** testcoverage
**Sorun:** serveStatic WEB_DIR disindaysa 403 (182-186); test yok. Refactor sessizce korumayi kaldirabilir.
**Onerilen Fix:** `fetch(base+'/../package.json')` → 403 assert.

### [MEDIUM] hook-output.test.js: tek happy-path; answers-filter ve ASKUI_FORCE_MCP dali test edilmemis

**Dosya:** test/hook-output.test.js:1-15
**Lens:** testcoverage
**Sorun:** buildHookOutput answers'i toolInput.questions'a gore filtreliyor ama tek test tam eslesme veriyor, filter dali hic exercise edilmiyor. Ayrica bridge'deki ASKUI_FORCE_MCP deny-yolu, uncaughtException/unhandledRejection handler'lari, readStdin 'error' yolu sifir test.
**Repro:** `buildHookOutput({questions:[{question:'A?'}]}, {'A?':'yes','B?':'no'})` → 'B?' updatedInput.answers'ta olmamali (assert yok).
**Onerilen Fix:** Extra-key strip, empty-questions testleri; bridge icin child_process integration (FORCE_MCP deny, malformed-JSON exit(0)).

### [MEDIUM] answer-map.test.js: ranking OOB indeks icin test yok

**Dosya:** test/answer-map.test.js:179-195
**Lens:** correctness
**Sorun:** ranking testleri yalnizca gecerli indeks; tree icin gecersiz-node test edilirken ranking icin q.options asan indeks (order:[5]) hic test edilmiyor — iki bounds bug'inin sessiz kalma nedeni.
**Onerilen Fix:** stale/OOB indeksli test (order:[5]) ekle, undefined-safe davranis assert et.

### [MEDIUM] setEnabled global state izolasyonu manuel restore'a bagimli — assertion erken patlarsa leak

**Dosya:** test/answer-map.test.js (127-141, 442-467, 506-531, 524-530 vb.)
**Lens:** testcoverage / correctness
**Sorun:** ENABLED modul-global; testler mutate edip elle geri aliyor, beforeEach/afterEach yok. Restore satirindan once assert patlarsa state sonraki TUM testlere sizar, qType/mapAnswers/isAnswered'i bozarak cascade failure + yaniltici mesaj.

> Not: Bu setEnabled-leak bulgusu test paketinde **alti ayri kez** dogrulanmis (ayni dosyanin farkli satir araliklari ve AM/AM2/AM3 alias paragraflari) — hepsi ayni kök neden.
> **Repro:** 127-141 araliginda bir assert'i kasitli fail et — sonraki t3 testleri degrade ENABLED ile calisir.
> **Onerilen Fix:** Her setEnabled-mutasyonunu try/finally ile sar; tercihen test.beforeEach/afterEach ile kanonik state'e resetle.

### [MEDIUM] server.test.js: zaman-bazli senkronizasyon (setTimeout 50ms) poll yerine kirilgan

**Dosya:** test/server.test.js (36,64,107,181,218,242,298,401,411,414)
**Lens:** testcoverage
**Sorun:** On test in-flight /ask'in kaydini beklemek icin `setTimeout(50)` kullaniyor — deterministik degil. Yuklu CI'da /ask islenmemis olabilir, /current null doner, test stale state gorur. SSE testi 30+50+80=160ms zincirliyor (kumulatif drift).
**Repro:** Yuklu makine / --cpu-quota ile ara sira fail.
**Onerilen Fix:** sleep-then-poll yerine /current poll loop (non-null questions'a kadar, total deadline).

### [MEDIUM] server.test.js: /ask timeout (bridge.cancel) testi yok — SSE testi client-side abort kullaniyor

**Dosya:** test/server.test.js:387-418
**Lens:** testcoverage
**Sorun:** 'istemci /ask kopusu' testi AbortController-abort'la cancel + SSE null'i dogrular ama 80ms setTimeout busy-wait'e dayanir; yavas CI'da SSE event events[]'e gelmeden assertion calisir (false negative).
**Repro:** Yuksek CPU yuk altinda calistir — SSE event 80ms sonra gelir, assertion onceki event'i gorur.
**Onerilen Fix:** Fixed 80ms yerine SSE event listener/poll loop (questions:null gorunce resolve, dis timeout guard).

### [MEDIUM] write() disk hatasini yutuyor; caller'a basarili gibi 'next' donuyor (correctness lens)

**Dosya:** lib/settings.js:26-37
**Lens:** correctness
**Sorun:** (Tema A kök neden; ayri lens vurgusu) mkdir/writeFile/rename try/catch sarili, hata stderr; her kosulda next doner. server.js:322-323 kosulsuz {ok:true} yansitir; sonraki read eski/default doner — sessiz veri kaybi.
**Repro:** XDG_CONFIG_HOME read-only (chmod 0555), POST /settings → 200 {ok:true} ama settings.json olusmaz.
**Onerilen Fix:** write basarisizligini ilet (throw / {ok:false}); server write basarisini dogrulamadan ok:true dondurmesin.

---

### [LOW] getCurrent/peek temizlik sirasinda tutarsiz okuma yok; Node tek-thread invariant'i koruyor (dogrulama — bulgu degil)

**Dosya:** server/bridge.js:23-30
**Lens:** concurrency
**Sorun:** getCurrent/peek await icermedigi icin null-atama ile yaris yok; peek id+questions'i tek senkron ifadede okur. Race kod kanitiyla MEVCUT DEGIL.
**Onerilen Fix:** Degisiklik gerekmez; "bu metodlar senkron kalmali" yorumu eklenebilir.

### [LOW] broadcastCurrent iterasyonunda sseClients eszamanli degisebilir; yeni istemci ilk snapshot'i kacirabilir

**Dosya:** server/server.js:165-174
**Lens:** concurrency
**Sorun:** /events handler once ilk payload yazar (221) sonra add (230); durum bu iki adim arasinda degisirse istemci eski snapshot alip yeni broadcast'i kacirir. Node tek-thread/await-siz oldugundan pencere pratikte kapali ama eklenme-yazma sirasina kirilgan.
**Onerilen Fix:** /events'te once add(res), sonra ilk snapshot'i yaz.

### [LOW] broadcastCurrent: basarisiz write'ta ping interval temizlenmiyor (kucuk timer leak)

**Dosya:** server/server.js:165-174
**Lens:** performance
**Sorun:** catch'te istemci silinir ama ilgili ping interval (223) burada clear edilmez; 'close' event'ine kadar her 25sn fire eden zombie interval. close fire etmezse (nadir proxy kosulu) interval sizar.
**Onerilen Fix:** interval id'sini res'te sakla, catch'te clearInterval.

### [LOW] ensureServer() — spawn hatasi ile yavas baslatma farki yok; 3sn bos bekleme

**Dosya:** lib/bridge-client.mjs:40-46
**Lens:** errorhandling
**Sorun:** Spawn hatasinda bile polling 30×100ms calisir, sonunda false; spawn hic olmadiginda bu 3sn bosa.
**Onerilen Fix:** `spawnError` set et + `if(spawnError) break;`.

### [LOW] openBrowser — catch blogu olu kod, gercek hata error event'ten gelir

**Dosya:** lib/bridge-client.mjs:56-62
**Lens:** errorhandling
**Sorun:** spawn() senkron throw etmez; hata asenkron child.on('error')'da. try/catch spawn hatasini hic yakalamaz — okuyucuyu yaniltir.
**Onerilen Fix:** try/catch'i kaldir, hata yonetimini c.on('error') uzerinden yap.

### [LOW] id === null istekler yanitsiz birakiliyor — JSON-RPC 2.0 gri alan

**Dosya:** mcp-server/askuserquestionspro-mcp.mjs:164
**Lens:** errorhandling
**Sorun:** Spec'e gore bildirimler 'id' icermez (absent); id:null hata yanitlarina rezerve, istek kabul edilmeli. Kod id===null'i bildirim sayip yanit gondermiyor. Claude MCP host boyle gondermez ama gelecekteki client'larda surpriz.
**Repro:** `{"jsonrpc":"2.0","id":null,"method":"ping"}` → yanit gelmez.
**Onerilen Fix:** Bildirim kontrolunu `id === undefined`'e daralt.

### [LOW] ensureServer coklu eszamanli cagrida single-flight yok — birden fazla daemon spawn

**Dosya:** lib/bridge-client.mjs:32-46
**Lens:** concurrency
**Sorun:** isUp ile spawn arasi await boundary; ayni process'te iki paralel cagri ikisi de spawn eder, biri EADDRINUSE ile exit(0). Kalici hasar yok (cross-process EADDRINUSE guard'i var) ama gereksiz spawn.
**Onerilen Fix:** Modul seviyesi `let inflight` promise ile tek ucusa indir.

### [LOW] openBrowser() POST sunucuya ulasmadan tarayiciyi acabilir

**Dosya:** hooks/askuserquestionspro-bridge.mjs:60-62
**Lens:** correctness
**Sorun:** askPromise once olusturuluyor (dogru) ama /ask POST asenkron; openBrowser submitQuestions kaydetmeden tarayiciyi baslatabilir, ilk poll/SSE {questions:null} doner. SSE/poll re-broadcast telafi eder; cokme degil, kisa gecikme.
**Onerilen Fix:** Zorunlu degil; gerekirse openBrowser'i mikro gecikmeyle tetikle.

### [LOW] uncaughtException/unhandledRejection handler'lari hata nesnesini drop ediyor — debug imkansiz

**Dosya:** hooks/askuserquestionspro-bridge.mjs:11-12
**Lens:** errorhandling
**Sorun:** Handler'lar arg almiyor; beklenmedik exception'da hook sessizce native'e duser, hatanin ne/nerede oldugu bilinmez. Invariant ihlal degil ama operasyonel kor nokta.
**Onerilen Fix:** `(err) => { try { stderr.write('[askuser] uncaught: '+(err?.stack||err)); } catch {} process.exit(0); }`.

### [LOW] readStdin error handler: kismi veri ile resolve — JSON.parse fallback var ama kismi payload sizabilir

**Dosya:** hooks/askuserquestionspro-bridge.mjs:19
**Lens:** errorhandling
**Sorun:** 'error'da birikmis kismi string ile resolve; JSON.parse fail ederse exit(0) (dogru) ama kismi veri gecerli JSON parcasiysa yanlis veriyle devam edilebilir.
**Onerilen Fix:** `process.stdin.on('error', () => resolve(''))`.

### [LOW] settings set toggle hint gercekte kabul edilen 'yes'/'no' degerlerini gostermiyor

**Dosya:** bin/cli.js:154-156
**Lens:** correctness
**Sorun:** Schema.coerce toggle icin 'yes'/'no' da kabul ediyor ama cli.js:155 ipucu yalnizca 'on/off/true/false/1/0' yaziyor. Kullaniciya yanlis/eksik kontrat.
**Repro:** `settings set reduceMotion maybe` → ipucunda 'yes/no' yok ama 'yes' gecerli.
**Onerilen Fix:** Hint'i 'on/off/yes/no/true/false/1/0' yap (ya da schema'dan turet).

### [LOW] addHook: bizim entry + yabanci AskUserQuestion entry birlikte iken cakisma 'already' ile maskeleniyor

**Dosya:** bin/install.js:48-54
**Lens:** correctness
**Sorun:** addHook once bizim entry'yi kontrol edip 'already' doner; yabanci AskUserQuestion matcher kontrolu sonra. Ikisi birlikteyse 'conflict' yerine 'already' doner; issue #15897 cakismasi sessizce gizlenir, doctor '✓' der.
**Repro:** PreToolUse'a hem bizim hook hem matcher='AskUserQuestion' ikinci komut → addHook 'already'.
**Onerilen Fix:** Once (isAskUserMatcher && !isOurEntry) varsa 'conflict'; yoksa isOurEntry 'already'; yoksa ekle.

### [LOW] isOurEntry substring eslesmesi: path-prefix cakismasinda yanlis pozitif

**Dosya:** bin/install.js:32-36
**Lens:** correctness
**Sorun:** `h.command.includes(hookAbsPath)` sinir kontrolsuz; baska kurulumun komutu bizim path'i onek olarak icerirse yanlis 'bizim entry' tespiti, removeHook onu da silebilir.
**Onerilen Fix:** Tam komut karsilastirmasi (`h.command === hookCommand(...)`) ya da tirnakli tam token ara.

### [LOW] cmdServe/cmdMcp: signal-killed child temiz cikis (exit 0) gibi raporlaniyor

**Dosya:** bin/cli.js:103,109
**Lens:** errorhandling
**Sorun:** Signal-kill'de exit code=null, signal set; `code || 0` null'i falsy gorup process.exit(0) cagirir. CI killed-server'i temiz shutdown sanir.
**Repro:** `askuserquestionspro serve &`, `kill -9 $!`, `echo $?` → 0.
**Onerilen Fix:** `process.exit(code ?? (signal ? 1 : 0))`.

### [LOW] reinstall.sh hook-removal son PreToolUse entry'sini silince bos `"hooks":{}` birakiyor

**Dosya:** reinstall.sh:46-53
**Lens:** correctness
**Sorun:** jq PreToolUse'u silince bos parent .hooks'u kaldirmaz; sonuc {"hooks":{}}. install.sh `.hooks //= {}` ile zararsiz ama standalone uninstall'da vestigial key.
**Repro:** Tek hook'u silen jq → {"hooks":{}} (yerine {}).
**Onerilen Fix:** `| (if (.hooks // {} | length)==0 then del(.hooks) else . end)`.

### [LOW] reinstall.sh dogrulama (adim 5) substring grep ile '✔ hook' — AskUserQuestion hook yoksa bile yanlis pozitif

**Dosya:** reinstall.sh:70
**Lens:** correctness
**Sorun:** `grep -q askuserquestionspro "$SETTINGS"` dosyada herhangi yerde eslesir; INSTALL_DIR path'i 'askuserquestionspro' icerdiginden alakasiz bir hook bile ✔ verir. Dogrulama gercekten AskUserQuestion PreToolUse hook'unu teyit etmez.
**Repro:** Install dir altinda alakasiz path'li hook koy, AskUserQuestion hook'unu kaldir → '✔ hook'.
**Onerilen Fix:** jq -e ile yapisal dogrula (matcher==AskUserQuestion + test("askuserquestionspro")).

### [LOW] install.sh: ozel TMPDIR degiskeni yeniden atanip later mktemp'i silinecek dizine yonlendiriyor; trap'te tirnaksiz

**Dosya:** install.sh:10-11
**Lens:** correctness
**Sorun:** TMPDIR ozel degisken; GNU coreutils'te sonraki mktemp (44) bunu onurlandirip jq temp'i silinecek dizinde olusturur (platform-bagimli). Ayrica trap string'i icinde $TMPDIR tirnaksiz (bosluklu path word-split).
**Repro:** Linux/GNU host'ta curl|bash; 44'teki mktemp temp'i mktemp -d dizininde olusur.
**Onerilen Fix:** WORKDIR adi + single-quote trap (`trap 'rm -rf "$WORKDIR"' EXIT`).

### [LOW] reinstall.sh:16,25 — tirnaksiz $pids; lsof ciktisi PID olarak guveniliyor (security lens)

**Dosya:** reinstall.sh:16,25
**Lens:** security
**Sorun:** PORT dogrulanmadigindan yanlis/araliksal port cok PID dondurUrse script hepsini sorgusuz oldurur. lsof rakam dondurdugu icin enjeksiyon yok; risk kill hedef kumesinin kontrolsuz genislemesi.
**Onerilen Fix:** PORT'u dogrula; PID'leri dongude tek tek isleyip gercekten bizim surec oldugunu teyit et (`ps -p ... | grep askuserquestionspro`).

### [LOW] install.sh:11 — trap icinde $TMPDIR tirnaksiz ve standart TMPDIR golgeleniyor (security lens)

**Dosya:** install.sh:10,11
**Lens:** security
**Sorun:** Cift-tirnakli trap $TMPDIR'i kurulum aninda genisletir; TMPDIR bosluklu dizine isaret ediyorsa rm -rf yanlis yollari silebilir. Ayrica standart TMPDIR golgelenir.
**Repro:** `TMPDIR='/tmp/has space' bash install.sh`.
**Onerilen Fix:** Farkli ad + single-quote trap.

### [LOW] install.sh idempotency yalnizca tam-string esitlige dayanir; yol degisirse cift hook (security lens)

**Dosya:** install.sh:48-53
**Lens:** security
**Sorun:** `.command == $cmd` ile eslesme; farkli varyant/eski INSTALL_DIR ile ikinci entry eklenebilir → ayni tool icin iki PreToolUse hook (#15897). Script bunu yalnizca grep ile UYARIYOR, engellemiyor.
**Repro:** Once eski surumle kur, sonra yeni surumle → iki AskUserQuestion hook.
**Onerilen Fix:** Idempotency'yi matcher bazli yap (ekleme oncesi matcher==AskUserQuestion entry'leri sil, tek kanonik ekle).

### [LOW] install.sh: settings.json'a jq yazimi cikti gecerliligini dogrulamadan mv ediyor

**Dosya:** install.sh:54
**Lens:** security
**Sorun:** jq exit 0 verip bos/kismi JSON uretirse mv yine calisir; settings.json kullanicinin tum Claude konfigini tutar, bozuk cikti onu ezerse konfig kaybolur.
**Onerilen Fix:** mv oncesi `jq -e . "$tmp" >/dev/null` ile parse+bos-olmama dogrula.

### [LOW] install.sh:11 — trap'te $TMPDIR tirnaksiz, bosluklu path'te dizin silinmez (errorhandling lens)

**Dosya:** install.sh:11
**Lens:** errorhandling
**Sorun:** (Yukaridaki TMPDIR bulgusunun errorhandling acisi) bosluklu path'te `rm -rf` iki argumana boluner, temp dosyalar kalir.
**Onerilen Fix:** `trap 'rm -rf "$TMPDIR"' EXIT`.

### [LOW] renameSync throw ederse yetim .tmp temizlenmiyor

**Dosya:** lib/settings.js:30-35
**Lens:** correctness
**Sorun:** writeFileSync(tmp) basarili, renameSync throw ederse 'yetim' settings.json.tmp kalir. Atomik-rename invariant'i teknik olarak tutuyor (asil .json bozulmaz) ama tmp artigi birikebilir.
**Onerilen Fix:** catch'te `fs.rmSync(tmp, {force:true})`.

### [LOW] applyAll() hata yutma: tarayicida apply() hatalari tamamen gizleniyor

**Dosya:** web/settings-schema.js:168-172
**Lens:** errorhandling
**Sorun:** Her apply() kendi try-catch'inde (invariant tutuyor) ama catch tamamen bos. Node'da makul ama tarayicida Themes.apply() gercek hatalari (gecersiz CSS, eksik DOM) sessizce yutulur; gelistirici hic gormez.
**Repro:** Tarayicida Themes.apply()'a throw enjekte et → ne console ne hata-izleme.
**Onerilen Fix:** `if (typeof document !== 'undefined') console.warn('[settings] apply failed for', e.key, err)`.

### [LOW] validate() \_v (versiyon) alanini ciktiya dahil etmiyor — write() onu manuel ekliyor

**Dosya:** lib/settings.js:27
**Lens:** errorhandling
**Sorun:** Schema.validate bilinmeyen key'leri (dolayisiyla \_v) atar; \_v her zaman write() tarafindan disaridan eklenir. read() ciktisinda \_v yok; caller versiyon kontrolu isterse bulamaz. Bilincli ama belgesiz tutarsizlik.
**Onerilen Fix:** read() ciktisinin \_v icermedigini JSDoc ile belirt, ya da \_v'yi schema'da ayri tut.

### [LOW] sendError toast suresiz kaliyor — auto/manual dismiss yok

**Dosya:** web/app.js:362-367
**Lens:** stateui
**Sorun:** Retry sirasi dogru ama sendError toast'inda dismiss butonu/timeout yok. Bridge kalici unavailable olursa toast 'Press Enter to retry' ile sonsuza kalir, sayfa refresh'siz kapatilamaz — kafa karistirici.
**Repro:** postAnswers'i hep reject yap, submit et → toast cikar, kapatma yolu yok.
**Onerilen Fix:** Toast'a close butonu (`onClick={() => setSendError(false)}`) ya da ~8sn auto-dismiss useEffect.

### [LOW] Check SVG ikonu gorsel durum gostergesi olarak aria-hidden'siz kullaniliyor

**Dosya:** web/views.js:64, 469, 847, 849
**Lens:** accessibility
**Sorun:** `<Check>` (ui-kit.js:8-17) ham `<svg>`, aria-hidden/title yok; ekran okuyucu path data'sini okuyabilir ya da 'image' duyurur. Tum interaktif kullanimlar bastirilmali.
**Repro:** NVDA, tamamlanmis sidebar item → 'graphic'/path data duyurabilir.
**Onerilen Fix:** Check icindeki svg'ye `aria-hidden="true"` (opsiyonel aria-label override).

### [LOW] live.js onerror/cleanup yarisi closed-guard ile dogru kapatilmis (dogrulama — bulgu degil)

**Dosya:** web/live.js:22-32
**Lens:** correctness
**Sorun:** onerror es.close()+`if(!closed)` timer; cleanup closed=true+clearTimeout+es.close(). Unmount sonrasi kuyrukta kalan onerror'da closed=true oldugundan yeni timer kurulmaz; sizinti yok. Davranissal hata yok.
**Onerilen Fix:** Degisiklik gerekmez.

### [LOW] useLiveQuestions: JSON parse hatasi ve non-object payload state'i bozmuyor (dogrulama — bulgu degil)

**Dosya:** web/live.js:14-21
**Lens:** correctness
**Sorun:** setRound JSON.parse ile ayni try'da; parse fail catch yutar, setRound cagrilmaz, state korunur. `JSON.parse('null')` → d.null erisimi yine try icinde yakalanir. Invariant ihlal yok.
**Onerilen Fix:** Istenirse `if (d && typeof d==='object')` guard'i eklenebilir.

### [LOW] JSON.parse sessiz catch — gecersiz mesaj state'i bozmaz (invariant tutuyor) ama izlenemiyor

**Dosya:** web/live.js:18-19
**Lens:** errorhandling
**Sorun:** Bos catch; invariant saglanmis (setRound cagrilmaz) ama sunucu beklenmedik format gonderdiginde log/metric yok; uretimde sessiz veri-drop izlemesi guc.
**Repro:** `data: not-json` gonder — sessizce yutulur, console'da iz yok.
**Onerilen Fix:** `console.warn('[live] SSE parse edilemedi:', err.message, e.data)`.

### [LOW] postAnswers fetch AbortController yok — component unmount sonrasi devam eder

**Dosya:** web/live.js:39-45
**Lens:** performance
**Sorun:** fetch AbortSignal'siz; unmount sirasinda in-flight POST tamamlanir, r.json() parse edilir, stale closure'a doner. Bandwidth/CPU bosa.
**Repro:** Submit ardindan hemen unmount → Network'te POST yine tamamlanir.
**Onerilen Fix:** signal parametresi ekle; caller cleanup'ta ac.abort().

### [LOW] change() basarisiz kaydetme sonrasi saveError ve eski needsReload uyarisini temizlemiyor

**Dosya:** web/settings-panel.js:88-99
**Lens:** correctness
**Sorun:** save basarisiz → saveError=true ('Save failed' notice). change() yalnizca setSaved(false) yapar; setSaveError(false)/setNeedsReload(false) cagrilmaz. Yeni duzenlemede bayatlamis 'Save failed' (ve onceki 'Reload') uyarisi asili kalir.
**Repro:** Save (hata) → 'Save failed' → toggle degistir → mesaj hala duruyor.
**Onerilen Fix:** change() icinde setSaveError(false) (ve gerekirse needsReload reset).

### [LOW] needsReload karsilastirmasi guncel draft yerine baseline'a bakiyor; coklu save'de yanlis uyari

**Dosya:** web/settings-panel.js:119-122
**Lens:** correctness
**Sorun:** reloadChanged res.settings[key] !== baseline[key]; ilk save baseline'i gunceller. reload-ayari degistir+Save (needsReload=true), sonra live ayar degistir+Save → ikinci save'de reduceMotion baseline ile esit, reloadChanged=false, setNeedsReload(false) ilk uyariyi siler — oysa hala reload gerekiyor.
**Repro:** reduceMotion ac→Save (uyari)→theme degistir→Save→uyari kaybolur.
**Onerilen Fix:** needsReload'u yapiskan tut (`setNeedsReload(prev => prev || reloadChanged)`) ya da oturum-baslangic baseline'ina gore karsilastir.

### [LOW] TreeCard breadcrumb sessizce bos etiket uretir (gecersiz path teshis edilemez)

**Dosya:** web/views.js:680-683
**Lens:** correctness
**Sorun:** getNodeAt null donerse crumbs '' uretir; gecersiz/bayat path'te bos breadcrumb butonlari render edilir, log/uyari yok, handleBack/crumb-click bozuk path uzerinde calisir. isAnswered false ama kullaniciya yalnizca bos kirinti — sessiz basarisizlik.
**Repro:** ans.path var olmayan indeks icerirse bos breadcrumb.
**Onerilen Fix:** node null ise breadcrumb'i kirp + path'i son gecerli ön-eke normalize et; dev'de console.warn.

### [LOW] QItem confirmed render: AnswerMap yokken gecersiz sel indekslerinde bozuk virgullu metin

**Dosya:** web/views.js:49-54
**Lens:** correctness
**Sorun:** AnswerMap.summaryText yoksa fallback a.sel.map ile opts[s], undefined ise '' ama `.filter(Boolean)` YOK; dogrudan join — ', , Foo' gibi bozuk metin. Summary fallback (981-988) filter iceriyor, QItem icermiyor — tutarsiz.
**Repro:** AnswerMap tanimsiz ortamda gecersiz indeksli sel → bozuk virgullu cevap.
**Onerilen Fix:** QItem fallback'e `.filter(Boolean)` ekle.

### [LOW] SidebarGrouped groups useMemo'da spurious 'answers' dependency — gereksiz recompute

**Dosya:** web/views.js:102
**Lens:** stateui
**Sorun:** memo deps [QUESTIONS, answers, filteredIndices] ama govdede answers okunmuyor (doneCount JSX'te). answers dep'i her cevap degisiminde tum grup yapisini gereksiz yeniden kurar. filteredIndices zaten filtre state'ini kapsuller.
**Repro:** >8 soru, hizli cevapla → Profiler her cevapta memo re-run.
**Onerilen Fix:** Dep array'i [QUESTIONS, filteredIndices] yap.

### [LOW] QItem: answers[q.question] null guard yok — entry eksikse crash

**Dosya:** web/views.js:44-45
**Lens:** stateui
**Sorun:** `const a = answers[q.question]; const state = a.confirmed ?...` null check'siz. Normal Flow'da olamaz (mount'ta init) ama QUESTIONS'ta init edilmemis bir key olursa (useLiveQuestions race, key= remount oncesi) `a.confirmed` TypeError; ust error boundary yok.
**Repro:** Nadiren; useLiveQuestions remount oncesi yeni QUESTIONS verirse.
**Onerilen Fix:** `const a = answers[q.question] || {}; const state = a?.confirmed ? ...`.

### [LOW] QItem sidebar butonlarinda klavye ile 'done' durumu duyurulmuyor

**Dosya:** web/views.js:57-75
**Lens:** accessibility
**Sorun:** data-state CSS; state='done'da 'tamamlandi' bildirimi yok; cevap metni (answerText) dugum adina dahil degil.
**Repro:** Soruyu yanitla, sidebar dugumune focusla — tamamlandi/cevap soylenmez.
**Onerilen Fix:** `aria-label={\`${i+1}. ${q.question}${state==='done' ? ': '+(answerText||'tamamlandi') : ''}\`}`.

### [LOW] ChevronRight SVG ikon gizli degil — ekran okuyucu icerigi okuyabilir

**Dosya:** web/views.js:11-21
**Lens:** accessibility
**Sorun:** Dekoratif ok aria-hidden tasimiyor, `<title>` yok; ekran okuyucu bos SVG/anlamsiz ses cikarabilir.
**Onerilen Fix:** `<svg ... aria-hidden="true" ...>`.

### [LOW] Check, Brand ikonlari aria-hidden tasimiyor

**Dosya:** web/ui-kit.js:8-35
**Lens:** accessibility
**Sorun:** Dekoratif ama aria-hidden yok; Check metinsiz ('done') kullaniliyor, ekran okuyucu icerigi okuyup anlamlandiramayacak.
**Onerilen Fix:** Iki SVG'ye aria-hidden="true"; anlamsal Check kullanimina sr-only metin alternatifi.

### [LOW] clampScale NaN girisini geri yansitir; min/max araliginda kalmasi garanti degil

**Dosya:** web/answer-map.js:243-249
**Lens:** correctness
**Sorun:** `step || 1` step=0'i koruyor (invariant tutuyor) ama v=NaN gelirse Math.min/max NaN doner; q.min/q.max undefined ise tum islem NaN'a duser. 'min/max'e oturt' invariant'i NaN'da saglanmaz.
**Repro:** `clampScale({min:0,max:10,step:1}, NaN)` → NaN.
**Onerilen Fix:** `var n=Number(v); if(!isFinite(n)) return q.min;`; q.min/max icin `== null` guard.

### [LOW] apply(undefined/null/'') davranisi test edilmemis — get()'e gecersiz id geciyor

**Dosya:** web/themes.js:312-314
**Lens:** testcoverage
**Sorun:** apply() id'yi get()'e gecirir; undefined/null/'' tumu DEFAULT_ID'ye duser (dogru) ama test yok. `apply('yok')` test edili; undefined/null gercekci caller hatasi.
**Repro:** `Themes.apply(undefined)` → 'amoled' (regresyon test yakalanmaz).
**Onerilen Fix:** `assert.strictEqual(Themes.apply(undefined), 'amoled')` ve null varyanti.

### [LOW] documentElement data-theme attribute'u test edilmemis

**Dosya:** web/themes.js:324
**Lens:** testcoverage
**Sorun:** apply() `root.setAttribute('data-theme', theme.id)` set eder; DOM ortaminda dogrulayan test yok (Node testi DOM yolunu atliyor). Dis entegrasyon/gelecek CSS buna bagimli olabilir.
**Onerilen Fix:** jsdom testi: apply('phosphor') → `getAttribute('data-theme')==='phosphor'`.

### [LOW] bridge-client.test.js: ensureServer spawn-and-poll (server calismayan) yolu test edilmemis

**Dosya:** test/bridge-client.test.js:26-29 (ve 32-35)
**Lens:** testcoverage
**Sorun:** Yalnizca server ayaktayken test ediliyor; isUp false → spawn → 30 poll → false yolu (kritik basarisizlik modu: daemon baslayamadi) hic kapsanmiyor. askBridge timeout/abort da test edilmemis.
**Repro:** ASKUSER_PORT'u bossuz porta set et, ensureServer() → false beklenir.
**Onerilen Fix:** Calismayan port ile ensureServer false donus testi; kisa timeoutMs ile askBridge reject testi.

### [LOW] bin/cli.js: tum komutlar (init/install/uninstall/serve/mcp/doctor/settings) sifir test

**Dosya:** bin/cli.js:1-263
**Lens:** testcoverage
**Sorun:** Public entry point; hicbir komut fonksiyonu test edilmiyor. readSettings/writeSettings (install.js:75-92) de test edilmiyor. cmdInstall spawnSync('claude',...) korumasiz; claude CLI olmayan makinede ENOENT dali test edilmemis.
**Repro:** `node bin/cli.js install` iki kez → ikincisi 'Zaten kurulu' (test yok).
**Onerilen Fix:** spawnSync ile CLI integration testleri (HOME/XDG tmp'ye yonlendirilmis): install/again/uninstall/settings list-get-set/doctor.

### [LOW] write() okuma-degistir-yazma yarisi: eszamanli write'lar birbirini eziyor (lost update)

**Dosya:** lib/settings.js:26-37
**Lens:** correctness
**Sorun:** write(patch) read()+merge+tek sabit tmp'ye yazip rename eder. Iki yazici eszamanli kosarsa son rename kazanir, digerinin patch'i kaybolur (lost update). Ayni 'settings.json.tmp'ye yazma tmp ic-ice gecmesi olabilir ama rename atomik oldugundan FILE yarim kalmaz. Tek somut risk lost update; tek-kullanici CLI'da dusuk olasilik.
**Repro:** `write({theme:'x'})` ve `write({uiScale:'lg'})` await'siz cagir → biri yansir.
**Onerilen Fix:** tmp adini benzersizlestir (`+'.'+process.pid+'.tmp'`); tam cozum icin O_EXCL/lock.

### [LOW] server.test.js: question uzunluk sinirlari (0, >1000) ve option label >500 test edilmemis

**Dosya:** test/server.test.js
**Lens:** testcoverage
**Sorun:** validQuestions question.length===0/>1000 (74-75) ve label bos/>500 (153-158) 400 doner; HTTP-level test yok. tree children non-array (132-138) da test edilmemis.
**Onerilen Fix:** question:'' → 400; 1001-char → 400; label 501-char → 400; tree children:'string' → 400.

### [LOW] server.test.js: validQuestions bos-string question (length=0) test edilmemis

**Dosya:** test/server.test.js
**Lens:** testcoverage
**Sorun:** questions-not-array test edili ama question:'' veya 1001-char distinct dali test edilmemis (yukaridaki bulgunun ayri dogrulamasi).
**Onerilen Fix:** question:'' ve 1001-char ile 400 testleri.

### [LOW] server.test.js: tree children non-array validation (400) test edilmemis

**Dosya:** test/server.test.js
**Lens:** testcoverage
**Sorun:** tree icin children array dogrulamasi (130-143) test edilmiyor; yalnizca bos options ve depth>6 test edili.
**Onerilen Fix:** `options:[{label:'A', children:'bad'}]` → 400 testi.

### [LOW] server.test.js: 8MB body size guard test edilmemis

**Dosya:** test/server.test.js:28-85
**Lens:** testcoverage
**Sorun:** readBody 8MB asiminda destroy+reject (32-47); test yok. Limiti kaldiran/yukselten regresyon yakalanmaz.
**Onerilen Fix:** `Buffer.alloc(8.1e6,'x')` body → baglanti drop / 4xx-5xx.

### [LOW] bridge.test.js: cancel() pending yokken false donusu assert edilmiyor

**Dosya:** test/bridge.test.js:25-31
**Lens:** testcoverage
**Sorun:** cancel pending'i reject ediyor test edili ama `cancel()` pending yokken false doner (kaynak 43); donus assert edilmiyor. Donus tipi degisirse gorunmez.
**Onerilen Fix:** `const b = new Bridge(); assert.strictEqual(b.cancel('x'), false);`.

### [LOW] release.yml: changesets disindaki action'lar (checkout, setup-node) pin'lenmemis — supply-chain

**Dosya:** .github/workflows/release.yml:24,29,39
**Lens:** security
**Sorun:** changesets/action SHA-pinli (iyi) ama actions/checkout@v4 ve setup-node@v4 floating tag. Bu job `contents:write`, `id-token:write`, NPM_TOKEN'a sahip; v4 tag (mutable) ele gecirilirse ayricalikli baglamda arbitrary kod, token sizmasi.
**Repro:** setup-node v4 tag yeniden isaretlenirse main push'ta release job kotu kod calistirir.
**Onerilen Fix:** Tum action'lari full-length commit SHA ile pin'le.

### [LOW] npm audit yorumu yanlis/yaniltici — js-yaml CVE senaryosu --omit=dev ile zaten gecerli degil

**Dosya:** .github/workflows/ci.yml:35-37
**Lens:** correctness
**Sorun:** Yorum '--omit=dev'in @changesets/cli transitive (js-yaml) CVE'sini atladigini soyluyor ama @changesets/cli devDependency; --omit=dev zaten tum dev agacini cikarir. Paketin production dependency'si yok; gerekce yaniltici, gelecekte yanlis guvene yol acabilir.
**Onerilen Fix:** Yorumu gercege uydur ('production dependency yok; --omit=dev devDependency CVE'lerinin high gate'i tetiklemesini onler'); spesifik js-yaml iddiasini dogrula ya da kaldir.

### [LOW] .prettierignore web/ kaynagini dislamiyor; eslint 'web/ lint disi' diyor ama Prettier hepsini format:check'e sokuyor

**Dosya:** .prettierignore:1
**Lens:** correctness
**Sorun:** eslint.config.js 'web/**'i ignore ediyor ('web ayri ortam') ama .prettierignore yalnizca 'web/vendor/**' disliyor. format:check tum web/ tarayici dosyalarini kontrol eder; bir arac disliyor, digeri dislamiyor. web/'de Prettier'in parse edemedigi sozdizimi olursa format:check beklenmedik fail eder.
**Repro:** web/'e Prettier'in begenmedigi bicim gir → lint gecer, format:check fail.
**Onerilen Fix:** Iki aracin kapsamini hizala (ya .prettierignore'a 'web/\*\*' ya eslint ignore'unu daralt + yorumu duzelt).

### [LOW] Release testleri yalnizca Node 20'de; CI matrisi [18,20,22] ile asimetri

**Dosya:** .github/workflows/release.yml:29-37
**Lens:** correctness
**Sorun:** CI testleri 18/20/22 matrisinde; release.yml publish oncesi npm test'i yalnizca Node 20'de. main push iki workflow'u paralel tetikler; yalnizca 18/22'de patlayan test CI kirmiziya donmeden Release publish'e ilerleyebilir. 'CI tum Node'larda gecmeli' invariant'i publish kapisinda garanti edilmiyor.
**Repro:** Yalnizca Node 18'de fail eden test ekle → CI test(18) kirmizi ama Release Node 20 testini gecip publish'e gidebilir.
**Onerilen Fix:** Release'i CI basarisina bagla (workflow_run completed+success ya da required job).

### [LOW] server.test.js: /ask bos questions array (400) test edilmemis

**Dosya:** test/server.test.js:76-85
**Lens:** testcoverage
**Sorun:** validQuestions bos array'i (length===0) reddeder; test yalnizca non-array string kapsiyor, `{questions:[]}` icin 400+mesaj test edilmiyor (distinct dal).
**Onerilen Fix:** `POST /ask {questions:[]}` → 400, error /non-empty/.

> Not: hook-output, bridge-client askBridge-timeout, server.test 409 (concurrent /ask ve pending-yok /answer), serveStatic traversal, setEnabled-leak ve mcp-zombie testleri yukaridaki bulgularda **birden cok kez** dogrulanmistir (ayni kök, farkli denetci paragraflari). Burada her biri bir kez ele alinip tekrarlar Kapsama Matrisi'nde isaretlenmistir.

---

## Bileşen Bazli Ozet

| Bilesen                                      | Tip        | Bulgu | En Agir                                                                   | Durum                                        |
| -------------------------------------------- | ---------- | ----- | ------------------------------------------------------------------------- | -------------------------------------------- |
| Bridge (Randevu Cekirdegi)                   | shared-lib | 4     | High (state-machine atomik degil, cross-round sahiplik)                   | Bozuk — id sahiplik dogrulamasi sart         |
| HTTP Bridge Sunucusu                         | daemon     | ~14   | High (readBody race, /answer cross-round, nested tree label)              | Bozuk — concurrency + validasyon delikleri   |
| Bridge Istemcisi                             | shared-lib | ~9    | High (AbortError ayrimsiz, .answers null, spawn yutma)                    | Riskli — hata gorunurlugu yok                |
| MCP Sunucusu                                 | mcp        | ~3    | High (catch{} detay silme)                                                | Riskli — gozlemlenemez                       |
| PreToolUse Hook                              | hook       | ~5    | Medium (readStdin hang, EPIPE yutma)                                      | Kabul edilebilir — hang kenar durumu acik    |
| CLI (askuserquestionspro)                    | cli        | ~10   | High (uncaught settings I/O, spawn error, fetch timeout, main catch)      | Bozuk — ham stack/asili kalma                |
| Kurulum Scriptleri (Shell)                   | cli        | ~13   | High (curl\|bash RCE, idempotency cift hook, jq sahte basari)             | Riskli — supply-chain + idempotency          |
| Ayarlar (Disk + Sema)                        | shared-lib | ~9    | High (write sahte basari, non-atomic)                                     | Bozuk — sessiz veri kaybi                    |
| Web UI — Durum Makinesi (app.js)             | web-ui     | ~16   | High (binary veri kaybi, number-key kirlenme, stale popup, double-submit) | Bozuk — veri kaybi + a11y                    |
| Web UI — SSE/Ag (live.js)                    | web-ui     | ~8    | High (orphan timer/ghost ES) + 3 dogrulama                                | Riskli — backoff/timeout yok                 |
| Web UI — Sunum (views/ui-kit/settings-panel) | web-ui     | ~30   | High (save in-flight race, TreeCard confirmed, a11y yiginis)              | Bozuk — sistematik a11y eksigi               |
| Cevap Haritasi (answer-map.js)               | shared-lib | ~10   | Critical (ranking/tree OOB crash)                                         | Bozuk — OOB guard sart                       |
| Tema Sistemi (themes/styles)                 | shared-lib | ~9    | High (swapFont head null, read() sifir test)                              | Kismi — swatch sapmasi + test boslugu        |
| Test Paketi                                  | test       | ~40   | High (mcp zombie, setEnabled leak, 409/traversal/timeout boslugu)         | Riskli — happy-path bagimli, izolasyon zayif |
| CI/CD ve Yapilandirma                        | config     | ~5    | Low (action pin, audit yorumu, prettier/eslint kapsam, release matris)    | Kabul edilebilir — kucuk tutarsizliklar      |

---

## Kapsama Matrisi

Lens kisaltmalari: **EH** errorhandling · **CR** correctness/invariant · **CC** concurrency · **SU** stateui · **A11Y** accessibility · **PERF** performance · **SEC** security · **TC** testcoverage

| Bilesen                     | EH             | CR                    | CC         | SU             | A11Y                     | PERF               | SEC                            | TC                         |
| --------------------------- | -------------- | --------------------- | ---------- | -------------- | ------------------------ | ------------------ | ------------------------------ | -------------------------- |
| Bridge cekirdegi            | ✗(high)        | ✗(med)                | ✗(high)    | —              | —                        | —                  | —                              | ✗(low: cancel-false)       |
| HTTP Sunucusu               | ✗(high)        | ✗(high)               | ✗(high)    | —              | —                        | ✗(med ×3)          | ✓ (traversal kodu var, test ✗) | ✗(med/low)                 |
| Bridge Istemcisi            | ✗(high)        | —                     | ✗(med/low) | —              | —                        | —                  | —                              | ✗(low)                     |
| MCP Sunucusu                | ✗(high)        | —                     | —          | —              | —                        | —                  | —                              | ✗ (zombie test)            |
| PreToolUse Hook             | ✗(med/low)     | ✗(med)                | —          | —              | —                        | —                  | —                              | ✗(med)                     |
| CLI                         | ✗(high ×4)     | ✗(low ×3)             | —          | —              | —                        | —                  | —                              | ✗(low: sifir test)         |
| Shell Scriptleri            | ✗(high ×3)     | ✗(high/low)           | —          | —              | —                        | —                  | ✗(high RCE + low ×4)           | n/a                        |
| Ayarlar                     | ✗(high ×2/low) | ✗(high/med/low)       | —          | —              | —                        | —                  | —                              | ✗(med)                     |
| app.js                      | ✗(high ×3/med) | ✗(high ×2)            | —          | ✗(med ×3/low)  | ✗(high ×4/med)           | —                  | —                              | —                          |
| live.js                     | ✗(med/low)     | ✓ ×2 (dogrulama)      | ✗(low)     | —              | —                        | ✗(high/med ×2/low) | —                              | —                          |
| views/ui-kit/settings-panel | ✗(low)         | ✗(high/med ×3/low ×3) | —          | ✗(high/med ×2) | ✗(high ×5/med ×4/low ×3) | ✗(low)             | —                              | —                          |
| answer-map.js               | —              | ✗(high ×4/low)        | —          | —              | —                        | —                  | —                              | ✗(crit ×2/high ×2/med ×2)  |
| Tema Sistemi                | ✗(low)         | ✗(med ×2)             | —          | —              | —                        | —                  | —                              | ✗(high ×2/med ×4/low ×2)   |
| Test Paketi                 | —              | ✗(med)                | —          | —              | —                        | —                  | —                              | ✗(high ×6/med ×10+/low ×8) |
| CI/CD Config                | —              | ✗(low ×3)             | —          | —              | —                        | —                  | ✗(low)                         | —                          |

**Lejant:** ✗ = bulgulu (en agir severity parantezde) · ✓ = tarandi ve temiz / yalnizca dogrulama (kusur degil) · — = bu lens bu bilesende uygulanmadi/ilgili degil · n/a = lens bilesen tipiyle uyumsuz

### Tarandi & Temiz (dogrulama bulgulari)

- **server/bridge.js:23-30** (CC) — getCurrent/peek senkron okuma atomik; race yok.
- **web/live.js:22-32** (CR) — onerror/cleanup closed-guard dogru; sizinti yok.
- **web/live.js:14-21** (CR) — JSON parse hatasi/non-object payload state'i bozmuyor.

### Bilinerek Kapsam Disi / Onerilen Sonraki Adimlar

- **server/server.js path traversal (403), readBody 8MB, /ask & /answer 409, question/label uzunluk sinirlari, tree children non-array:** Koruma kodu **mevcut ve dogru gorunuyor** ancak **HTTP-level regresyon testi yok** — bu lens-bilesen kesisimi "tarandi, kod var, test eksik" durumundadir; oncelikli test borcu.
- **lib/app-id.cjs, web/styles.css, .mcp.json, .prettierrc.json, .changeset/config.json, package.json:** Bu denetimde dogrudan bulgu uretmedi; baglam disinda kalan dosyalardir (yalnizca cevre bilesenleri uzerinden degerlendirildiler).
- **Mutasyon/yuk/fuzzing testleri (property-based, k6/oha yuk):** Hic uygulanmadi; ozellikle Bridge concurrency ve readBody race'leri icin onerilir.
- **End-to-end (Claude→hook→server→UI→answer) entegrasyon testi:** Bilesenler birim duzeyde test edili ama tam zincir (ozellikle cross-round id propagasyonu) hic test edilmiyor — en kritik test boslugu.
