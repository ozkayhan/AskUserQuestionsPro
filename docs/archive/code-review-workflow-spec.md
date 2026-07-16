# Dynamic Deep Code-Review Workflow

## Context

Kullanıcı, app'i baştan aşağı — "her aşaması" — aşırı titiz tarayan, onlarca yıllık tecrübeli bir code-review danışmanlık firmasından milyon dolarlık hizmet almış gibi **yüzlerce doğru kontrolden geçirip** tüm bug'ları, sıkıntılı yerleri ve performans sorunlarını çok detaylı raporlayan bir **dynamic workflow** istiyor.

"Dynamic" burada kritik: workflow app'in yapısını **dışarıdan hardcode etmez**, her çalıştığında repoyu kendi **Phase 0'ında** yeniden haritalandırır ve tarama fazlarını o haritadan türetir. Böylece kod değişse de, başka bir repoda çalışsa da kendini ayarlar.

Hedef: çıktı = severity'e göre sıralı, `dosya:satır` + repro + fix önerisi içeren **tek markdown rapor**. Kod değiştirmez (salt rapor).

### Bu repo (Phase 0'ın üreteceği haritanın önizlemesi)

Tek-paket Node.js app (~5.6k LOC, 35 JS dosyası), 5 net aşama:
`CLI (bin/) → Hook (hooks/) → Bridge Daemon (server/, HTTP+SSE port 4517) → MCP Server (mcp-server/) → Web UI (web/, React+Babel, build yok)`. Paylaşılan: `lib/` (daemon spawn, settings, app-id). Test: `node:test`, 13 dosya. Lint: `npm run lint` (eslint), `npm run format:check` (prettier). Bilinen risk bölgeleri: daemon spawn race, single-flight concurrency (`server/bridge.js`), hook stdin/stdout sınırı, SSE/answer lifecycle, recursive tree validation, settings atomicity.

## Kararlar (kullanıcıdan onaylı)

- **Lensler (7):** correctness/bug, concurrency/race, performance, error-handling/resilience, state-machine/UI, test-coverage boşlukları, over-engineering/dead-code. (Security ve a11y bu sefer dışarıda.)
- **Derinlik:** budget'a göre. `+<N>k` token hedefi verilirse o hedefe kadar loop-until-dry derinleşir; hedef yoksa 1 tam geçiş + 1 completeness round (fallback).
- **Doğrulama:** her bulgu 3 bağımsız lensten refute denemesi görür, çoğunluk kararı (perspective-diverse adversarial vote). False-positive eler.
- **Çıktı:** tek markdown rapor, kod değişmez.
- **Çalıştırma:** tek seferlik inline script (kaydedilmez).

## Mimari

```
Phase 0  Harita      1 agent → component manifest {name, type, files[], risk, lenses[]}
Phase 1  Tarama      pipeline(jobs=component×lens):
                       stage A scan    → findings[]   (lens-spesifik prompt)
                       stage B verify  → her finding'e 3'lü adversarial oy → survives?
Phase 2  Critic      barrier: tüm doğrulanmış bulgular + manifest → "neyi kaçırdık?"
                       yeni job önerir (eksik lens/bileşen). Budget/dry bitene dek tekrar.
Phase 3  Sentez      1 agent → severity-sıralı markdown rapor (dosya:satır, repro, fix)
                     → workflow return; ana loop .context/audit-report.md'ye yazar
```

Neden pipeline: bir bileşenin tarama+doğrulaması bitmeden diğeri beklemez; verify, scan biter bitmez başlar. Barrier yalnızca Phase 2'de (critic tüm bulguları birlikte görmeli).

## Uygulama

