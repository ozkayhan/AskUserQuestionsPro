(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AnswerMap = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var CUSTOM_LABEL = 'Other';

  // RICH tip haritası — setEnabled ile kapatılabilir; varsayılan hepsi true.
  var ENABLED = { binary: true, scale: true, ranking: true, tree: true };
  var RICH_TYPES = { binary: true, scale: true, ranking: true, tree: true };

  // optionLabel: TEK GERÇEK KAYNAK guarded accessor.
  // q.options[i] OOB/undefined ise null döner — ranking/summaryText/mapAnswers
  // hepsi bunun üstünden geçer, böylece OOB indeks TypeError yerine atlanır.
  function optionLabel(q, i) {
    var opts = q && q.options;
    if (!opts) return null;
    var o = opts[i];
    return o ? o.label : null;
  }

  // setEnabled({binary,scale,ranking,tree}) — app boot'ta çağrılır.
  function setEnabled(map) {
    Object.keys(map).forEach(function (k) {
      if (k in ENABLED) ENABLED[k] = !!map[k];
    });
  }

  // TEK GERÇEK KAYNAK: soru tipini çözer.
  // q.type yoksa multiSelect'e göre single/multi.
  // RICH tip setEnabled ile kapalıysa degrade olur.
  function qType(q) {
    var base = q.type || (q.multiSelect ? 'multi' : 'single');
    if (base in RICH_TYPES && !ENABLED[base]) {
      return q.multiSelect ? 'multi' : 'single';
    }
    return base;
  }

  // questions: AskUserQuestion soru dizisi
  // state: { [question]: { sel, customText, value, order, path, confirmed } }
  // döndürür: { [question]: tipli cevap değeri }
  function mapAnswers(questions, state) {
    var out = {};
    questions.forEach(function (q) {
      var s = state[q.question];
      if (!s) return;
      var t = qType(q);

      if (t === 'single' || t === 'multi') {
        if (!s.sel || s.sel.length === 0) return;
        var opts = (q.options || []).concat([{ label: CUSTOM_LABEL, custom: true }]);
        var labels = s.sel
          .map(function (i) {
            var o = opts[i];
            if (!o) return '';
            return o.custom ? s.customText || '' : o.label;
          })
          .filter(function (x) {
            return x !== '';
          });
        if (labels.length === 0) return;
        out[q.question] = t === 'multi' ? labels : labels[0];
      } else if (t === 'binary') {
        if (!s.sel || s.sel.length === 0) return;
        var bOpts =
          q.options && q.options.length === 2 ? q.options : [{ label: 'Evet' }, { label: 'Hayır' }];
        var bLabel = bOpts[s.sel[0]] ? bOpts[s.sel[0]].label : '';
        if (!bLabel) return;
        out[q.question] = bLabel;
      } else if (t === 'scale') {
        if (s.value == null) return;
        out[q.question] = s.value;
      } else if (t === 'ranking') {
        if (!s.order || s.order.length === 0) return;
        var rLabels = s.order
          .map(function (i) {
            return optionLabel(q, i);
          })
          .filter(function (x) {
            return x != null;
          });
        if (rLabels.length === 0) return;
        out[q.question] = rLabels;
      } else if (t === 'tree') {
        if (!s.path || s.path.length === 0) return;
        // ponytail: treeNodeAt/isLeaf TEK kaynak — truncated path null döner,
        // yalnızca tam (yaprağa ulaşan) yol gönderilir. isAnswered ile aynı invariant.
        var leaf = treeNodeAt(q, s.path);
        if (!leaf || !isLeaf(leaf)) return;
        out[q.question] = treePathLabels(q, s.path);
      }
    });
    return out;
  }

  // Bir seçeneğe basıldığında ne yapılacağına karar verir (saf fonksiyon).
  // binary: "Other" EKLEME; tek basışta {type:'select', sel:[optIdx]} döndür.
  // single/multi: mevcut davranış korunur.
  function decideActivate(q, a, optIdx) {
    var t = qType(q);

    // binary: sadece sel güncelle, armed/popup yok, app confirm+advance eder.
    if (t === 'binary') {
      var bOpts =
        q.options && q.options.length === 2 ? q.options : [{ label: 'Evet' }, { label: 'Hayır' }];
      if (optIdx < 0 || optIdx >= bOpts.length) return { type: 'noop' };
      return { type: 'select', sel: [optIdx] };
    }

    var opts = (q.options || []).concat([{ label: CUSTOM_LABEL, custom: true }]);
    if (optIdx < 0 || optIdx >= opts.length) return { type: 'noop' };
    var isCustom = !!opts[optIdx].custom;

    if (t === 'multi') {
      var inSel = a.sel.indexOf(optIdx) !== -1;
      if (inSel) {
        if (isCustom) return { type: 'popup', optIdx: optIdx, draft: a.customText || '' };
        return {
          type: 'toggle',
          sel: a.sel.filter(function (i) {
            return i !== optIdx;
          }),
        };
      }
      // Custom seçili değilken tekrar tıklanırsa: stale customText olsa bile
      // kullanıcı onaylasın diye popup aç (sessiz re-add yok).
      if (isCustom) return { type: 'popup', optIdx: optIdx, draft: a.customText || '' };
      return { type: 'toggle', sel: a.sel.concat([optIdx]) };
    }

    // single (ve degrade binary→single durumu)
    var armed = a.sel[0] === optIdx;
    if (!armed) return { type: 'select', sel: [optIdx] };
    if (isCustom) return { type: 'popup', optIdx: optIdx, draft: a.customText || '' };
    return { type: 'confirm' };
  }

  // Popup "kaydet" mantığı (saf).
  function savePopupState(a, optIdx, text) {
    if (!text) {
      return {
        sel: a.sel.filter(function (i) {
          return i !== optIdx;
        }),
        customText: '',
      };
    }
    var sel = a.sel.indexOf(optIdx) === -1 ? a.sel.concat([optIdx]) : a.sel;
    return { sel: sel, customText: text };
  }

  // isAnswered: cevap verilmiş mi?
  function isAnswered(q, a) {
    if (!a) return false;
    var t = qType(q);
    if (t === 'single' || t === 'multi' || t === 'binary') {
      return !!(a.sel && a.sel.length > 0);
    }
    if (t === 'scale') {
      return a.value != null;
    }
    if (t === 'ranking') {
      // bounds: en az bir geçerli indeks olmalı; OOB-only order false döner
      // (mapAnswers ile aynı invariant — true dönüp crash etmesin).
      if (!a.order || a.order.length === 0) return false;
      return a.order.some(function (i) {
        return optionLabel(q, i) != null;
      });
    }
    if (t === 'tree') {
      if (!a.path || a.path.length === 0) return false;
      var node = treeNodeAt(q, a.path);
      return !!(node && isLeaf(node));
    }
    return false;
  }

  // summaryText: sidebar/özet için görüntü metni.
  function summaryText(q, a) {
    if (!a) return '';
    var t = qType(q);

    if (t === 'binary') {
      if (!a.sel || a.sel.length === 0) return '';
      var bOpts =
        q.options && q.options.length === 2 ? q.options : [{ label: 'Evet' }, { label: 'Hayır' }];
      return bOpts[a.sel[0]] ? bOpts[a.sel[0]].label : '';
    }

    if (t === 'scale') {
      if (a.value == null) return '';
      return a.value + ' / ' + q.max;
    }

    if (t === 'ranking') {
      if (!a.order || a.order.length === 0) return '';
      return a.order
        .map(function (i) {
          return optionLabel(q, i);
        })
        .filter(function (x) {
          return x != null;
        })
        .join(' → ');
    }

    if (t === 'tree') {
      if (!a.path || a.path.length === 0) return '';
      return treePathLabels(q, a.path).join(' → ');
    }

    // single / multi
    if (!a.sel || a.sel.length === 0) return '';
    var opts = (q.options || []).concat([{ label: CUSTOM_LABEL, custom: true }]);
    var labels = a.sel
      .map(function (i) {
        var o = opts[i];
        if (!o) return '';
        return o.custom ? a.customText || '' : o.label;
      })
      .filter(function (x) {
        return x !== '';
      });
    return labels.join(', ');
  }

  // --- ranking saf yardımcılar ---

  // moveRank: order dizisinde idx'deki elemanı dir (-1 yukarı, +1 aşağı) yönünde taşır.
  // Sınır dışına çıkmaz; mutasyonsuz yeni dizi döndürür.
  function moveRank(order, idx, dir) {
    var arr = order.slice();
    var target = idx + dir;
    if (target < 0 || target >= arr.length) return arr;
    var tmp = arr[idx];
    arr[idx] = arr[target];
    arr[target] = tmp;
    return arr;
  }

  // initOrder: q.options için [0..n-1] başlangıç sırası.
  function initOrder(q) {
    return q.options.map(function (_, i) {
      return i;
    });
  }

  // --- scale saf yardımcı ---

  // clampScale: v değerini min/max/step'e oturtulmuş sayı olarak döndürür.
  function clampScale(q, v) {
    var min = q.min == null ? 0 : q.min;
    var max = q.max == null ? 0 : q.max;
    var n = Number(v);
    if (!isFinite(n)) return min; // NaN/Infinity → alt sınır
    var step = q.step || 1;
    var clamped = Math.min(max, Math.max(min, n));
    // step'e yuvarlama
    var snapped = Math.round((clamped - min) / step) * step + min;
    return Math.min(max, Math.max(min, snapped));
  }

  // --- tree saf yardımcılar ---

  // treeNodeAt: path dizisine göre düğümü döndürür; bulunamazsa null.
  function treeNodeAt(q, path) {
    var cur = q.options;
    var node = null;
    for (var i = 0; i < path.length; i++) {
      node = cur[path[i]];
      if (!node) return null;
      cur = node.children || [];
    }
    return node;
  }

  // treeChildrenAt: path konumundaki seviyenin şıkları (path boşsa kök).
  function treeChildrenAt(q, path) {
    if (!path || path.length === 0) return q.options;
    var cur = q.options;
    for (var i = 0; i < path.length; i++) {
      var node = cur[path[i]];
      if (!node) return [];
      cur = node.children || [];
    }
    return cur;
  }

  // isLeaf: children'ı olmayan veya boş olan düğüm yapraktır (nihai cevap).
  function isLeaf(node) {
    return !node.children || node.children.length === 0;
  }

  // treePathLabels: path boyunca geçerli (mevcut) düğümlerin label'ları.
  // Kırık adımda durur — TEK kaynak, mapAnswers/summaryText paylaşır.
  function treePathLabels(q, path) {
    var labels = [];
    var cur = q.options;
    for (var i = 0; i < path.length; i++) {
      var node = cur[path[i]];
      if (!node) break;
      labels.push(node.label);
      cur = node.children || [];
    }
    return labels;
  }

  return {
    setEnabled: setEnabled,
    optionLabel: optionLabel,
    qType: qType,
    mapAnswers: mapAnswers,
    decideActivate: decideActivate,
    savePopupState: savePopupState,
    isAnswered: isAnswered,
    summaryText: summaryText,
    moveRank: moveRank,
    initOrder: initOrder,
    clampScale: clampScale,
    treeNodeAt: treeNodeAt,
    treeChildrenAt: treeChildrenAt,
    isLeaf: isLeaf,
  };
});
