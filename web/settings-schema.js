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
        var px =
          v === 'sharp'
            ? { r: '0px', sm: '0px', lg: '0px' }
            : { r: '16px', sm: '12px', lg: '20px' };
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
          root.style.setProperty('--font-sans', '"Newsreader", ui-serif, Georgia, serif');
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
    {
      key: 'showCounter',
      label: 'Show answered counter',
      group: 'Interface',
      type: 'toggle',
      default: true,
      applies: 'live',
      apply: function (v) {
        if (typeof document === 'undefined') return;
        document.documentElement.setAttribute('data-hide-counter', v ? 'false' : 'true');
      },
    },
    {
      key: 'focusMode',
      label: 'Focus mode',
      group: 'Interface',
      type: 'toggle',
      default: false,
      applies: 'live',
      apply: function (v) {
        if (typeof document === 'undefined') return;
        document.documentElement.setAttribute('data-focus-mode', v ? 'true' : 'false');
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

  // Settings v2 is an envelope around the original browser preferences.  The
  // flat helpers above remain intentionally compatible with existing hosts.
  var CURRENT_VERSION = 2;
  var NAMESPACE_DEFAULTS = {
    browser: {
      theme: Themes.DEFAULT_ID,
      accentColor: 'theme',
      cornerRadius: 'default',
      motionSpeed: 'normal',
      fontFamily: 'system',
      uiScale: 'md',
      highContrast: false,
      reduceMotion: false,
      questionTypes: { binary: true, scale: true, ranking: true, tree: true },
      behavior: { autoAdvance: false, confirmSubmit: false },
      interface: { showKeyHints: true, showCounter: true, focusMode: false },
      strategy: 'auto',
    },
    recovery: { retentionMs: 3600000, mode: 'auto' },
    autosave: { enabled: true, debounceMs: 750 },
    diagnostics: { enabled: false, includePaths: false },
    delivery: { mode: 'auto', retryMs: 1000 },
    closure: { mode: 'after-delivery' },
    adapters: { claudeEnabled: true, codexEnabled: true },
  };
  var FIELD_META = [
    ['browser.strategy', 'select', 'auto', ['auto', 'system', 'manual'], 'live', 'browser'],
    ['recovery.retentionMs', 'number', 3600000, [60000, 604800000], 'runtime', 'bridge'],
    ['recovery.mode', 'select', 'auto', ['auto', 'manual'], 'runtime', 'bridge'],
    ['autosave.enabled', 'boolean', true, null, 'live', 'draft-writer'],
    ['autosave.debounceMs', 'number', 750, [250, 10000], 'live', 'draft-writer'],
    ['diagnostics.enabled', 'boolean', false, null, 'runtime', 'round-lifecycle'],
    ['diagnostics.includePaths', 'boolean', false, null, 'runtime', 'round-lifecycle'],
    ['delivery.mode', 'select', 'auto', ['auto', 'confirm'], 'runtime', 'live'],
    ['delivery.retryMs', 'number', 1000, [250, 30000], 'runtime', 'live'],
    [
      'closure.mode',
      'select',
      'after-delivery',
      ['never', 'after-delivery'],
      'runtime',
      'lifecycle',
    ],
    ['adapters.claudeEnabled', 'boolean', true, null, 'runtime', 'claude-hook'],
    ['adapters.codexEnabled', 'boolean', true, null, 'runtime', 'mcp-server'],
  ];
  var LEGACY_MAP = {
    theme: 'browser.theme',
    accentColor: 'browser.accentColor',
    cornerRadius: 'browser.cornerRadius',
    motionSpeed: 'browser.motionSpeed',
    fontFamily: 'browser.fontFamily',
    uiScale: 'browser.uiScale',
    highContrast: 'browser.highContrast',
    reduceMotion: 'browser.reduceMotion',
    qtypeBinary: 'browser.questionTypes.binary',
    qtypeScale: 'browser.questionTypes.scale',
    qtypeRanking: 'browser.questionTypes.ranking',
    qtypeTree: 'browser.questionTypes.tree',
    autoAdvance: 'browser.behavior.autoAdvance',
    confirmSubmit: 'browser.behavior.confirmSubmit',
    showKeyHints: 'browser.interface.showKeyHints',
    showCounter: 'browser.interface.showCounter',
    focusMode: 'browser.interface.focusMode',
  };
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function setPath(target, path, value) {
    var parts = path.split('.'),
      cursor = target;
    parts.slice(0, -1).forEach(function (part) {
      cursor[part] = cursor[part] || {};
      cursor = cursor[part];
    });
    cursor[parts[parts.length - 1]] = value;
  }
  function getPath(target, path) {
    return path.split('.').reduce(function (v, k) {
      return v && v[k];
    }, target);
  }
  function envelopeDefaults() {
    return {
      _v: CURRENT_VERSION,
      browser: clone(NAMESPACE_DEFAULTS.browser),
      recovery: clone(NAMESPACE_DEFAULTS.recovery),
      autosave: clone(NAMESPACE_DEFAULTS.autosave),
      diagnostics: clone(NAMESPACE_DEFAULTS.diagnostics),
      delivery: clone(NAMESPACE_DEFAULTS.delivery),
      closure: clone(NAMESPACE_DEFAULTS.closure),
      adapters: clone(NAMESPACE_DEFAULTS.adapters),
    };
  }
  function matrix() {
    return ENTRIES.map(function (e) {
      return {
        path: LEGACY_MAP[e.key] || 'browser.' + e.key,
        key: e.key,
        type: e.type === 'toggle' ? 'boolean' : 'string',
        default: e.default,
        importable: true,
        exportable: true,
        sensitive: false,
        effect: e.applies === 'reload' ? 'reload' : 'live',
        owner: 'browser',
      };
    }).concat(
      FIELD_META.map(function (f) {
        return {
          path: f[0],
          type: f[1],
          default: f[2],
          options: Array.isArray(f[3]) && f[1] === 'select' ? f[3] : undefined,
          bounds: f[1] === 'number' ? f[3] : undefined,
          importable: true,
          exportable: true,
          sensitive: false,
          effect: f[4],
          owner: f[5],
        };
      })
    );
  }
  function envelopeFromLegacy(input) {
    var out = envelopeDefaults();
    Object.keys(input || {}).forEach(function (key) {
      if (LEGACY_MAP[key] !== undefined) setPath(out, LEGACY_MAP[key], input[key]);
    });
    return out;
  }
  function browserFromLegacy(input) {
    var out = {};
    Object.keys(input || {}).forEach(function (key) {
      var mapped = LEGACY_MAP[key];
      if (mapped) setPath(out, mapped.slice('browser.'.length), input[key]);
    });
    return out;
  }
  function mergeBrowserLegacy(browser, input) {
    var out = clone(browser || NAMESPACE_DEFAULTS.browser);
    var patch = browserFromLegacy(input);
    function merge(target, source) {
      Object.keys(source).forEach(function (key) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          target[key] = merge(target[key] || {}, source[key]);
        } else target[key] = source[key];
      });
      return target;
    }
    merge(out, patch);
    return out;
  }
  function browserToLegacy(browser) {
    var source = browser && typeof browser === 'object' ? browser : NAMESPACE_DEFAULTS.browser;
    var out = clone(defaults());
    Object.keys(LEGACY_MAP).forEach(function (key) {
      var value = getPath({ browser: source }, LEGACY_MAP[key]);
      if (value !== undefined) out[key] = value;
    });
    return validate(out);
  }
  function validateEnvelope(input) {
    var out = envelopeDefaults(),
      source = input && typeof input === 'object' ? input : {};
    matrix().forEach(function (m) {
      var value = getPath(source, m.path);
      if (m.type === 'boolean' && typeof value === 'boolean') setPath(out, m.path, value);
      else if (
        m.type === 'number' &&
        Number.isInteger(value) &&
        value >= m.bounds[0] &&
        value <= m.bounds[1]
      )
        setPath(out, m.path, value);
      else if (m.type === 'select' && m.options.indexOf(value) !== -1) setPath(out, m.path, value);
      else if (
        m.type === 'string' &&
        typeof value === 'string' &&
        (m.options === undefined || m.options.indexOf(value) !== -1)
      )
        setPath(out, m.path, value);
    });
    return out;
  }
  function inspectEnvelope(input) {
    var source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    if (
      source._v !== undefined &&
      (!Number.isInteger(source._v) || (source._v !== 1 && source._v !== CURRENT_VERSION))
    ) {
      return {
        status: source._v > CURRENT_VERSION ? 'unsupported-future' : 'invalid-version',
        valid: false,
        envelope: null,
      };
    }
    var legacy = source._v === undefined || source._v === 1;
    var envelope = legacy ? envelopeFromLegacy(source) : validateEnvelope(source);
    var ignored = Object.keys(source).filter(function (key) {
      return (
        key !== '_v' &&
        [
          'browser',
          'recovery',
          'autosave',
          'diagnostics',
          'delivery',
          'closure',
          'adapters',
        ].indexOf(key) === -1
      );
    });
    return {
      status: legacy ? 'legacy' : 'current',
      valid: true,
      envelope: envelope,
      migrated: legacy,
      ignored: { count: Math.min(ignored.length, 100), truncated: ignored.length > 100 },
    };
  }

  return {
    entries: entries,
    byKey: byKey,
    defaults: defaults,
    groups: groups,
    validate: validate,
    coerce: coerce,
    applyAll: applyAll,
    CURRENT_VERSION: CURRENT_VERSION,
    matrix: matrix,
    namespaceDefaults: function () {
      return clone(NAMESPACE_DEFAULTS);
    },
    legacyMap: function () {
      return clone(LEGACY_MAP);
    },
    envelopeDefaults: envelopeDefaults,
    envelopeFromLegacy: envelopeFromLegacy,
    browserFromLegacy: browserFromLegacy,
    mergeBrowserLegacy: mergeBrowserLegacy,
    browserToLegacy: browserToLegacy,
    validateEnvelope: validateEnvelope,
    inspectEnvelope: inspectEnvelope,
  };
});
