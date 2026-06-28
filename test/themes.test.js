const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Themes = require('../web/themes.js');

const KNOWN = new Set(Themes.KNOWN_TOKENS);

// styles.css :root bloğundaki CSS custom property anahtarlarını çıkar.
function rootTokens() {
  const css = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');
  // Kapanışı satır-başı '}'a sabitle: :root içinde nested brace yok varsayımı
  // (varsa non-greedy ilk '}'da kesilip token kaçırmasın diye anchor güvenli).
  const block = /:root\s*\{([\s\S]*?)^}/m.exec(css);
  assert.ok(block, 'styles.css içinde :root bloğu bulunmalı');
  return [...block[1].matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]);
}

test('5 tema var, hepsi benzersiz id', () => {
  assert.strictEqual(Themes.list.length, 5);
  const ids = Themes.list.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, 5);
});

test('DEFAULT_ID amoled ve listenin ilk teması', () => {
  assert.strictEqual(Themes.DEFAULT_ID, 'amoled');
  assert.strictEqual(Themes.list[0].id, 'amoled');
});

test('amoled base sözleşmesi: tokens boş (styles.css :root defaultları)', () => {
  assert.deepStrictEqual(Themes.get('amoled').tokens, {});
});

test('her temada name + swatch.bg + swatch.accent var', () => {
  for (const t of Themes.list) {
    assert.ok(typeof t.name === 'string' && t.name.length, `${t.id} name`);
    assert.match(t.swatch.bg, /^#|rgb/, `${t.id} swatch.bg`);
    assert.match(t.swatch.accent, /^#|rgb/, `${t.id} swatch.accent`);
  }
});

test('tema token anahtarları bilinen sözleşmenin alt kümesi (kaçak anahtar yok)', () => {
  for (const t of Themes.list) {
    for (const key of Object.keys(t.tokens)) {
      assert.ok(KNOWN.has(key), `${t.id} bilinmeyen token: ${key}`);
    }
  }
});

test('non-base temalar çekirdek renkleri override eder (gerçekten farklı)', () => {
  for (const t of Themes.list) {
    if (t.id === Themes.DEFAULT_ID) continue;
    for (const key of ['--bg', '--accent', '--fg']) {
      assert.ok(key in t.tokens, `${t.id} ${key} override etmeli`);
    }
  }
});

test('font alanı yoksa null, varsa boş olmayan string', () => {
  for (const t of Themes.list) {
    assert.ok(t.font === null || (typeof t.font === 'string' && t.font.length), `${t.id} font`);
  }
});

test('get bilinmeyen id için default döndürür', () => {
  assert.strictEqual(Themes.get('yok-böyle-tema').id, 'amoled');
});

test('apply node ortamında (document yok) çökmeden id döndürür', () => {
  assert.strictEqual(Themes.apply('phosphor'), 'phosphor');
  assert.strictEqual(Themes.current(), 'phosphor');
  assert.strictEqual(Themes.apply('yok'), 'amoled');
});

// B18: styles.css :root defaultları ↔ KNOWN_TOKENS sözleşmesi senkron.
// :root'taki her token KNOWN_TOKENS'ta olmalı (kaçak default yok), ve
// KNOWN_TOKENS'taki her anahtarın bir :root defaultu olmalı (eksik default yok).
test('styles.css :root tokenları KNOWN_TOKENS sözleşmesiyle birebir eşleşir', () => {
  const root = rootTokens();
  assert.ok(root.length > 0, ':root en az bir token içermeli');

  // benzersizlik — aynı token iki kez tanımlanmamalı
  assert.strictEqual(new Set(root).size, root.length, ':root tokenları benzersiz olmalı');

  const rootSet = new Set(root);

  const extraInCss = root.filter((t) => !KNOWN.has(t));
  assert.deepStrictEqual(
    extraInCss,
    [],
    `styles.css :root'ta sözleşme dışı token: ${extraInCss.join(', ')}`
  );

  const missingInCss = Themes.KNOWN_TOKENS.filter((t) => !rootSet.has(t));
  assert.deepStrictEqual(
    missingInCss,
    [],
    `KNOWN_TOKENS'ta olup :root defaultu olmayan: ${missingInCss.join(', ')}`
  );

  // bidirectional eşitlik → aynı boyut
  assert.strictEqual(rootSet.size, KNOWN.size);
});

// ── Regression: swatch renk doğruluğu ────────────────────────────────────────
// Picker'ın gösterdiği renk gerçek uygulanan tokenla eşleşmeli.

test('amoled swatch.accent styles.css :root --accent ile eşleşir', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'web', 'styles.css'), 'utf8');
  const block = /:root\s*\{([\s\S]*?)^}/m.exec(css);
  assert.ok(block, 'styles.css içinde :root bloğu bulunmalı');
  const m = /--accent\s*:\s*([^;]+);/.exec(block[1]);
  assert.ok(m, ':root içinde --accent tanımı bulunmalı');
  const cssAccent = m[1].trim();
  const amoled = Themes.get('amoled');
  assert.strictEqual(
    amoled.swatch.accent,
    cssAccent,
    `amoled swatch.accent (${amoled.swatch.accent}) styles.css --accent (${cssAccent}) ile uyuşmuyor`
  );
});