Plan onaylanınca tek adım: aşağıdaki scripti `Workflow` tool'una `script` olarak ver. Script kendini `.context/`'e değil — sonucu döndürür; rapor dosyasını **ana loop** `.context/audit-report.md` olarak yazar (workflow agent'larına dosya yazdırmaktan kaçınıp tek yazma noktası tutuyoruz). Düzeltme/iterasyon için script `scriptPath` ile dosyaya persist edilir, Edit + re-invoke.

### Workflow scripti

```javascript
export const meta = {
  name: 'deep-code-audit',
  description:
    'Dynamic milyon-dolarlik code review: repoyu haritala, cok-lensli derin tara, adversarial dogrula, raporla',
  phases: [
    { title: 'Harita' },
    { title: 'Tarama' },
    { title: 'Verify' },
    { title: 'Critic' },
    { title: 'Sentez' },
  ],
};

// ---- Seçili lensler (kullanıcı kararı). Phase 0 her bileşene uygun olanları işaretler. ----
const LENSES = {
  correctness:
    'Mantik hatalari, edge-case, off-by-one, yanlis varsayim, kontrat ihlali, yanlis davranis.',
  concurrency:
    'Race condition, daemon spawn yarisi, single-flight ihlali, SSE/answer lifecycle, deadlock, atomicity.',
  performance:
    'Gereksiz I/O, bloklayan cagri, O(n^2), bellek sizinti, gereksiz re-render, SSE broadcast maliyeti.',
  errorhandling:
    'Yutulan hata, sessiz exit, eksik fallback, veri kaybi, partial-write, timeout/cancel hatalari.',
  stateui:
    'React akis hatasi, keyboard nav, answer accumulation, stale state, review/submit gecisleri.',
  testcoverage:
    'Test edilmemis kritik yol, eksik failure-mode testi, kirilgan test, coverage boslugu.',
  overengineering:
    'Silinebilir kod, gereksiz soyutlama, dead code, tek-implementasyonlu interface, kopya mantik.',
};

const SCAN_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string', description: 'dosya yolu' },
          line: { type: 'string', description: 'satir veya aralik, bilinmiyorsa ""' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          lens: { type: 'string' },
          detail: { type: 'string', description: 'ne, neden hata, kosul' },
          repro: { type: 'string', description: 'tetikleyen senaryo / repro adimi, yoksa ""' },
          fix: { type: 'string', description: 'onerilen duzeltme ozeti' },
        },
        required: ['title', 'file', 'severity', 'lens', 'detail', 'fix'],
      },
    },
  },
  required: ['findings'],
};

const MANIFEST_SCHEMA = {
  type: 'object',
  properties: {
    components: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            description: 'cli|hook|daemon|mcp|web-ui|shared-lib|test|config',
          },
          files: { type: 'array', items: { type: 'string' } },
          risk: { type: 'string', description: 'bu bilesendeki en riskli nokta(lar)' },
          lenses: {
            type: 'array',
            items: { type: 'string' },
            description: `su anahtarlardan uygun olanlar: ${Object.keys(LENSES).join(', ')}`,
          },
        },
        required: ['name', 'type', 'files', 'lenses'],
      },
    },
  },
  required: ['components'],
};

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean', description: 'bulgu yanlis/gecersiz ise true' },
    reason: { type: 'string' },
  },
  required: ['refuted', 'reason'],
};

const REPORT_SCHEMA = {
  type: 'object',
  properties: { markdown: { type: 'string', description: 'tam markdown rapor' } },
  required: ['markdown'],
};

const key = (f) => `${f.file}:${f.line || '?'}:${(f.title || '').slice(0, 60)}`;

// ---- Phase 0: Harita ----
phase('Harita');
const manifest = await agent(
  `Bu repoyu kapsamli code review icin haritalandir. Repoyu KEsfet (dosyalari oku), bilesenlere ayir.
Her bilesen icin: name, type (cli|hook|daemon|mcp|web-ui|shared-lib|test|config), o bilesene ait dosya yollari (gercek, dogrulanmis), en riskli nokta, ve su lenslerden HANGILERI bu bilesene anlamli sekilde uygulanir: ${Object.keys(LENSES).join(', ')}.
Ornek: bir daemon icin concurrency+errorhandling cok onemli; saf config icin belki sadece correctness. Lensleri bilesenin gercek dogasina gore sec — hardcode etme.
Tum repoyu kapsa; hicbir kaynak dosya bilesensiz kalmasin.`,
  { label: 'harita', phase: 'Harita', schema: MANIFEST_SCHEMA }
);

// component × lens işlerini düzleştir (sadece seçili + uygun lensler)
const selected = new Set(Object.keys(LENSES));
let jobs = [];
for (const c of manifest.components) {
  for (const lens of (c.lenses || []).filter((l) => selected.has(l))) {
    jobs.push({ component: c, lens });
  }
}
log(`${manifest.components.length} bilesen, ${jobs.length} tarama isi (bilesen x lens)`);

// ---- tek bir job'u tara + adversarial doğrula (pipeline) ----
const seen = new Set();
const confirmed = [];

async function runJobs(jobList, roundTag) {
  const results = await pipeline(
    jobList,
    // stage A: scan
    (job) =>
      agent(
        `Bilesen: ${job.component.name} (${job.component.type}). Dosyalar: ${job.component.files.join(', ')}.
Riskli nokta: ${job.component.risk || '-'}.
LENS = ${job.lens}: ${LENSES[job.lens]}
Bu dosyalari DERINLEMESINE oku ve SADECE bu lens acisindan gercek, somut bulgular cikar. Spekulasyon yok — her bulgu kod kanitina dayanmali.
Her bulgu icin dosya yolu ve mumkunse satir/aralik ver. Bulgu yoksa bos liste don.`,
        { label: `scan:${job.component.name}/${job.lens}`, phase: 'Tarama', schema: SCAN_SCHEMA }
      ),
    // stage B: verify — her finding'e 3'lü adversarial oy
    (scan, job) =>
      parallel(
        (scan?.findings || [])
          .filter((f) => {
            const k = key(f);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .map((f) => () => {
            const lenses = ['correctness', 'repro-edilebilirlik', 'guven-altinda'];
            return parallel(
              lenses.map(
                (vl, i) => () =>
                  agent(
                    `Bir code-review bulgusunu CURUTMEYE calis (adversarial). Lens: ${vl}.
Bulgu: "${f.title}" — ${f.file}:${f.line || '?'} (${f.lens})
Iddia: ${f.detail}
Onerilen fix: ${f.fix}
Ilgili dosyayi oku ve dogrula. Bulgu yanlis, gecersiz, zaten ele alinmis ya da reprodusce edilemiyorsa refuted=true. Emin degilsen refuted=true (yuksek bar). Sadece kod kanitiyla gecerliyse refuted=false.`,
                    { label: `verify:${f.file}#${i}`, phase: 'Verify', schema: VERDICT_SCHEMA }
                  )
              )
            ).then((votes) => {
              const refutes = votes.filter(Boolean).filter((v) => v.refuted).length;
              return refutes >= 2 ? null : f; // 3'te 2+ çürütme → ele
            });
          })
      )
  );
  const survivors = results.flat().filter(Boolean);
  confirmed.push(...survivors);
  log(`[${roundTag}] ${survivors.length} dogrulanmis bulgu (toplam ${confirmed.length})`);
  return survivors;
}

