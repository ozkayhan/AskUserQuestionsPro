# Dynamic Deep Code-Audit Workflow — Forbes-grade, token-efficient

## Context

Kullanıcı, app'in **her aşamasını** onlarca yıllık tecrübeli bir danışmanlık firmasından milyon dolarlık hizmet almış gibi taranmış hale getiren bir **dynamic workflow** istiyor: yüzlerce doğru kontrol, tüm bug/sıkıntı/performans sorunları, çok detaylı ve **anlamlı** rapor.

İkinci tur talep: **10x daha kapsamlı + derin + kaliteli (Forbes 100 standardı)** AMA aynı zamanda **10x daha token-efficient** — doğru agent için doğru modeli seçip israf etmeyen, gereksiz context bloat yapmayan.

Bu çelişki değil; çözüm **doğru tahsis**: körlemesine her `dosya × lens` çarpımını en pahalı modele sürmek yerine, ucuz modelle triyaj yapıp token'ı yalnızca sıcak noktalarda derinliğe yatırmak; her agent'a yalnız kendi bileşeninin dosyalarını vermek (context diet); ucuz/çok-sayıda işi (triyaj, doğrulama oyları) en ucuz modele atamak.

"Dynamic": workflow yapıyı hardcode etmez — her çalıştığında Phase 0'da repoyu yeniden haritalar, invariant'larını çıkarır ve fazları o haritadan türetir.

### Bu repo (Phase 0'ın üreteceği haritanın önizlemesi)

Tek-paket Node.js app (~5.6k LOC, 35 JS dosyası), 5 aşama: `CLI (bin/) → Hook (hooks/) → Bridge Daemon (server/, HTTP+SSE :4517) → MCP Server (mcp-server/) → Web UI (web/, React+Babel, build yok)` + paylaşılan `lib/`. Test: `node:test` (13 dosya). Lint: `npm run lint`, `npm run format:check`. Risk: daemon spawn race, single-flight concurrency (`server/bridge.js`), hook stdin/stdout sınırı, SSE/answer lifecycle, recursive tree validation, settings atomicity.

## Kararlar (kullanıcıdan onaylı)

