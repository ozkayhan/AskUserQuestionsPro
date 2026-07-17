/* global React, ReactDOM, AnswerMap, DraftWriter, Settings_Schema, useLiveQuestions, postAnswers, postDraft, fullOptions,
   Check, Waiting, Sidebar, Hints, QuestionCard, CustomPopup, Summary, RecoveryChooser, ReconciliationPanel, DeliveryPanel,
   SettingsButton, SettingsModal */
/* askuseroz · app — durum makinesi: soru akışı, klavye, gönderim. Sunum web/views.js'te. */
const { useState, useEffect, useRef, useCallback } = React;

// v2 is the canonical browser source. The flat global remains the explicit
// compatibility path for v1 files and is updated so older consumers agree.
function normalizeBootSettings() {
  const envelope = window.__ASKUSER_SETTINGS_V2__;
  if (envelope && envelope._v === 2 && envelope.browser) {
    const b = envelope.browser;
    const legacy = Settings_Schema.browserToLegacy(b);
    window.__ASKUSER_SETTINGS__ = legacy;
    return legacy;
  }
  return window.__ASKUSER_SETTINGS__ || Settings_Schema.defaults();
}
const APP_SETTINGS = normalizeBootSettings();
const currentAppSettings = () => window.__ASKUSER_SETTINGS__ || APP_SETTINGS;

function App() {
  const { id, questions, capability, revision, draftAnswers } = useLiveQuestions();
  const roundId = id;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recoverableRounds, setRecoverableRounds] = useState(null);
  const [recoveryError, setRecoveryError] = useState(null);
  const [selectedRecovery, setSelectedRecovery] = useState(null);
  const settingsFabRef = useRef(null);

  useEffect(() => {
    if (id != null || typeof getRecoverableRounds !== 'function') return undefined;
    getRecoverableRounds().then(setRecoverableRounds).catch((error) => setRecoveryError(error.message));
    return undefined;
  }, [id]);

  const chooseRecovery = (round) => {
    setRecoveryError(null);
    setSelectedRecovery(round);
    selectRecoveryRound(round).catch((error) => setRecoveryError(error.message));
  };

  const screen =
    !questions || questions.length === 0 ? (
      <div className="app">
        <Waiting />
      </div>
    ) : (
      // key = tur kimliği: aynı metinli ardışık soru setleri bile temiz remount olur (B10).
      <Flow
        questions={questions}
        roundId={roundId}
        capability={capability}
        revision={revision}
        draftAnswers={draftAnswers}
        key={id == null ? 'q' : 'round-' + id}
      />
    );

  return (
    <React.Fragment>
      {screen}
      <SettingsButton buttonRef={settingsFabRef} onOpen={() => setSettingsOpen(true)} />
      {settingsOpen && <SettingsModal onClose={() => { setSettingsOpen(false); setTimeout(() => settingsFabRef.current?.focus(), 0); }} />}
      {id == null && recoverableRounds && recoverableRounds.length > 0 && !selectedRecovery && (
        <RecoveryChooser rounds={recoverableRounds} error={recoveryError} onSelect={chooseRecovery} onRetry={() => {
          setRecoveryError(null);
          getRecoverableRounds().then(setRecoverableRounds).catch((error) => setRecoveryError(error.message));
        }} />
      )}
    </React.Fragment>
  );
}

