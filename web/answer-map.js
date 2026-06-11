(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AnswerMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var CUSTOM_LABEL = 'Other';

  // questions: AskUserQuestion soru dizisi (her biri {question, options, multiSelect})
  // state: { [question]: { sel: number[], customText: string } }
  //   sel, [...options, Other] dizisine indekslenir; Other son indekstir.
  // döndürür: { [question]: label | [labels] } — AskUserQuestion answers şekli.
  function mapAnswers(questions, state) {
    var out = {};
    questions.forEach(function (q) {
      var s = state[q.question];
      if (!s || !s.sel || s.sel.length === 0) return;
      var opts = q.options.concat([{ label: CUSTOM_LABEL, custom: true }]);
      var labels = s.sel
        .map(function (i) {
          var o = opts[i];
          if (!o) return '';
          return o.custom ? (s.customText || '') : o.label;
        })
        .filter(function (x) { return x !== ''; });
      if (labels.length === 0) return;
      out[q.question] = q.multiSelect ? labels : labels[0];
    });
    return out;
  }

  // Bir seçeneğe basıldığında/tıklandığında ne yapılacağına karar verir (saf fonksiyon).
  // q: { options, multiSelect }, a: { sel:number[], customText, confirmed }, optIdx: number
  // döndürür action: { type, ... }
  //   'noop'            — geçersiz indeks
  //   'select'          — { sel } yeni tekli seçim (armed)
  //   'toggle'          — { sel } çoklu seçim listesi güncellendi
  //   'popup'           — { optIdx, draft } custom düzenleyiciyi aç
  //   'confirm'         — onayla ve ilerle
  function decideActivate(q, a, optIdx) {
    var opts = q.options.concat([{ label: CUSTOM_LABEL, custom: true }]);
    if (optIdx < 0 || optIdx >= opts.length) return { type: 'noop' };
    var isCustom = !!opts[optIdx].custom;

    if (q.multiSelect) {
      var inSel = a.sel.indexOf(optIdx) !== -1;
      if (inSel) {
        if (isCustom) return { type: 'popup', optIdx: optIdx, draft: a.customText };
        return { type: 'toggle', sel: a.sel.filter(function (i) { return i !== optIdx; }) };
      }
      // Yeni custom: metin kaydedilene dek seçimi işaretleme; iptal edilirse hayalet
      // seçili "Other" kalmasın (savePopup metin gelince sel'e ekler).
      if (isCustom && !a.customText) return { type: 'popup', optIdx: optIdx, draft: '' };
      return { type: 'toggle', sel: a.sel.concat([optIdx]) };
    }

    var armed = a.sel[0] === optIdx;
    if (!armed) return { type: 'select', sel: [optIdx] };
    // armed: custom seçenekte her zaman düzenleyiciyi aç (ilk kez yaz veya mevcut metni düzenle)
    if (isCustom) return { type: 'popup', optIdx: optIdx, draft: a.customText || '' };
    return { type: 'confirm' };
  }

  // Popup "kaydet" mantığı (saf): boş metin = custom seçimi kaldır, dolu = ekle/güncelle.
  // a: { sel:number[], customText }, optIdx: custom indeksi, text: trim'lenmiş metin
  function savePopupState(a, optIdx, text) {
    if (!text) {
      return { sel: a.sel.filter(function (i) { return i !== optIdx; }), customText: '' };
    }
    var sel = a.sel.indexOf(optIdx) === -1 ? a.sel.concat([optIdx]) : a.sel;
    return { sel: sel, customText: text };
  }

  return { mapAnswers: mapAnswers, decideActivate: decideActivate, savePopupState: savePopupState };
});