- **Lensler (9):** correctness, concurrency/race, **security**, performance, error-handling/resilience, state-machine/UI, **accessibility**, test-coverage, over-engineering/dead-code.
- **Model profili — dengeli:** `opus` → derin-kritik tarama + sentez. `sonnet` → recon + orta tarama + critic. `haiku` → triyaj + doğrulama oyları. (En çok sayıda agent — triyaj ve verify — en ucuz modelde; token'ın aslan payı yalnız yüksek-sinyal derin analizde.)
- **Derinlik — ölçülü:** 1 tam derin geçiş + en fazla 2 critic round. Token hedefi (`+Nk`) verilirse loop ona kadar derinleşir (opsiyonel kaldıraç).
- **Doğrulama:** her bulgu 3 bağımsız lensten refute denemesi görür (perspective-diverse, haiku), çoğunluk kararı.
- **Çıktı:** tek consulting-grade markdown rapor; kod değişmez.
- **Çalıştırma:** tek seferlik inline script.

## Mimari — 5 faz

```
Phase 0  Recon (multi-modal, sonnet)
   A: component map + her bileşenin INVARIANT'ları (ne yapmalı) + uygun lensler
   B: cross-cutting data-flow / IPC sözleşmeleri / güven sınırları
Phase 1  Triyaj (haiku, ucuz/dar): her bileşen×lens → "bakmaya değer mi? + hot files/bölge"
   → sadece worth=true işler derin taramaya geçer (kör cartesian'ı kırpar = ana token tasarrufu)
Phase 2  Derin tarama (pipeline, sıcak işler):
   A: invariant-aware deep scan (opus kritik-lens / sonnet diğer) + uzman persona → findings
   B: 3'lü adversarial vote (haiku) → survivors
Phase 3  Critic + tema kümeleme (sonnet): sistemik kök-neden desenleri + eksik kapsam → yeni iş (≤2 round)
Phase 4  Sentez (opus): exec summary + sistemik temalar + severity×impact + repro + fix + kapsama matrisi
   → workflow return; ana loop .context/audit-report.md yazar
```

**Neden 10x kaliteli:** (1) invariant-aware — kod kokusu aramak yerine "ne yapmalı"ya karşı sapma bulmak; (2) uzman persona ataması (security-auditor, test-engineer, web-performance-auditor, code-reviewer); (3) 3'lü adversarial doğrulama false-positive eler; (4) tema kümeleme tek tek bulgu yerine sistemik desen çıkarır.
**Neden 10x efficient:** (1) triyaj kör çarpımı kırpar — opus yalnız sıcak noktalara gider; (2) model tiering — yüzlerce verify oyu + tüm triyaj haiku'da; (3) context diet — her agent yalnız kendi dosyalarını görür, manifest/bulgu listeleri compact taşınır.

## Uygulama

Plan onaylanınca tek adım: aşağıdaki scripti `Workflow` tool'una `script` olarak ver. Sonuç döner; rapor dosyasını **ana loop** `.context/audit-report.md` olarak yazar (tek yazma noktası). İterasyon: script `scriptPath` ile persist edilir → Edit + re-invoke.

### Workflow scripti

```javascript
export const meta = {
  name: 'deep-code-audit',
  description:
    'Dynamic Forbes-grade code audit: haritala, triyajla, invariant-aware derin tara, adversarial dogrula, raporla',
  phases: [
    { title: 'Recon' },
    { title: 'Triyaj' },
    { title: 'Tarama' },
    { title: 'Verify' },
    { title: 'Critic' },
    { title: 'Sentez' },
  ],
};

// ---- 9 lens ----
const LENSES = {
  correctness: 'Mantik hatasi, edge-case, off-by-one, yanlis varsayim, kontrat/invariant ihlali.',
  concurrency:
    'Race condition, daemon spawn yarisi, single-flight ihlali, SSE/answer lifecycle, atomicity, deadlock.',
  security:
    'Input validation, trust boundary, command/path injection, hook stdin siniri, ayricalikli dosya yazma, SSRF/localhost guveni.',
  performance:
    'Gereksiz I/O, bloklayan cagri, O(n^2), bellek sizinti, gereksiz re-render, SSE broadcast maliyeti.',
  errorhandling:
    'Yutulan hata, sessiz exit, eksik fallback, veri kaybi, partial-write, timeout/cancel yanlislari.',
  stateui:
    'React akis hatasi, keyboard nav, answer accumulation, stale/yaris state, review/submit gecisleri.',
  accessibility:
    'Klavye erisimi, ARIA, focus yonetimi, kontrast, screen-reader, semantik HTML (sadece web-ui).',
  testcoverage:
    'Test edilmemis kritik yol, eksik failure-mode testi, kirilgan test, coverage boslugu.',
  overengineering:
    'Silinebilir/dead kod, gereksiz soyutlama, tek-implementasyonlu interface, kopya mantik.',
};

// kritik lensler -> opus; digerleri -> sonnet
const DEEP = new Set(['correctness', 'concurrency', 'security']);
const modelForScan = (lens) => (DEEP.has(lens) ? 'opus' : 'sonnet');

// lens+bilesen -> uzman persona
function agentTypeFor(lens, compType) {
  if (lens === 'security') return 'agent-skills:security-auditor';
  if (lens === 'testcoverage') return 'agent-skills:test-engineer';
  if (lens === 'performance' && compType === 'web-ui')
    return 'agent-skills:web-performance-auditor';
  return 'agent-skills:code-reviewer';
}

// ---- şemalar ----
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
          risk: { type: 'string' },
          invariants: {
            type: 'array',
            items: { type: 'string' },
            description: 'bu bilesenin TUTMASI GEREKEN dogruluklar (ne yapmali)',
          },
          lenses: {
            type: 'array',
            items: { type: 'string' },
            description: `uygun olanlar: ${Object.keys(LENSES).join(', ')}`,
          },
        },
        required: ['name', 'type', 'files', 'lenses'],
      },
    },
  },
  required: ['components'],
};

const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    worth: { type: 'boolean', description: 'bu lens icin derin taramaya deger mi' },
    hot: {
      type: 'array',
      items: { type: 'string' },
      description: 'supheli dosya/bolge/satir ipuclari',
    },
    reason: { type: 'string', description: 'kisa gerekce' },
  },
  required: ['worth'],
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
          file: { type: 'string' },
          line: { type: 'string', description: 'satir/aralik, yoksa ""' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          lens: { type: 'string' },
          detail: { type: 'string', description: 'ne + neden hata + hangi kosulda' },
          repro: { type: 'string', description: 'tetikleyen senaryo, yoksa ""' },
          fix: { type: 'string' },
        },
        required: ['title', 'file', 'severity', 'lens', 'detail', 'fix'],
      },
    },
  },
  required: ['findings'],
};

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted'],
};

const REPORT_SCHEMA = {
  type: 'object',
  properties: { markdown: { type: 'string' } },
  required: ['markdown'],
};

const key = (f) => `${f.file}:${f.line || '?'}:${(f.title || '').slice(0, 50)}`;
const selected = new Set(Object.keys(LENSES));

// ---- Phase 0: Recon (multi-modal, paralel) ----
phase('Recon');
const [manifest, dataflow] = await parallel([
  () =>
    agent(
      `Bu repoyu kapsamli denetim icin haritalandir. Dosyalari oku, bilesenlere ayir.
Her bilesen: name, type, gercek dosya yollari, en riskli nokta, ve EN ONEMLISI invariants[] = bu bilesenin tutmasi GEREKEN dogruluklar (orn: "daemon ayni porta iki kez baglanmamali", "hook crash'inde native picker'a fallback etmeli"). Ayrica su lenslerden hangileri anlamli uygulanir: ${Object.keys(LENSES).join(', ')} (accessibility yalniz web-ui icin).
Tum repoyu kapsa; hicbir kaynak dosya bilesensiz kalmasin.`,
      { label: 'recon:map', phase: 'Recon', model: 'sonnet', schema: MANIFEST_SCHEMA }
    ),
  () =>
    agent(
      `Bu repoda bilesenler ARASI veri akisini ve sozlesmeleri cikar: hangi bilesen hangisini cagiriyor, IPC/HTTP/stdio sinirlari, guven sinirlari (nereye guvenilmeyen veri giriyor), paylasilan durum. Kisa ve somut maddeler halinde don (max ~15 madde). Bu cross-cutting baglam, critic ve security taramasinda kullanilacak.`,
      { label: 'recon:dataflow', phase: 'Recon', model: 'sonnet' }
    ),
]);

// component × lens işleri
let candidates = [];
for (const c of manifest.components) {
  for (const lens of (c.lenses || []).filter((l) => selected.has(l))) {
    candidates.push({ component: c, lens });
  }
}
log(`${manifest.components.length} bilesen, ${candidates.length} aday is`);

// ---- Phase 1: Triyaj (haiku, ucuz) — kör çarpımı kırp ----
phase('Triyaj');
const triaged = await parallel(
  candidates.map(
    (job) => () =>
      agent(
        `HIZLI TRIYAJ (derin analiz yapma). Bilesen: ${job.component.name} (${job.component.type}). Dosyalar: ${job.component.files.join(', ')}.
LENS = ${job.lens}: ${LENSES[job.lens]}
Bu dosyalara goz at: bu lens icin DERIN taramaya deger somut bir kuskunun var mi? Varsa worth=true ve supheli dosya/bolgeleri (hot) ver. Bariz temizse worth=false. Cabuk karar ver.`,
        {
          label: `triyaj:${job.component.name}/${job.lens}`,
          phase: 'Triyaj',
          model: 'haiku',
          schema: TRIAGE_SCHEMA,
        }
      ).then((t) => ({ ...job, triage: t }))
  )
);
let jobs = triaged.filter(Boolean).filter((j) => j.triage?.worth);
log(`triyaj: ${candidates.length} -> ${jobs.length} sicak is (derin taramaya gidiyor)`);

// ---- derin tarama + adversarial doğrulama (context diet) ----
const seen = new Set();
const confirmed = [];

async function runJobs(jobList, tag) {
  const results = await pipeline(
    jobList,
    // stage A: invariant-aware deep scan (sadece kendi dosyaları + hot bölgeler)
    (job) =>
      agent(
        `Bilesen: ${job.component.name} (${job.component.type}). Dosyalar: ${job.component.files.join(', ')}.
Tutmasi gereken invariant'lar: ${(job.component.invariants || []).join(' | ') || '-'}.
Supheli bolgeler (triyajdan): ${(job.triage?.hot || []).join(' | ') || '-'}.
LENS = ${job.lens}: ${LENSES[job.lens]}
Bu dosyalari DERINLEMESINE oku. Invariant'lara karsi sapmalari ve bu lensteki gercek, somut, kod-kanitli bulgulari cikar. Spekulasyon yok. Her bulguya dosya yolu + mumkunse satir. Bulgu yoksa bos liste.`,
        {
          label: `scan:${job.component.name}/${job.lens}`,
          phase: 'Tarama',
          model: modelForScan(job.lens),
          agentType: agentTypeFor(job.lens, job.component.type),
          schema: SCAN_SCHEMA,
        }
      ),
    // stage B: 3'lü adversarial vote (haiku)
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
            const vl = ['mantik-dogrulugu', 'reprodusce-edilebilirlik', 'zaten-ele-alinmis-mi'];
            return parallel(
              vl.map(
                (perspective, i) => () =>
                  agent(
                    `Bir denetim bulgusunu CURUTMEYE calis. Bakis acisi: ${perspective}.
Bulgu: "${f.title}" — ${f.file}:${f.line || '?'} (${f.lens}). Iddia: ${f.detail}. Fix: ${f.fix}
Ilgili dosyayi oku, dogrula. Yanlis/gecersiz/zaten-ele-alinmis/reprodusce-edilemez ise refuted=true. Emin degilsen refuted=true (yuksek bar).`,
                    {
                      label: `verify:${f.file}#${i}`,
                      phase: 'Verify',
                      model: 'haiku',
                      schema: VERDICT_SCHEMA,
                    }
                  )
              )
            ).then((votes) => {
              const refutes = votes.filter(Boolean).filter((v) => v.refuted).length;
              return refutes >= 2 ? null : f;
            });
          })
      )
  );
  const survivors = results.flat().filter(Boolean);
  confirmed.push(...survivors);
  log(`[${tag}] +${survivors.length} dogrulanmis (toplam ${confirmed.length})`);
  return survivors;
}