function Flow({ questions, roundId, capability, revision, draftAnswers }) {
  const QUESTIONS = questions;
  const n = QUESTIONS.length;
  const draftWriterKey = `${roundId}:${capability || ''}`;

  // answers[question] = { sel:number[], confirmed, customText, value, order, path }
  const [answers, setAnswers] = useState(() => {
    const a = {};
    QUESTIONS.forEach((q) => {
      a[q.question] = {
        sel: [],
        confirmed: false,
        customText: '',
        value: null,
        order: null,
        path: null,
      };
    });
    const localDraft = DraftWriter.readPendingDraft(draftWriterKey, revision);
    return {
      ...a,
      ...(draftAnswers && typeof draftAnswers === 'object' ? draftAnswers : {}),
      ...(localDraft && typeof localDraft === 'object' ? localDraft : {}),
    };
  });
  const draftRevision = useRef(revision);
  const draftWriter = useRef(null);
  if (draftWriter.current?.key !== draftWriterKey) {
    draftWriter.current = {
      key: draftWriterKey,
      writer: DraftWriter.createDraftWriter({
        save: (draft, expectedRevision) => postDraft(roundId, draft, capability, expectedRevision),
        getRevision: () => draftRevision.current,
        setRevision: (nextRevision) => {
          draftRevision.current = nextRevision;
        },
        roundKey: draftWriterKey,
      }),
    };
  }
  const draftReady = useRef(false);
  useEffect(() => {
    if (Number.isInteger(revision)) draftRevision.current = revision;
  }, [revision]);
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState('right');
  const [popup, setPopup] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [deliveryState, setDeliveryState] = useState('saved');
  const [closeDenied, setCloseDenied] = useState(false);
  useEffect(() => {
    if (!Number.isInteger(draftRevision.current) || !capability || submitted) return undefined;
    // Initial hydration is already durable. Every later material edit starts a
    // save immediately and is deliberately not cancelled on unmount/reload.
    if (!draftReady.current) {
      draftReady.current = true;
      draftWriter.current.writer.replay();
      return undefined;
    }
    draftWriter.current.writer.write(answers);
    return undefined;
  }, [answers, capability, roundId, submitted]);
  // sendError: null | 'network' | 'server' | 'stale' (yalnızca network retry edilebilir).
  const [sendError, setSendError] = useState(null);
  // confirmSubmit ayarı açıkken: ilk Enter/tık "silahlar", ikincisi gerçekten gönderir.
  const [confirmArmed, setConfirmArmed] = useState(false);
  // In-flight POST guard: setSubmitted async olduğundan reject sonrası ikinci Enter'ı yakalar (B17).
  const inflight = useRef(false);

  // Büyük soru seti: arama + filtre durumu (N > 8)
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnanswered, setShowUnanswered] = useState(false);
  const searchInputRef = useRef(null);

  const isSummary = current >= n;
  const ref = useRef({});
  ref.current = { answers, current, popup, n, isSummary, submitted, sendError, confirmArmed };

  const inputRef = useRef(null);
  // Popup açılırken tetikleyen elemanı sakla; kapanınca odağı oraya geri ver (B-a11y return-focus).
  const triggerRef = useRef(null);
  useEffect(() => {
    if (popup) {
      // ponytail: tetikleyen eleman, popup state'i true olduğunda hâlâ activeElement.
      if (!triggerRef.current) triggerRef.current = document.activeElement;
      if (inputRef.current) inputRef.current.focus();
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [popup]);

  const goTo = useCallback(
    (idx, direction) => {
      setDir(direction);
      setCurrent(Math.max(0, Math.min(n, idx)));
    },
    [n]
  );

  const advance = useCallback(
    (from) => {
      if (from < n - 1) goTo(from + 1, 'right');
      else goTo(n, 'right');
    },
    [goTo, n]
  );

  // goBack: bulunulan pozisyondan bir adım geri (Summary'deyken son soruya). "Son ziyaret"
  // semantiği; confirmed back-nav'da sıfırlanmadığından findIndex tabanlı eski mantık
  // tüm sorular confirmed iken yanlışlıkla son soruya atlardı (B-stateui goBack).
  const goBack = useCallback(() => {
    const cur = ref.current.current;
    const idx = cur >= n ? n - 1 : Math.max(0, cur - 1);
    goTo(idx, 'left');
  }, [goTo, n]);

  const setQ = useCallback((qid, patch) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], ...patch } }));
  }, []);

  const activate = useCallback(
    (qIndex, optIdx) => {
      const q = QUESTIONS[qIndex];
      const a = ref.current.answers[q.question];
      // binary: tek basış onay — sel set et + confirmed:true + ilerle (popup/armed yok).
      if (AnswerMap.qType(q) === 'binary') {
        // Bounds: binary'nin yalnızca 2 şıkkı var. '3'..'9' tuşları aksi halde sel=[2..8]
        // confirmed:true yazıp soruyu "cevaplanmış" gösterir ama mapAnswers'ta sessizce
        // düşer (veri kaybı). decideActivate'i aynala (B-correctness binary bounds).
        if (optIdx < 0 || optIdx > 1) return;
        setQ(q.question, { sel: [optIdx], confirmed: true });
        advance(qIndex);
        return;
      }
      const action = AnswerMap.decideActivate(q, a, optIdx);
      switch (action.type) {
        case 'noop':
          return;
        case 'select':
        case 'toggle': {
          // autoAdvance: single-select ilk (armed olmayan) seçimde, custom ("Other")
          // değilse binary gibi tek basışta onayla+ilerle. multi hep 'toggle' döndüğünden
          // buraya girmez (B action.type==='select' guard).
          const s = currentAppSettings();
          if (action.type === 'select' && s && s.autoAdvance) {
            const opts = fullOptions(q);
            if (optIdx !== opts.length - 1) {
              setQ(q.question, { sel: action.sel, confirmed: true });
              advance(qIndex);
              return;
            }
          }
          setQ(q.question, { sel: action.sel, confirmed: false });
          return;
        }
        case 'popup':
          setPopup({ qid: q.question, optIdx: action.optIdx, draft: action.draft });
          return;
        case 'confirm':
          setQ(q.question, { confirmed: true });
          advance(qIndex);
          return;
      }
    },
    [setQ, advance, QUESTIONS]
  );

  // onConfirm(qIndex, patch): genel onay — tüm tipler için çalışır.
  // patch: kartın az önce uyguladığı değer (value/order/path). React setState async
  // olduğundan ref.current henüz eski olabilir; patch'i merge ederek stale-ref'i aşarız
  // (özellikle tree yaprak seçimi + dokunulmamış scale/ranking Enter). patch state'e de yazılır.
  const onConfirm = useCallback(
    (qIndex, patch) => {
      const q = QUESTIONS[qIndex];
      const a = { ...ref.current.answers[q.question], ...(patch || {}) };
      if (!AnswerMap.isAnswered(q, a)) return;
      const qtype = AnswerMap.qType(q);
      // single/multi: "Other" seçili ama customText boşsa popup aç (B4 korunur).
      if (qtype === 'single' || qtype === 'multi') {
        const opts = fullOptions(q);
        const customIdx = opts.length - 1;
        if (a.sel.includes(customIdx) && !a.customText) {
          setPopup({ qid: q.question, optIdx: customIdx, draft: '' });
          return;
        }
      }
      setQ(q.question, { ...(patch || {}), confirmed: true });
      advance(qIndex);
    },
    [QUESTIONS, setQ, advance]
  );

  const confirmCurrent = useCallback(() => {
    const { current: cur } = ref.current;
    if (cur >= n) return;
    const q = QUESTIONS[cur];
    const a = ref.current.answers[q.question];
    // AnswerMap.isAnswered ile koru (tüm tipler).
    if (!AnswerMap.isAnswered(q, a)) return;
    const qtype = AnswerMap.qType(q);
    // single/multi: "Other" boş popup kontrolü korunur.
    if (qtype === 'single' || qtype === 'multi') {
      const opts = fullOptions(q);
      const customIdx = opts.length - 1;
      if (a.sel.includes(customIdx) && !a.customText) {
        setPopup({ qid: q.question, optIdx: customIdx, draft: '' });
        return;
      }
    }
    setQ(q.question, { confirmed: true });
    advance(cur);
  }, [n, setQ, advance, QUESTIONS]);

  const savePopup = useCallback(() => {
    const p = ref.current.popup;
    if (!p) return;
    const text = (p.draft || '').trim();
    setAnswers((prev) => {
      const a = prev[p.qid];
      if (!a) return prev; // stale round: qid artık yok → updater'da throw etme (B-errorhandling)
      const next = AnswerMap.savePopupState(a, p.optIdx, text); // boş metin = kaldır (B4)
      return {
        ...prev,
        [p.qid]: { ...a, sel: next.sel, customText: next.customText, confirmed: false },
      };
    });
    setPopup(null);
  }, []);

  // Custom popup'tan "Remove": seçimi kaldır (B4 — multiSelect Other deselect).
  const removeCustom = useCallback(() => {
    const p = ref.current.popup;
    if (!p) return;
    setAnswers((prev) => {
      const a = prev[p.qid];
      if (!a) return prev; // stale round guard (B-errorhandling)
      const next = AnswerMap.savePopupState(a, p.optIdx, '');
      return {
        ...prev,
        [p.qid]: { ...a, sel: next.sel, customText: next.customText, confirmed: false },
      };
    });
    setPopup(null);
  }, []);

  // "u" kısayolu: yanıtlanmamış ilk soruya atla; hepsi yanıtlanmışsa Summary'ye git.
  // AnswerMap.isAnswered ile koru (tüm tipler).
  const jumpToNextUnanswered = useCallback(() => {
    const idx = QUESTIONS.findIndex(
      (q) => !AnswerMap.isAnswered(q, ref.current.answers[q.question])
    );
    // Yön, render'lı `current` state'inden hesaplanır; stale ref hızlı ardışık "u"'da
    // yönü ters çevirip bir frame yanlış slide gösteriyordu (B-stateui jump direction).
    goTo(idx === -1 ? n : idx, idx === -1 || idx > current ? 'right' : 'left');
  }, [QUESTIONS, goTo, n, current]);

  // "Skip remaining & review": doğrudan Summary ekranına geç.
  const skipAll = useCallback(() => {
    goTo(n, 'right');
  }, [goTo, n]);

  // answers'ı parametre olarak alır: submit() aynı event batch'inde çağrılınca stale
  // ref.current.answers'a değil, çağrı anındaki canlı state'e map eder (B-errorhandling stale).
  const mappedAnswers = useCallback(
    (src) => {
      const stateForMap = {};
      QUESTIONS.forEach((q) => {
        const a = src[q.question] || {};
        // value/order/path yeni tipler için stateForMap'e eklenir.
        stateForMap[q.question] = {
          sel: a.sel,
          customText: a.customText,
          value: a.value,
          order: a.order,
          path: a.path,
        };
      });
      return AnswerMap.mapAnswers(QUESTIONS, stateForMap);
    },
    [QUESTIONS]
  );

  const submit = useCallback(() => {
    // Double-submit guard: submitted (render'lı) VEYA inflight (async, henüz settle olmamış)
    // her ikisi de bloklar; reject sonrası ikinci hızlı Enter mükerrer POST'u başlatamaz (B17).
    if (ref.current.submitted || inflight.current) return;
    // confirmSubmit ayarı: ilk çağrı sadece "silahlanır" (toast gösterir), gerçek
    // gönderim ikinci Enter/tık'ta olur.
    const confirmOn = currentAppSettings().confirmSubmit;
    if (confirmOn && !ref.current.confirmArmed) {
      setConfirmArmed(true);
      return;
    }
    setConfirmArmed(false);
    const mapped = mappedAnswers(ref.current.answers);
    if (Object.keys(mapped).length === 0) return; // boş submit guard (B8)
    setSendError(null);
    setSubmitted(true);
    setDeliveryState('delivery-pending');
    inflight.current = true;
    postAnswers(roundId, mapped, capability)
      .then(() => {
        inflight.current = false;
        if (typeof acknowledgeDelivery === 'function') {
          return acknowledgeDelivery(roundId, capability)
            .then(() => {
              setDeliveryState('delivered');
              if (currentAppSettings().closureMode === 'after-delivery' && typeof attemptClose === 'function') {
                const result = attemptClose();
                setCloseDenied(result.denied);
              }
            })
            .catch(() => {
              setDeliveryState('delivery-uncertain');
              setSubmitted(false);
            });
        }
        setDeliveryState('delivered');
      })
      .catch((err) => {
        // B6: hata → kilidi aç, uyar. Ağ (TypeError/abort, kurtarılabilir) ile sunucu
        // (HTTP 4xx/5xx, err.server) ayrılır; 4xx'te sonsuz retry yerine "server" mesajı.
        inflight.current = false;
        setSubmitted(false);
        setDeliveryState(err?.server ? 'recovery-error' : 'delivery-uncertain');
        setSendError(
          err && err.reason === 'stale_round' ? 'stale' : err && err.server ? 'server' : 'network'
        );
      });
  }, [capability, mappedAnswers, roundId]);

  useEffect(() => {
    const onKey = (e) => {
      const R = ref.current;
      if (R.popup || R.submitted) return;
      // Metin alanında (input, textarea) tuş yönlendirmesi: sadece ok tuşlarını ve Escape'i engelle.
      const inTextField =
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA');
      // ←/→: metin alanındaysa (range input, arama kutusu) kaçır — kart kendi nav'ını yönetir.
      if (e.key === 'ArrowRight') {
        if (inTextField) return;
        e.preventDefault();
        goTo(Math.min(R.n, R.current + 1), 'right');
      } else if (e.key === 'ArrowLeft') {
        if (inTextField) return;
        e.preventDefault();
        goTo(Math.max(0, R.current - 1), 'left');
      } else if (e.key === 'Enter') {
        // Arama inputundayken Enter ile onay yok (input formu kontrolü).
        if (inTextField) return;
        e.preventDefault();
        if (R.isSummary) {
          // Stale cevap çoğunlukla daha önce kabul edilmiş veya başka turla
          // değiştirilmiş bir round'dur; yeniden POST etmek yanlış turu tekrarlar.
          if (R.sendError !== 'stale') submit();
          return;
        }
        // Summary dışındayken yalnızca KURTARILABİLİR (network) hatada Enter retry'ı yapsın:
        // toast "Press Enter to retry" der. 'server' (4xx/5xx, kalıcı) toast'u retry demez, o
        // yüzden Enter confirmCurrent'a düşmeli — aksi halde talimat yalan olurdu (B-errorhandling).
        if (R.sendError === 'network') {
          submit();
          return;
        }
        if (R.sendError === 'stale') return;
        confirmCurrent();
      } else if (R.isSummary && (e.key === 'b' || e.key === 'B')) {
        if (inTextField) return;
        e.preventDefault();
        goBack();
      } else if (!R.isSummary && /^[1-9]$/.test(e.key)) {
        if (inTextField) return;
        // Number-key yalnızca seçilebilir-şıklı tipler için: scale/ranking/tree kart gövdesi
        // onActivate kullanmaz; aksi halde activate() 'single' fallback'ine düşüp sahte sel +
        // sahte 'Other' popup yazardı (B-correctness number-key guard).
        const qType = AnswerMap.qType(QUESTIONS[R.current]);
        if (qType !== 'binary' && qType !== 'single' && qType !== 'multi') return;
        e.preventDefault();
        activate(R.current, parseInt(e.key, 10) - 1);
      } else if (!R.isSummary && (e.key === 'u' || e.key === 'U')) {
        // "u": yanıtlanmamış ilk soruya atla (sadece büyük N için Hints gösterilir ama kısayol her zaman çalışır).
        if (inTextField) return;
        e.preventDefault();
        jumpToNextUnanswered();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, confirmCurrent, activate, goBack, submit, jumpToNextUnanswered, QUESTIONS]);

  // "answered" = AnswerMap.isAnswered ile tüm tipler için doğru sayım (B16 + yeni tipler).
  const answered = QUESTIONS.filter((q) => AnswerMap.isAnswered(q, answers[q.question])).length;
  const canSubmit = answered > 0;

  // qid'e bağlı setQ helper: QuestionCard'a prop olarak geçilir.
  const makeSetQ = useCallback((qid) => (patch) => setQ(qid, patch), [setQ]);

  // Açık popup'ın sorusu güncel turda var mı? Yoksa (stale round push) popupQ null olur.
  const popupQ = popup ? QUESTIONS.find((q) => q.question === popup.qid) : null;
  // Stale popup'ı otomatik kapat: soru artık yoksa CustomPopup'a undefined q geçip
  // ilk prop erişiminde çökmek yerine popup'ı düşür (B-errorhandling stale-q + auto-dismiss).
  useEffect(() => {
    if (popup && !popupQ) setPopup(null);
  }, [popup, popupQ]);

  // sendError toast auto-dismiss: kalıcı hata olsa bile ~8s sonra kapanır (B-stateui dismiss).
  useEffect(() => {
    if (!sendError) return undefined;
    const t = setTimeout(() => setSendError(null), 8000);
    return () => clearTimeout(t);
  }, [sendError]);

  // confirmSubmit "silahlı" toast: ~5s dokunulmazsa iner (Summary'den ayrılınca da).
  useEffect(() => {
    if (!confirmArmed) return undefined;
    const t = setTimeout(() => setConfirmArmed(false), 5000);
    return () => clearTimeout(t);
  }, [confirmArmed]);
  useEffect(() => {
    if (!isSummary) setConfirmArmed(false);
  }, [isSummary]);

  return (
    <div className="app" data-panel="left" data-align="center">
      <Sidebar
        QUESTIONS={QUESTIONS}
        answers={answers}
        current={current}
        n={n}
        answered={answered}
        isSummary={isSummary}
        submitted={submitted}
        goTo={goTo}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        showUnanswered={showUnanswered}
        onToggleUnanswered={() => setShowUnanswered((v) => !v)}
        onJumpUnanswered={jumpToNextUnanswered}
        onSkipAll={skipAll}
        searchRef={searchInputRef}
      />
      <main className="inspector">
        {/* aria-live: soru kartı key ile takas edilince ekran okuyucu yeni içeriği duyursun. */}
        <div className="stage" aria-live="polite" aria-atomic="true">
          {isSummary ? (
            <Summary
              answers={answers}
              QUESTIONS={QUESTIONS}
              onEdit={(i) => goTo(i, 'left')}
              onBack={goBack}
              onSubmit={submit}
              submitted={submitted}
              canSubmit={canSubmit}
            />
          ) : (
            <QuestionCard
              key={current}
              q={QUESTIONS[current]}
              qIndex={current}
              ans={answers[QUESTIONS[current].question]}
              motion="slide"
              dir={dir}
              onActivate={activate}
              setQ={makeSetQ(QUESTIONS[current].question)}
              onConfirm={onConfirm}
            />
          )}
        </div>
        {!isSummary && <Hints q={QUESTIONS[current]} />}
      </main>
      {popup && popupQ && (
        <CustomPopup
          q={popupQ}
          draft={popup.draft}
          selected={(answers[popup.qid]?.sel || []).includes(popup.optIdx)}
          inputRef={inputRef}
          onChange={(v) => setPopup((p) => ({ ...p, draft: v }))}
          onSave={savePopup}
          onRemove={removeCustom}
          onCancel={() => setPopup(null)}
        />
      )}
      {submitted && (
        <div className="toast" role="status" aria-live="polite" aria-atomic="true">
          <span className="ok">
            <Check c="var(--success)" />
          </span>
          Answers sent back to the agent.
        </div>
      )}
      <DeliveryPanel
        state={deliveryState}
        closeDenied={closeDenied}
        onRetry={() => submit()}
      />
      {confirmArmed && (
        <div className="toast" role="status" aria-live="polite" aria-atomic="true">
          Press submit again to confirm.
        </div>
      )}
      {sendError && (
        <div className="toast toast--err" role="alert" aria-live="assertive" aria-atomic="true">
          {sendError === 'stale'
            ? 'This round already completed or was replaced. Reopen the question flow to continue. '
            : sendError === 'server'
              ? "Couldn't send — the agent rejected this round. "
              : "Couldn't send — bridge unavailable. Press Enter to retry. "}
          <button
            type="button"
            className="toast__close"
            aria-label="Dismiss error"
            onClick={() => setSendError(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// Boot: ayarlar varsa AnswerMap.setEnabled ile yeni tip toggleları uygula (reload'da okur).
if (APP_SETTINGS) {
  const s = APP_SETTINGS;
  AnswerMap.setEnabled({
    binary: s.qtypeBinary !== false,
    scale: s.qtypeScale !== false,
    ranking: s.qtypeRanking !== false,
    tree: s.qtypeTree !== false,
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
