(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Themes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── token sözleşmesi ──────────────────────────────────────────────
  // Temaların override edebileceği TÜM CSS custom property anahtarları.
  // styles.css :root bloğundaki tokenlarla birebir aynı olmalı; test bunu
  // doğrular. Bir temada burada olmayan bir anahtar = yazım hatası.
  var KNOWN_TOKENS = [
    '--bg',
    '--surface-1',
    '--surface-2',
    '--surface-3',
    '--border',
    '--border-strong',
    '--border-faint',
    '--fg',
    '--fg-muted',
    '--fg-subtle',
    '--fg-faint',
    '--accent',
    '--accent-fg',
    '--accent-soft',
    '--accent-line',
    '--success',
    '--success-soft',
    '--radius',
    '--radius-sm',
    '--radius-lg',
    '--motion-ms',
    '--ease',
    '--font-sans',
    '--font-mono',
    '--font-display',
    '--shadow-pop',
    '--shadow-popup',
    '--shadow-toast',
    '--shadow-key',
    '--overlay-bg',
    '--overlay-blur',
    '--surface-blur',
    '--texture',
    '--selection-bg',
    '--sidebar-bg',
    '--opt-bg-sel',
    '--progress-glow',
  ];

  // ── registry ──────────────────────────────────────────────────────
  // Lightweight ilke: amoled = base (tokens boş, styles.css :root defaultları).
  // Diğer temalar yalnızca delta (override) taşır. font = Google Fonts query
  // (link href'inin family kısmı) veya null (ekstra font yüklenmez).
  var LIST = [
    {
      id: 'amoled',
      name: 'AMOLED',
      swatch: { bg: '#000000', accent: '#4d8dff' }, // ponytail: match styles.css :root --accent
      font: null,
      tokens: {},
    },
    {
      id: 'paper',
      name: 'Paper',
      swatch: { bg: '#faf8f2', accent: '#b24230' },
      font: 'Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Inter:wght@300;400;500;600',
      tokens: {
        '--bg': '#faf8f2',
        '--surface-1': '#ffffff',
        '--surface-2': '#f4efe4',
        '--surface-3': '#ebe4d5',
        '--border': '#ddd5c4',
        '--border-strong': '#c9bda3',
        '--border-faint': '#ece5d6',
        '--fg': '#1c1a16',
        '--fg-muted': '#4f4a3f',
        '--fg-subtle': '#7c7565',
        '--fg-faint': '#aaa291',
        '--accent': '#b24230',
        '--accent-fg': '#ffffff',
        '--accent-soft': 'rgba(178,66,48,0.10)',
        '--accent-line': 'rgba(178,66,48,0.45)',
        '--success': '#2f7d4f',
        '--success-soft': 'rgba(47,125,79,0.12)',
        '--radius': '4px',
        '--radius-sm': '3px',
        '--radius-lg': '6px',
        '--font-sans': '"Inter", system-ui, -apple-system, sans-serif',
        '--font-display': '"Newsreader", Georgia, "Times New Roman", serif',
        '--shadow-pop': '0 4px 18px -10px rgba(60,45,30,0.35)',
        '--shadow-popup': '0 30px 60px -24px rgba(60,45,30,0.30)',
        '--shadow-toast': '0 16px 40px -16px rgba(60,45,30,0.28)',
        '--shadow-key': 'inset 0 -2px 0 rgba(0,0,0,0.08)',
        '--overlay-bg': 'rgba(50,40,25,0.32)',
        '--overlay-blur': '2px',
        '--texture': 'none',
        '--selection-bg': 'rgba(178,66,48,0.16)',
        '--sidebar-bg': 'var(--surface-1)',
        '--opt-bg-sel': 'linear-gradient(180deg, var(--accent-soft), transparent)',
        '--progress-glow': 'none',
      },
    },
    {
      id: 'phosphor',
      name: 'Phosphor',
      swatch: { bg: '#050805', accent: '#39ff14' },
      font: null,
      tokens: {
        '--bg': '#050805',
        '--surface-1': '#0a0f0a',
        '--surface-2': '#0f160f',
        '--surface-3': '#152015',
        '--border': '#1d2c1d',
        '--border-strong': '#2b452b',
        '--border-faint': '#122012',
        '--fg': '#c8f7c8',
        '--fg-muted': '#6fbf6f',
        '--fg-subtle': '#4a8a4a',
        '--fg-faint': '#2f5a2f',
        '--accent': '#39ff14',
        '--accent-fg': '#041004',
        '--accent-soft': 'rgba(57,255,20,0.12)',
        '--accent-line': 'rgba(57,255,20,0.50)',
        '--success': '#39ff14',
        '--success-soft': 'rgba(57,255,20,0.12)',
        '--radius': '2px',
        '--radius-sm': '2px',
        '--radius-lg': '3px',
        '--font-sans': '"Geist Mono", ui-monospace, "SF Mono", monospace',
        '--font-display': '"Geist Mono", ui-monospace, "SF Mono", monospace',
        '--shadow-pop': '0 0 18px rgba(57,255,20,0.40)',
        '--shadow-popup': '0 0 50px rgba(57,255,20,0.20)',
        '--shadow-toast': '0 0 24px rgba(57,255,20,0.30)',
        '--shadow-key': 'inset 0 -2px 0 rgba(0,0,0,0.60)',
        '--overlay-bg': 'rgba(0,8,0,0.72)',
        '--overlay-blur': '1px',
        '--texture':
          'repeating-linear-gradient(0deg, rgba(57,255,20,0.045) 0px, rgba(57,255,20,0.045) 1px, transparent 1px, transparent 3px)',
        '--selection-bg': 'rgba(57,255,20,0.28)',
        '--sidebar-bg': '#070b07',
        '--opt-bg-sel': 'linear-gradient(180deg, rgba(57,255,20,0.10), transparent)',
        '--progress-glow': '0 0 14px rgba(57,255,20,0.70)',
      },
    },
    {
      id: 'dusk',
      name: 'Dusk',
      swatch: { bg: '#1a1410', accent: '#f0a830' },
      font: 'Inter:wght@300;400;500;600',
      tokens: {
        '--bg': '#1a1410',
        '--surface-1': '#221a14',
        '--surface-2': '#2b211a',
        '--surface-3': '#352920',
        '--border': '#3d2f24',
        '--border-strong': '#503d2e',
        '--border-faint': '#2a201a',
        '--fg': '#f0e6d8',
        '--fg-muted': '#bba98f',
        '--fg-subtle': '#8a7a64',
        '--fg-faint': '#5c4f40',
        '--accent': '#f0a830',
        '--accent-fg': '#1a1208',
        '--accent-soft': 'rgba(240,168,48,0.14)',
        '--accent-line': 'rgba(240,168,48,0.50)',
        '--success': '#9fc46a',
        '--success-soft': 'rgba(159,196,106,0.14)',
        '--radius': '13px',
        '--radius-sm': '9px',
        '--radius-lg': '19px',
        '--font-sans': '"Inter", system-ui, -apple-system, sans-serif',
        '--font-display': '"Inter", system-ui, -apple-system, sans-serif',
        '--shadow-pop': '0 10px 34px -14px rgba(0,0,0,0.70)',
        '--shadow-popup': '0 40px 80px -24px rgba(0,0,0,0.80)',
        '--shadow-toast': '0 20px 50px -16px rgba(0,0,0,0.70)',
        '--shadow-key': 'inset 0 -2px 0 rgba(0,0,0,0.40)',
        '--overlay-bg': 'rgba(10,6,2,0.66)',
        '--overlay-blur': '3px',
        '--texture': 'radial-gradient(circle at 78% 12%, rgba(240,168,48,0.07), transparent 42%)',
        '--selection-bg': 'rgba(240,168,48,0.18)',
        '--sidebar-bg': 'linear-gradient(180deg, var(--surface-1), var(--bg) 65%)',
        '--opt-bg-sel': 'linear-gradient(180deg, var(--accent-soft), transparent)',
        '--progress-glow': '0 0 14px var(--accent-line)',
      },
    },
    {
      id: 'aurora',
      name: 'Aurora',
      swatch: { bg: '#0a0a1f', accent: '#8b5cf6' }, // ponytail: match aurora --bg token
      font: 'Space+Grotesk:wght@400;500;600;700',
      tokens: {
        '--bg': '#0a0a1f',
        '--surface-1': 'rgba(36,34,66,0.50)',
        '--surface-2': 'rgba(48,46,86,0.60)',
        '--surface-3': 'rgba(62,60,108,0.65)',
        '--border': 'rgba(255,255,255,0.09)',
        '--border-strong': 'rgba(255,255,255,0.18)',
        '--border-faint': 'rgba(255,255,255,0.05)',
        '--fg': '#eef0ff',
        '--fg-muted': '#bcc0ea',
        '--fg-subtle': '#8a8ec4',
        '--fg-faint': '#5a5e92',
        '--accent': '#8b5cf6',
        '--accent-fg': '#ffffff',
        '--accent-soft': 'rgba(139,92,246,0.20)',
        '--accent-line': 'rgba(139,92,246,0.60)',
        '--success': '#2dd4bf',
        '--success-soft': 'rgba(45,212,191,0.16)',
        '--radius': '16px',
        '--radius-sm': '11px',
        '--radius-lg': '22px',
        '--font-sans': '"Space Grotesk", system-ui, -apple-system, sans-serif',
        '--font-display': '"Space Grotesk", system-ui, -apple-system, sans-serif',
        '--shadow-pop': '0 8px 40px -8px rgba(139,92,246,0.55)',
        '--shadow-popup': '0 40px 100px -20px rgba(10,8,40,0.85)',
        '--shadow-toast': '0 20px 60px -16px rgba(139,92,246,0.35)',
        '--shadow-key': 'inset 0 -2px 0 rgba(0,0,0,0.25)',
        '--surface-blur': 'blur(14px) saturate(1.4)',
        '--overlay-bg': 'rgba(8,6,25,0.60)',
        '--overlay-blur': '6px',
        '--texture':
          'radial-gradient(circle at 18% 8%, rgba(139,92,246,0.22), transparent 40%), radial-gradient(circle at 84% 82%, rgba(45,212,191,0.16), transparent 44%)',
        '--selection-bg': 'rgba(139,92,246,0.30)',
        '--sidebar-bg': 'linear-gradient(180deg, rgba(28,24,60,0.55), rgba(10,10,31,0.30) 70%)',
        '--opt-bg-sel': 'linear-gradient(180deg, rgba(139,92,246,0.22), transparent)',
        '--progress-glow': '0 0 16px rgba(139,92,246,0.70)',
      },
    },
  ];

  var DEFAULT_ID = 'amoled';
  var STORAGE_KEY = 'askuserquestionspro_theme';

  var BY_ID = {};
  LIST.forEach(function (t) {
    BY_ID[t.id] = t;
  });

  // apply() reset anahtar kümesi. Her tema-override'ının birleşimi YETMEZ:
  // hiçbir tema set etmediği bir KNOWN_TOKEN (örn. --motion-ms/--ease/--font-mono)
  // birleşim dışında kalırsa apply() onu temizleyemez → bir önceki temadan kaçak
  // inline değer kalır. Bu yüzden KNOWN_TOKENS'ı da içer → USED_KEYS ⊇ KNOWN_TOKENS.
  var USED_KEYS = (function () {
    var set = {};
    KNOWN_TOKENS.forEach(function (k) {
      set[k] = true;
    });
    LIST.forEach(function (t) {
      Object.keys(t.tokens).forEach(function (k) {
        set[k] = true;
      });
    });
    return Object.keys(set);
  })();

  function get(id) {
    return BY_ID[id] || BY_ID[DEFAULT_ID];
  }

  function read() {
    // 0) Server'ın inject ettiği disk ayarı — en yüksek öncelik (kalıcı, makine-bazlı).
    try {
      if (
        typeof window !== 'undefined' &&
        window.__ASKUSER_SETTINGS__ &&
        BY_ID[window.__ASKUSER_SETTINGS__.theme]
      )
        return window.__ASKUSER_SETTINGS__.theme;
    } catch (e) {
      /* yok say */
    }
    // 1) ?theme=<id> başlangıç override'ı (paylaşılabilir link / test) — picker'ı
    //    kaldırmaz, seçim yine kalıcı ve değiştirilebilir kalır.
    try {
      if (typeof location !== 'undefined' && location.search) {
        var m = /[?&]theme=([^&]+)/.exec(location.search);
        if (m && BY_ID[decodeURIComponent(m[1])]) return decodeURIComponent(m[1]);
      }
    } catch (e) {
      /* yok say */
    }
    // 2) localStorage'taki son seçim
    try {
      var id = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
      return BY_ID[id] ? id : DEFAULT_ID;
    } catch (e) {
      return DEFAULT_ID;
    }
  }

  var currentId = DEFAULT_ID;
  function current() {
    return currentId;
  }

  // Google Fonts <link>'ini tema fontuna göre enjekte/değiştir/kaldır.
  function swapFont(font) {
    if (typeof document === 'undefined') return;
    if (!document.head) return; // ponytail: null-guard for frameless/test envs
    var id = 'askuserquestionspro-theme-font';
    var link = document.getElementById(id);
    if (!font) {
      if (link) link.remove();
      return;
    }
    var href = 'https://fonts.googleapis.com/css2?family=' + font + '&display=swap';
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }

  // Temayı uygula: önce tüm override'ları sil (→ :root amoled defaultu), sonra
  // seçili temanın delta'sını yaz. Persist + font swap.
  function apply(id) {
    var theme = get(id);
    currentId = theme.id;
    if (typeof document !== 'undefined') {
      var root = document.documentElement;
      USED_KEYS.forEach(function (k) {
        root.style.removeProperty(k);
      });
      Object.keys(theme.tokens).forEach(function (k) {
        root.style.setProperty(k, theme.tokens[k]);
      });
      swapFont(theme.font);
      root.setAttribute('data-theme', theme.id);
    }
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme.id);
    } catch (e) {
      /* yok say */
    }
    return theme.id;
  }

  // Tarayıcıda: kayıtlı temayı render'dan önce uygula (flaş yok).
  if (typeof document !== 'undefined') apply(read());

  return {
    list: LIST,
    apply: apply,
    current: current,
    get: get,
    read: read, // exported for testability
    DEFAULT_ID: DEFAULT_ID,
    KNOWN_TOKENS: KNOWN_TOKENS,
    STORAGE_KEY: STORAGE_KEY,
    _USED_KEYS: USED_KEYS, // exported for USED_KEYS⊇KNOWN_TOKENS drift test
  };
});