// ---- Phase 2: derin tarama ----
phase('Tarama');
await runJobs(jobs, 'round-1');

// ---- Phase 3: Critic + tema (sonnet), ≤2 round ----
phase('Critic');
const MAX_ROUNDS = 2;
const hasBudget = !!budget.total;
for (let round = 1; round <= MAX_ROUNDS; round++) {
  if (hasBudget && budget.remaining() < 60_000) {
    log('budget bitti');
    break;
  }

  const critic = await agent(
    `Bir COMPLETENESS + SISTEMIK-DESEN elestirmeni olarak degerlendir.
1) Hangi (bilesen, lens) yetersiz tarandi? Hangi kritik yol/failure-mode atlandi? Yeni somut isler oner (newJobs).
2) Mevcut bulgular arasinda SISTEMIK kok-neden temalari var mi (orn "her yerde yutulan catch")? themes[] olarak ozetle.

CROSS-CUTTING AKIS: ${dataflow.slice(0, 1500)}
BILESENLER: ${JSON.stringify(manifest.components.map((c) => ({ n: c.name, t: c.type, l: c.lenses })))}
BULGULAR: ${JSON.stringify(confirmed.map((f) => ({ file: f.file, lens: f.lens, sev: f.severity, t: f.title })))}`,
    {
      label: `critic-${round}`,
      phase: 'Critic',
      model: 'sonnet',
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
          themes: { type: 'array', items: { type: 'string' } },
        },
        required: ['newJobs'],
      },
    }
  );
  if (round === 1) globalThis.__themes = critic.themes || [];

  const fresh = (critic.newJobs || [])
    .map((nj) => {
      const c = manifest.components.find((x) => x.name === nj.componentName);
      return c && selected.has(nj.lens)
        ? { component: c, lens: nj.lens, triage: { hot: [] } }
        : null;
    })
    .filter(Boolean)
    .filter((j) => !j.component.files.every((file) => [...seen].some((s) => s.startsWith(file)))); // tamamen taranmışı atla

  if (!fresh.length) {
    log(`critic round ${round}: yeni is yok, durdu`);
    break;
  }
  log(`critic round ${round}: ${fresh.length} yeni is`);
  await runJobs(fresh, `round-${round + 1}`);
}

