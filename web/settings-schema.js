(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./themes.js'));
  else root.Settings_Schema = factory(root.Themes);
})(typeof self !== 'undefined' ? self : this, function (Themes) {
  'use strict';

  // ── şema: tek kaynak ──────────────────────────────────────────────
  // Her girdi: key, label, group, type (select|toggle), default, (+ options),
  // applies ('live'|'reload'), apply(v) — apply YALNIZCA tarayıcıda çağrılır.
  var ENTRIES = [
    {
      key: 'theme', label: 'Theme', group: 'Appearance', type: 'select',
      default: Themes.DEFAULT_ID,
      options: Themes.list.map(function (t) { return { value: t.id, label: t.name }; }),
      applies: 'live',
      apply: function (v) { Themes.apply(v); }
    },
    {
      key: 'uiScale', label: 'Interface scale', group: 'Appearance', type: 'select',
      default: 'md',
      options: [
        { value: 'sm', label: 'Small' },
        { value: 'md', label: 'Medium' },
        { value: 'lg', label: 'Large' }
      ],
      applies: 'live',
      apply: function (v) {
        // ponytail: CSS px+clamp(vw) tabanlı; en sade güvenilir ölçek = html zoom.
        // Tavan: Firefox <126 zoom yok sayar (layout bozulmaz, ölçek uygulanmaz).
        document.documentElement.style.zoom = ({ sm: 0.9, md: 1, lg: 1.12 })[v] || 1;
      }
    },
    {
      key: 'reduceMotion', label: 'Reduce motion', group: 'Appearance', type: 'toggle',
      default: false,
      applies: 'reload',
      apply: function (v) {
        document.documentElement.setAttribute('data-reduce-motion', v ? 'true' : 'false');
      }
    },
    {
      key: 'qtypeBinary', label: 'Binary (yes/no)', group: 'Question types', type: 'toggle',
      default: true,
      applies: 'reload',
      apply: function () {}
    },
    {
      key: 'qtypeScale', label: 'Scale', group: 'Question types', type: 'toggle',
      default: true,
      applies: 'reload',
      apply: function () {}
    },
    {
      key: 'qtypeRanking', label: 'Ranking', group: 'Question types', type: 'toggle',
      default: true,
      applies: 'reload',
      apply: function () {}
    },
    {
      key: 'qtypeTree', label: 'Decision tree', group: 'Question types', type: 'toggle',
      default: true,
      applies: 'reload',
      apply: function () {}
    }
  ];

  var BY_KEY = {};
  ENTRIES.forEach(function (e) { BY_KEY[e.key] = e; });

  function entries() { return ENTRIES; }
  function byKey(key) { return BY_KEY[key]; }

  function defaults() {
    var o = {};
    ENTRIES.forEach(function (e) { o[e.key] = e.default; });
    return o;
  }

  function groups() {
    var seen = {}, out = [];
    ENTRIES.forEach(function (e) {
      if (!seen[e.group]) { seen[e.group] = true; out.push(e.group); }
    });
    return out;
  }

  // self-healing: her key için tip/aralık doğrula; geçersiz/bilinmeyen → default,
  // bilinmeyen key at, eksik default'la doldur. Asla throw etmez.
  function validate(obj) {
    var src = (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    var out = {};
    ENTRIES.forEach(function (e) {
      var v = src[e.key];
      if (e.type === 'toggle') {
        out[e.key] = (typeof v === 'boolean') ? v : e.default;
      } else { // select
        var ok = e.options.some(function (o) { return o.value === v; });
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
      if (s === 'off' || s === 'false' || s === '0' || s === 'no') return { ok: true, value: false };
      return { ok: false };
    }
    // select
    return e.options.some(function (o) { return o.value === str; })
      ? { ok: true, value: str } : { ok: false };
  }

  // tarayıcıda her apply'ı çağır (sayfa yüklenince + Kaydet'te).
  function applyAll(values) {
    var v = validate(values);
    ENTRIES.forEach(function (e) {
      try { e.apply(v[e.key]); } catch (err) { /* node/headless: yok say */ }
    });
  }

  return {
    entries: entries,
    byKey: byKey,
    defaults: defaults,
    groups: groups,
    validate: validate,
    coerce: coerce,
    applyAll: applyAll
  };
});
