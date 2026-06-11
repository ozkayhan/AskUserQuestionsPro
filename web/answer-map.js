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

  return { mapAnswers: mapAnswers };
});