// ---- Phase 4: Sentez (opus) ----
phase('Sentez');
const order = { critical: 0, high: 1, medium: 2, low: 3 };
confirmed.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
const themes = globalThis.__themes || [];

const report = await agent(
  `Asagidaki ${confirmed.length} DOGRULANMIS bulgudan Forbes-grade bir denetim raporu (markdown) uret. Net, somut, muhendise hitap eden dil. Uydurma yok — sadece verilen veriler.

# Kod Denetim Raporu
## Yonetici Ozeti  (bilesen sayisi, bulgu sayisi, severity dagilimi, en kritik 3 tema, genel risk degerlendirmesi)
## Sistemik Temalar  (asagidaki temalari kok-neden olarak isle, her birine bagli bulgulari grupla)
## Bulgular  (severity sirali; her biri: ### [SEVERITY] baslik / **Dosya:** path:line / **Lens:** / **Sorun:** / **Repro:** / **Onerilen Fix:**)
## Bilesen Bazli Ozet  (her bilesen: kac bulgu, en agir, durum)
## Kapsama Matrisi  (hangi bilesen x lens tarandi/temiz/bulgulu; neyin disinda kaldigi)

SISTEMIK TEMALAR: ${JSON.stringify(themes)}
BULGULAR: ${JSON.stringify(confirmed)}
BILESENLER: ${JSON.stringify(manifest.components.map((c) => ({ name: c.name, type: c.type, files: c.files })))}`,
  { label: 'sentez', phase: 'Sentez', model: 'opus', schema: REPORT_SCHEMA }
);

