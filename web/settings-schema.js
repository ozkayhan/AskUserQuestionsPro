(function (root, factory) {
  if (typeof module === 'object' && module.exports)
    module.exports = factory(require('./themes.js'));
  else root.Settings_Schema = factory(root.Themes);
})(typeof self !== 'undefined' ? self : this, function (Themes) {
  'use strict';

  // accentColor preset renkleri — tema token'larından bağımsız sabit palet.
  var ACCENT_PRESETS = {
    blue: { accent: '#4d8dff', soft: 'rgba(77,141,255,0.14)', line: 'rgba(77,141,255,0.50)' },
    green: { accent: '#22c55e', soft: 'rgba(34,197,94,0.14)', line: 'rgba(34,197,94,0.50)' },
    purple: { accent: '#8b5cf6', soft: 'rgba(139,92,246,0.14)', line: 'rgba(139,92,246,0.50)' },
    orange: { accent: '#f0a830', soft: 'rgba(240,168,48,0.14)', line: 'rgba(240,168,48,0.50)' },
    red: { accent: '#ef4444', soft: 'rgba(239,68,68,0.14)', line: 'rgba(239,68,68,0.50)' },
    pink: { accent: '#ec4899', soft: 'rgba(236,72,153,0.14)', line: 'rgba(236,72,153,0.50)' },
  };

  // Tema token-override entry'leri: Themes.apply() USED_KEYS'i silip tema token'larını
  // yeniden yazdığından, canlı tema değişince bu entry'lerin inline override'ı kaybolur.
  // theme apply()'ı Themes.apply(v)'den SONRA bunu çağırır → override tema base'inin üstüne
  // yeniden yazılır. Loop yok: override entry'leri Themes.apply çağırmaz.
  // ponytail: reapply persisted settings okur; kaydedilmemiş draft override + canlı tema
  // değişimi aynı oturumda override'ı bir an sıfırlayabilir, ayara tekrar dokununca düzelir.
  var TOKEN_OVERRIDE_KEYS = ['accentColor', 'cornerRadius', 'motionSpeed', 'fontFamily'];
  function reapplyTokenOverrides() {
    if (typeof window === 'undefined' || !window.__ASKUSER_SETTINGS__) return;
    var v = window.__ASKUSER_SETTINGS__;
    TOKEN_OVERRIDE_KEYS.forEach(function (key) {
      var e = BY_KEY[key];
      if (e && key in v) e.apply(v[key]);
    });
  }

  // ── şema: tek kaynak ──────────────────────────────────────────────
  // Her girdi: key, label, group, type (select|toggle), default, (+ options),
  // applies ('live'|'reload'), apply(v) — apply YALNIZCA tarayıcıda çağrılır.
  var ENTRIES = [
    {
      key: 'theme',
      label: 'Theme',
      group: 'Appearance',
      type: 'select',
      default: Themes.DEFAULT_ID,
      options: Themes.list.map(function (t) {
        return { value: t.id, label: t.name };
      }),
      applies: 'live',
      apply: function (v) {
        Themes.apply(v);
        reapplyTokenOverrides();
      },
    },
    {
      key: 'accentColor',
      label: 'Accent color',
      group: 'Appearance',
      type: 'select',
      default: 'theme',
      options: [
        { value: 'theme', label: 'Theme default' },
        { value: 'blue', label: 'Blue' },
        { value: 'green', label: 'Green' },
        { value: 'purple', label: 'Purple' },
        { value: 'orange', label: 'Orange' },
        { value: 'red', label: 'Red' },
        { value: 'pink', label: 'Pink' },
      ],
      applies: 'live',
      apply: function (v) {
        if (typeof document === 'undefined') return;
        var root = document.documentElement;
        var preset = ACCENT_PRESETS[v];
        if (!preset) {
          root.style.removeProperty('--accent');
          root.style.removeProperty('--accent-soft');
          root.style.removeProperty('--accent-line');
          return;
        }
        root.style.setProperty('--accent', preset.accent);
        root.style.setProperty('--accent-soft', preset.soft);
        root.style.setProperty('--accent-line', preset.line);
      },
    },
    {
      key: 'cornerRadius',
      label: 'Corner radius',
      group: 'Appearance',
      type: 'select',
      default: 'default',
      options: [
        { value: 'sharp', label: 'Sharp' },
        { value: 'default', label: 'Default' },
        { value: 'rounded', label: 'Rounded' },
      ],
      applies: 'live',
      apply: function (v) {
        if (typeof document === 'undefined') return;
        var root = document.documentElement;
        if (v === 'default') {
          root.style.removeProperty('--radius');
          root.style.removeProperty('--radius-sm');
          root.style.removeProperty('--radius-lg');
          return;
        }
        var px = v === 'sharp' ? { r: '0px', sm: '0px', lg: '0px' } : { r: '16px', sm: '12px', lg: '20px' };
        root.style.setProperty('--radius', px.r);
        root.style.setProperty('--radius-sm', px.sm);
        root.style.setProperty('--radius-lg', px.lg);
      },
    },
    {
      key: 'motionSpeed',
      label: 'Motion speed',
      group: 'Appearance',
      type: 'select',
      default: 'normal',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'slow', label: 'Slow' },
        { value: 'normal', label: 'Normal' },
        { value: 'fast', label: 'Fast' },
      ],
      applies: 'live',
      apply: function (v) {
        if (typeof document === 'undefined') return;
        var root = document.documentElement;
        if (v === 'normal') {
          root.style.removeProperty('--motion-ms');
          return;
        }
        var ms = { off: '0ms', slow: '600ms', fast: '180ms' }[v];
        root.style.setProperty('--motion-ms', ms);
      },
    },
    {
      key: 'fontFamily',
      label: 'Font',
      group: 'Appearance',
      type: 'select',
      default: 'system',
      options: [
        { value: 'system', label: 'System (Geist)' },
        { value: 'serif', label: 'Serif' },
        { value: 'mono', label: 'Monospace' },
      ],
      applies: 'live',
      apply: function (v) {
        if (typeof document === 'undefined' || !document.head) return;
        var root = document.documentElement;
        var id = 'askuserquestionspro-setting-font';
        var link = document.getElementById(id);
        if (v === 'serif') {
          if (!link) {
            link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
          }
          link.setAttribute(
            'href',
            'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap'
          );
          root.style.setProperty(
            '--font-sans',
            '"Newsreader", ui-serif, Georgia, serif'
          );
        } else {
          if (link) link.remove();
          if (v === 'mono') root.style.setProperty('--font-sans', 'var(--font-mono)');
          else root.style.removeProperty('--font-sans'); // system: Geist stays theme/root default
        }
      },
    },
    {
      key: 'uiScale',
      label: 'Interface scale',
      group: 'Appearance',
      type: 'select',
      default: 'md',
      options: [
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Medium' },
        { value: 'lg', label: 'Large' },
      ],
      applies: 'live',
      apply: function (v) {
        // ponytail: CSS px+clamp(vw) tabanlı; en sade güvenilir ölçek = html zoom.
        // Tavan: Firefox <126 zoom yok sayar (layout bozulmaz, ölçek uygulanmaz).
        document.documentElement.style.zoom = { sm: 0.9, md: 1, lg: 1.12 }[v] || 1;
      },
    },
    {
      key: 'highContrast',
      label: 'High contrast',
      group: 'Appearance',
      type: 'toggle',
      default: false,
      applies: 'live',
      apply: function (v) {
        if (typeof document === 'undefined') return;
        document.documentElement.setAttribute('data-high-contrast', v ? 'true' : 'false');
      },
    },
    {
      key: 'reduceMotion',
      label: 'Reduce motion',
      group: 'Appearance',
      type: 'toggle',
      default: false,
      applies: 'reload',
      apply: function (v) {
        document.documentElement.setAttribute('data-reduce-motion', v ? 'true' : 'false');
      },
    },
    {
      key: 'qtypeBinary',
      label: 'Binary (yes/no)',
      group: 'Question types',
      type: 'toggle',
      default: true,
      applies: 'reload',
      apply: function () {},
    },
    {
      key: 'qtypeScale',
      label: 'Scale',
      group: 'Question types',
      type: 'toggle',
      default: true,
      applies: 'reload',
      apply: function () {},
    },
    {
      key: 'qtypeRanking',
      label: 'Ranking',
      group: 'Question types',
      type: 'toggle',
      default: true,
      applies: 'reload',
      apply: function () {},
    },
    {
      key: 'qtypeTree',
      label: 'Decision tree',
      group: 'Question types',
      type: 'toggle',
      default: true,
      applies: 'reload',
      apply: function () {},
    },
    {
      key: 'autoAdvance',
      label: 'Auto-advance single-select',
      group: 'Behavior',
      type: 'toggle',
      default: false,
      applies: 'reload',
      apply: function () {},
    },
    {
      key: 'confirmSubmit',
      label: 'Confirm before submit',
      group: 'Behavior',
      type: 'toggle',
      default: false,
      applies: 'live',
      apply: function () {},
    },
    {
      key: 'showKeyHints',
      label: 'Show keyboard hints',
      group: 'Interface',
      type: 'toggle',
      default: true,
      applies: 'live',
      apply: function (v) {
        if (typeof document === 'undefined') return;
        document.documentElement.setAttribute('data-hide-hints', v ? 'false' : 'true');
      },
    },
  ];

  var BY_KEY = {};
  ENTRIES.forEach(function (e) {
    BY_KEY[e.key] = e;
  });

  function entries() {
    return ENTRIES;
  }
  function byKey(key) {
    return BY_KEY[key];
  }

  function defaults() {
    var o = {};
    ENTRIES.forEach(function (e) {
      o[e.key] = e.default;
    });
    return o;
  }

  function groups() {
    var seen = {},
      out = [];
    ENTRIES.forEach(function (e) {
      if (!seen[e.group]) {
        seen[e.group] = true;
        out.push(e.group);
      }
    });
    return out;
  }

  // self-healing: her key için tip/aralık doğrula; geçersiz/bilinmeyen → default,
  // bilinmeyen key at, eksik default'la doldur. Asla throw etmez.
  function validate(obj) {
    var src = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
    var out = {};
    ENTRIES.forEach(function (e) {
      var v = src[e.key];
      if (e.type === 'toggle') {
        out[e.key] = typeof v === 'boolean' ? v : e.default;
      } else {
        // select
        var ok = e.options.some(function (o) {
          return o.value === v;
        });
        out[e.key] = ok ? v : e.default;
      }
    });
    return out;
  }

  // CLI string'ini girdinin tipine zorla. → { ok, value } | { ok:false }.
  function coerce(key, str) {
    var e = BY_KEY[key];
    if (!e) return { ok: false };
    if (e.type === 'toggle') {
      var s = String(str).toLowerCase();
      if (s === 'on' || s === 'true' || s === '1' || s === 'yes') return { ok: true, value: true };
      if (s === 'off' || s === 'false' || s === '0' || s === 'no')
        return { ok: true, value: false };
      return { ok: false };
    }
    // select
    return e.options.some(function (o) {
      return o.value === str;
    })
      ? { ok: true, value: str }
      : { ok: false };
  }

  // tarayıcıda her apply'ı çağır (sayfa yüklenince + Kaydet'te).
  function applyAll(values) {
    var v = validate(values);
    ENTRIES.forEach(function (e) {
      try {
        e.apply(v[e.key]);
      } catch (err) {
        // ponytail: surface apply errors in browser devtools; node/headless stays silent.
        if (typeof document !== 'undefined')
          console.warn('[settings] apply failed for', e.key, err);
      }
    });
  }

  return {
    entries: entries,
    byKey: byKey,
    defaults: defaults,
    groups: groups,
    validate: validate,
    coerce: coerce,
    applyAll: applyAll,
  };
});