// ---- Phase 1 + 2: tarama + completeness loop (budget'a göre) ----
phase('Tarama');
await runJobs(jobs, 'round-1');

phase('Critic');
let dry = 0;
let round = 1;
const hasBudget = !!budget.total;
while (dry < 1) {
  // budget guard: hedef varsa ona kadar; yoksa tek critic roundu yeter
  if (hasBudget) {
    if (budget.remaining() < 60_000) {
      log('budget bitti, critic durdu');
      break;
    }
  } else if (round >= 2) break;

  round++;
  const critic = await agent(
    `Su ana kadarki dogrulanmis bulgular (${confirmed.length} adet) ve bilesen haritasi asagida.
Bir COMPLETENESS elestirmeni olarak sor: hangi bilesen+lens kombinasyonu yetersiz tarandi? Hangi kritik dosya/yol hic bakilmadi? Hangi failure-mode atlandi?
Sadece HENUZ tam taranmamis, somut yeni (bilesen, lens) isleri oner. Her sey kapsanmissa bos liste don.

BILESENLER: ${JSON.stringify(manifest.components.map((c) => ({ name: c.name, type: c.type, lenses: c.lenses })))}
MEVCUT BULGULAR: ${JSON.stringify(confirmed.map((f) => ({ file: f.file, lens: f.lens, title: f.title })))}`,
    {
      label: `critic-${round}`,
      phase: 'Critic',
      schema: {
        type: 'object',
        properties: {
          newJobs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                componentName: { type: 'string' },
                lens: { type: 'string' },
                why: { type: 'string' },
              },
              required: ['componentName', 'lens'],
            },
          },
        },
        required: ['newJobs'],
      },
    }
  );

  const fresh = (critic.newJobs || [])
    .map((nj) => {
      const c = manifest.components.find((x) => x.name === nj.componentName);
      return c && selected.has(nj.lens) ? { component: c, lens: nj.lens } : null;
    })
    .filter(Boolean);

  if (!fresh.length) {
    dry++;
    log(`critic: yeni is yok (dry=${dry})`);
    continue;
  }
  log(`critic round ${round}: ${fresh.length} yeni is`);
  await runJobs(fresh, `round-${round}`);
}