test('aurora swatch.bg aurora --bg token değeriyle eşleşir', () => {
  const aurora = Themes.get('aurora');
  assert.strictEqual(
    aurora.swatch.bg,
    aurora.tokens['--bg'],
    `aurora swatch.bg (${aurora.swatch.bg}) --bg token (${aurora.tokens['--bg']}) ile uyuşmuyor`
  );
});

// ── Regression: USED_KEYS ⊇ KNOWN_TOKENS drift ───────────────────────────────
// apply() yalnızca USED_KEYS'i sıfırlar; eğer KNOWN_TOKENS'taki bir token
// hiçbir tema tarafından set edilmiyorsa USED_KEYS dışında kalır → apply() o
// tokenu temizleyemez. USED_KEYS en az KNOWN_TOKENS'un süperkümesi olmalı.

test("USED_KEYS en az KNOWN_TOKENS'ın tüm elemanlarını içerir (sıfırlama güvencesi)", () => {
  const usedSet = new Set(Themes._USED_KEYS);
  const missing = Themes.KNOWN_TOKENS.filter((k) => !usedSet.has(k));
  // M-47 fix: USED_KEYS artık KNOWN_TOKENS'ı da içeriyor (birleşim değil, süperküme).
  // Hiçbir tema set etmese bile --motion-ms/--ease/--font-mono gibi tokenlar
  // apply()'ın removeProperty döngüsünde temizlenir → tema geçişinde kaçak inline
  // değer kalmaz. Bu yüzden eksik küme BOŞ olmalı.
  assert.deepStrictEqual(
    missing,
    [],
    `USED_KEYS, KNOWN_TOKENS'ın süperkümesi olmalı. Eksik: ${missing.join(', ')}`
  );
});