return {
  components: manifest.components.length,
  candidates: candidates.length,
  scanned: jobs.length,
  findings: confirmed.length,
  bySeverity: confirmed.reduce((a, f) => ((a[f.severity] = (a[f.severity] || 0) + 1), a), {}),
  themes,
  markdown: report.markdown,
};
```

### Onay sonrası ana-loop adımları (ben yaparım)

1. `Workflow({ script })` ile çalıştır.
2. Dönen `markdown`'ı `Write` ile `.context/audit-report.md`'ye yaz.
3. Özet sun: bileşen / aday→sıcak iş kırpması / doğrulanmış bulgu / severity dağılımı / sistemik temalar + rapor yolu.

## Notlar / sınırlar

- **Token kaldıraçları:** triyaj kör çarpımı kırpar (opus yalnız sıcak işe gider); yüzlerce verify oyu + tüm triyaj `haiku`; her agent yalnız kendi dosyalarını görür.
- **Daha derin istersen:** çalıştırırken `+500k` gibi bir token hedefi ver → critic loop o hedefe kadar yeni iş üretir (`MAX_ROUNDS` üstüne budget guard devreye girer).
- Concurrency cap ~14; yüzlerce iş kuyruğa girer, hepsi tamamlanır.
- Worktree yok (salt-okuma denetim).
- `agentType` çözülemezse (özel agent kayıtlı değilse) ilgili scan düşebilir; o durumda `agentTypeFor`'u `code-reviewer`'a sabitle.

## Doğrulama (workflow bittikten sonra)

- `.context/audit-report.md` oluştu mu; severity sıralı bulgular, gerçek `dosya:satır` referansları, sistemik temalar ve kapsama matrisi içeriyor mu?
- Birkaç critical/high bulguyu elle aç: iddia kod kanıtıyla tutuyor mu (false-positive kontrolü)?
- `npm run lint` ve `npm test` baseline'ı bozulmamış (workflow kod değiştirmez).