// ---- Phase 3: Sentez ----
phase('Sentez');
const order = { critical: 0, high: 1, medium: 2, low: 3 };
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

const report = await agent(
  `Asagidaki ${confirmed.length} DOGRULANMIS code-review bulgusundan profesyonel bir denetim raporu (markdown) uret.
Yapi:
# Kod Denetim Raporu
## Yonetici Ozeti  (bilesen sayisi, bulgu sayisi, severity dagilimi, en kritik 3 tema)
## Bulgular  (severity sirali; her biri: ### [SEVERITY] baslik / **Dosya:** path:line / **Lens:** / **Sorun:** / **Repro:** / **Onerilen Fix:**)
## Bilesen Bazli Ozet  (her bilesen icin kac bulgu, durum)
## Kapsama Notu  (hangi lensler/bilesenler tarandi, neyin disinda kaldigi)
Net, somut, muhendise hitap eden bir dil kullan. Uydurma — sadece verilen bulgulari kullan.

BULGULAR JSON:
${JSON.stringify(confirmed, null, 2)}

BILESEN HARITASI:
${JSON.stringify(manifest.components, null, 2)}`,
  { label: 'sentez', phase: 'Sentez', schema: REPORT_SCHEMA }
);

return {
  components: manifest.components.length,
  findings: confirmed.length,
  markdown: report.markdown,
};
```

### Onay sonrası ana-loop adımları (ben yaparım)

1. `Workflow({ script })` ile çalıştır.
2. Dönen `markdown`'ı `Write` ile `.context/audit-report.md`'ye yaz.
3. Kullanıcıya özet: bileşen sayısı, doğrulanmış bulgu sayısı, severity dağılımı + rapor yolu.

## Notlar / sınırlar

- **Budget:** Daha derin/komple tarama için mesajda `+500k` gibi bir token hedefi ver — critic loop o hedefe kadar yeni iş üretip derinleşir. Hedef yoksa 1 tam geçiş + 1 critic roundu.
- **Concurrency cap:** workflow aynı anda ~14 agent çalıştırır; yüzlerce iş kuyruğa girer, hepsi tamamlanır.
- Worktree/isolation yok (salt-okuma denetim, dosya değiştirmiyoruz).
- Security ve a11y lensleri kapsam dışı (kullanıcı kararı) — sonradan `LENSES`'e eklenip tek satırla açılabilir.

## Doğrulama (workflow bittikten sonra)

- `.context/audit-report.md` oluştu mu, severity sıralı bulgular ve gerçek `dosya:satır` referansları içeriyor mu?
- Birkaç critical/high bulguyu elle aç: ilgili dosya:satıra bak, iddia kod kanıtıyla tutuyor mu (false-positive var mı)?
- `npm run lint` ve `npm test` baseline'ı bozulmamış (workflow kod değiştirmedi, değişmemeli).