test('apply() hiçbir temanın set etmediği KNOWN_TOKEN inline değerini de temizler (M-47)', () => {
  // --motion-ms hiçbir tema tarafından override edilmiyor; yine de apply() onu
  // root.style'dan silmeli (önceki sayfa/test tarafından bırakılmış olabilir).
  const props = { '--motion-ms': '999ms', '--ease': 'linear', '--font-mono': 'Foo' };
  const mockRoot = {
    style: {
      removeProperty: (k) => {
        delete props[k];
      },
      setProperty: (k, v) => {
        props[k] = v;
      },
    },
    setAttribute: () => {},
  };
  const mockDoc = {
    head: { appendChild: () => {} },
    getElementById: () => null,
    createElement: () => ({
      rel: '',
      id: '',
      setAttribute() {},
      getAttribute: () => null,
      remove() {},
    }),
    documentElement: mockRoot,
  };
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prev = g.document;
  g.document = mockDoc;
  try {
    Themes.apply('paper');
    assert.ok(!('--motion-ms' in props), 'apply() --motion-ms inline değerini temizlemeli');
    assert.ok(!('--ease' in props), 'apply() --ease inline değerini temizlemeli');
    assert.ok(!('--font-mono' in props), 'apply() --font-mono inline değerini temizlemeli');
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
});

// ── Regression: swapFont — null-head guard ───────────────────────────────────

test('swapFont document.head null ise TypeError atmaz', () => {
  // Node ortamında document undefined — apply() guard'ı zaten koruyor.
  // Burada head===null senaryosunu minimal mock ile test ediyoruz.
  const props = {};
  const mockRoot = {
    style: {
      removeProperty: (k) => {
        delete props[k];
      },
      setProperty: (k, v) => {
        props[k] = v;
      },
    },
    setAttribute: () => {},
  };
  const mockDoc = {
    head: null, // ← test hedefi
    getElementById: () => null,
    createElement: () => ({
      rel: '',
      id: '',
      setAttribute() {},
      getAttribute: () => null,
      remove() {},
    }),
    documentElement: mockRoot,
  };
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prev = g.document;
  g.document = mockDoc;
  try {
    // apply() → swapFont(font) → !document.head → return (TypeError olmamalı)
    assert.doesNotThrow(() => Themes.apply('paper'));
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
});

// ── Regression: swapFont idempotency ve null-font geçişi ─────────────────────

test("swapFont mock DOM: aynı font href'i iki kez set etmez (idempotency)", () => {
  let setCount = 0;
  let currentHref = null;
  const mockLink = {
    rel: '',
    id: '',
    getAttribute: (a) => (a === 'href' ? currentHref : null),
    setAttribute: (a, v) => {
      if (a === 'href') {
        setCount++;
        currentHref = v;
      }
    },
    remove: () => {},
  };
  const props = {};
  const mockRoot = {
    style: {
      removeProperty: (k) => {
        delete props[k];
      },
      setProperty: (k, v) => {
        props[k] = v;
      },
    },
    setAttribute: () => {},
  };
  const mockDoc = {
    head: { appendChild: () => {} },
    getElementById: (id) => (id === 'askuserquestionspro-theme-font' ? mockLink : null),
    createElement: () => mockLink,
    documentElement: mockRoot,
  };
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prev = g.document;
  g.document = mockDoc;
  try {
    // İlk apply: paper teması (font var) → link oluşturulur, href set edilir
    Themes.apply('paper');
    const firstCount = setCount;
    assert.ok(firstCount >= 1, 'İlk apply sonrası href set edilmeli');
    const hrefAfterFirst = currentHref;

    // İkinci apply: aynı tema → href aynıysa set çağrılmamalı
    Themes.apply('paper');
    // Aynı href ise setAttribute çağrılmamalı
    assert.strictEqual(
      setCount,
      firstCount,
      'Aynı font için setAttribute tekrar çağrılmamalı (idempotent)'
    );
    assert.strictEqual(currentHref, hrefAfterFirst, 'href değişmemeli');
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
});

test('swapFont mock DOM: font null olan temaya geçişte link kaldırılır', () => {
  let removed = false;
  let currentHref =
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap';
  const mockLink = {
    rel: '',
    id: '',
    getAttribute: (a) => (a === 'href' ? currentHref : null),
    setAttribute: (a, v) => {
      if (a === 'href') currentHref = v;
    },
    remove: () => {
      removed = true;
    },
  };
  const props = {};
  const mockRoot = {
    style: {
      removeProperty: (k) => {
        delete props[k];
      },
      setProperty: (k, v) => {
        props[k] = v;
      },
    },
    setAttribute: () => {},
  };
  const mockDoc = {
    head: { appendChild: () => {} },
    getElementById: (id) => (id === 'askuserquestionspro-theme-font' ? mockLink : null),
    createElement: () => mockLink,
    documentElement: mockRoot,
  };
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prev = g.document;
  g.document = mockDoc;
  try {
    // amoled teması font=null → link.remove() çağrılmalı
    Themes.apply('amoled');
    assert.ok(removed, 'font=null olan temaya geçişte link.remove() çağrılmalı');
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
});

// ── Regression: aurora→paper geçişinde --surface-blur temizlenir ─────────────

test('apply aurora→paper: --surface-blur inline style temizlenir', () => {
  // jsdom olmadan minimal style mock
  const props = {};
  const mockRoot = {
    style: {
      removeProperty: (k) => {
        delete props[k];
      },
      setProperty: (k, v) => {
        props[k] = v;
      },
    },
    setAttribute: () => {},
  };
  const mockDoc = {
    head: { appendChild: () => {} },
    getElementById: () => null,
    createElement: () => ({
      rel: '',
      id: '',
      setAttribute() {},
      getAttribute: () => null,
      remove() {},
    }),
    documentElement: mockRoot,
  };
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prev = g.document;
  g.document = mockDoc;
  try {
    Themes.apply('aurora');
    assert.ok('--surface-blur' in props, 'aurora apply sonrası --surface-blur set edilmeli');
    assert.ok(props['--surface-blur'].includes('blur'), '--surface-blur değeri blur içermeli');

    Themes.apply('paper');
    assert.ok(
      !('--surface-blur' in props),
      'paper apply sonrası --surface-blur inline style temizlenmeli (USED_KEYS reset)'
    );
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
});

// ── Regression: read() cascade dalları ───────────────────────────────────────

test('read(): window.__ASKUSER_SETTINGS__.theme geçerli id ise onu döndürür', () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prevWin = g.window;
  g.window = { __ASKUSER_SETTINGS__: { theme: 'dusk' } };
  try {
    assert.strictEqual(Themes.read(), 'dusk');
  } finally {
    if (prevWin === undefined) delete g.window;
    else g.window = prevWin;
  }
});

test('read(): window.__ASKUSER_SETTINGS__.theme bilinmeyen id ise sonraki dala düşer', () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prevWin = g.window;
  // Geçersiz tema id → BY_ID'de yok → false → location/localStorage dalına geç
  g.window = { __ASKUSER_SETTINGS__: { theme: 'nonexistent' } };
  // localStorage da yokken DEFAULT_ID beklenir
  const prevLS = g.localStorage;
  g.localStorage = { getItem: () => null };
  const prevLoc = g.location;
  g.location = { search: '' };
  try {
    assert.strictEqual(Themes.read(), Themes.DEFAULT_ID);
  } finally {
    if (prevWin === undefined) delete g.window;
    else g.window = prevWin;
    if (prevLS === undefined) delete g.localStorage;
    else g.localStorage = prevLS;
    if (prevLoc === undefined) delete g.location;
    else g.location = prevLoc;
  }
});

test('read(): ?theme= URL param geçerli id ise onu döndürür', () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prevWin = g.window;
  // window yokken sadece location mock'la
  delete g.window;
  const prevLoc = g.location;
  g.location = { search: '?theme=phosphor' };
  try {
    assert.strictEqual(Themes.read(), 'phosphor');
  } finally {
    if (prevWin !== undefined) g.window = prevWin;
    if (prevLoc === undefined) delete g.location;
    else g.location = prevLoc;
  }
});

test('read(): ?theme= bilinmeyen id ise localStorage dalına düşer', () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prevWin = g.window;
  delete g.window;
  const prevLoc = g.location;
  g.location = { search: '?theme=unknown-id' };
  const prevLS = g.localStorage;
  g.localStorage = { getItem: () => 'aurora' };
  try {
    assert.strictEqual(Themes.read(), 'aurora');
  } finally {
    if (prevWin !== undefined) g.window = prevWin;
    if (prevLoc === undefined) delete g.location;
    else g.location = prevLoc;
    if (prevLS === undefined) delete g.localStorage;
    else g.localStorage = prevLS;
  }
});

test('read(): localStorage.getItem throw ederse DEFAULT_ID döner (Safari private mode)', () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  const prevWin = g.window;
  delete g.window;
  const prevLoc = g.location;
  g.location = { search: '' };
  const prevLS = g.localStorage;
  g.localStorage = {
    getItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  try {
    assert.strictEqual(Themes.read(), Themes.DEFAULT_ID);
  } finally {
    if (prevWin !== undefined) g.window = prevWin;
    if (prevLoc === undefined) delete g.location;
    else g.location = prevLoc;
    if (prevLS === undefined) delete g.localStorage;
    else g.localStorage = prevLS;
  }
});

test('read(): Node ortamında (window/location/localStorage yok) DEFAULT_ID döner', () => {
  const g = typeof globalThis !== 'undefined' ? globalThis : global;
  // Node test ortamında bunlar zaten undefined; sadece varsa geçici sil
  const prevWin = g.window;
  const prevLoc = g.location;
  const prevLS = g.localStorage;
  delete g.window;
  delete g.location;
  delete g.localStorage;
  try {
    assert.strictEqual(Themes.read(), Themes.DEFAULT_ID);
  } finally {
    if (prevWin !== undefined) g.window = prevWin;
    if (prevLoc !== undefined) g.location = prevLoc;
    if (prevLS !== undefined) g.localStorage = prevLS;
  }
});

// ── Regression: token CSS değer sözdizimi doğrulaması ────────────────────────
// rgba/hex/px değerleri pattern'e uymalı; yazım hatası sessizce geçmemeli.

test('renk tokenları geçerli CSS renk sözdiziminde (hex veya rgba/rgb)', () => {
  const colorTokens = [
    '--bg',
    '--surface-1',
    '--surface-2',
    '--surface-3',
    '--fg',
    '--fg-muted',
    '--fg-subtle',
    '--fg-faint',
    '--accent',
    '--accent-fg',
    '--success',
    '--selection-bg',
  ];
  // Kabul: #rrggbb, #rgb, rgba(...), rgb(...), var(...) referansı
  const validColor = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|var\(--.+\))$/;

  for (const t of Themes.list) {
    if (t.id === 'amoled') continue; // tokens boş
    for (const key of colorTokens) {
      if (!(key in t.tokens)) continue;
      const val = t.tokens[key].trim();
      assert.ok(validColor.test(val), `${t.id} ${key}: geçersiz CSS renk sözdizimi: "${val}"`);
    }
  }
});

test('boyut tokenları geçerli px değeri (rakam+px)', () => {
  const sizeTokens = ['--radius', '--radius-sm', '--radius-lg', '--overlay-blur'];
  const validPx = /^\d+(\.\d+)?px$/;

  for (const t of Themes.list) {
    if (t.id === 'amoled') continue;
    for (const key of sizeTokens) {
      if (!(key in t.tokens)) continue;
      const val = t.tokens[key].trim();
      assert.ok(validPx.test(val), `${t.id} ${key}: geçersiz px değeri: "${val}"`);
    }
  }
});
