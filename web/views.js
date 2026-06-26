/* global React, Check, Kbd, Brand, fullOptions, AnswerMap */
/* askuseroz · views — saf sunum bileşenleri (durumu prop ile alır, callback ile bildirir) */
const { useEffect: useEffectView, useState: useStateView, useMemo: useMemoView, useRef: useRefView } = React;

/* Küçük ok ikonu (accordion chevron) */
const ChevronRight = () => (
  <svg className="qgroup__chevron" viewBox="0 0 14 14" fill="none">
    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Waiting() {
  return (
    <main className="inspector">
      <div className="stage">
        <div className="qcard">
          <div className="qcard__chip"><span className="dot" />Agent · clarify</div>
          <h1 className="qcard__q">Waiting for a question…</h1>
          <p className="qcard__meta">Claude Code bir soru sorduğunda burada görünecek. Bu sekmeyi açık bırakın.</p>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────── sidebar: tek soru satırı (paylaşımlı) ─────────────────── */
function QItem({ q, i, answers, current, goTo }) {
  const a = answers[q.question];
  const state = a.confirmed ? "done" : (i === current ? "current" : "pending");
  const answerText = a.confirmed
    ? (typeof AnswerMap !== "undefined" && AnswerMap.summaryText
        ? AnswerMap.summaryText(q, a)
        : (() => {
            const opts = fullOptions(q);
            return a.sel.map((s) => (opts[s] && opts[s].custom ? a.customText : (opts[s] ? opts[s].label : ""))).join(", ");
          })())
    : "";
  return (
    <button key={q.question} className="qitem" data-active={i === current} data-state={state}
            onClick={() => goTo(i, i > current ? "right" : "left")}>
      <span className="qitem__idx">{state === "done" ? <Check s={12} /> : i + 1}</span>
      <span className="qitem__body">
        <span className="qitem__header">{q.header}</span>
        <span className="qitem__q">{q.question}</span>
        {a.confirmed && answerText && <span className="qitem__answer"><Check s={11} /> {answerText}</span>}
      </span>
    </button>
  );
}

/* ─────────────────── sidebar: düz liste (N ≤ 8) ─────────────────── */
function SidebarFlatList({ QUESTIONS, answers, current, goTo }) {
  return (
    <React.Fragment>
      {QUESTIONS.map((q, i) => (
        <QItem key={q.question} q={q} i={i} answers={answers} current={current} goTo={goTo} />
      ))}
    </React.Fragment>
  );
}

/* ─────────────────── sidebar: accordion gruplar (N > 8) ─────────────────── */
function SidebarGrouped({ QUESTIONS, answers, current, goTo, filteredIndices }) {
  // Grup açık/kapalı durumu: başlangıçta tüm gruplar açık.
  // Grupları header alanına göre oluştur; header boş/yok olanlar "General" altında.
  const groups = useMemoView(() => {
    const map = new Map(); // başlık -> [{q, origIdx}]
    QUESTIONS.forEach((q, i) => {
      if (!filteredIndices.has(i)) return;
      const key = (q.header && q.header.trim()) ? q.header.trim() : "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ q, origIdx: i });
    });
    return [...map.entries()].map(([title, items]) => ({ title, items }));
  }, [QUESTIONS, answers, filteredIndices]);

  const [openGroups, setOpenGroups] = useStateView(() => {
    const s = new Set();
    groups.forEach((g) => s.add(g.title));
    return s;
  });

  // Filtreleme değişince kapanmış grupları yeniden aç (kullanıcı gördüklerini görsün).
  useEffectView(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      groups.forEach((g) => { if (!next.has(g.title)) next.add(g.title); });
      return next;
    });
  }, [filteredIndices]);

  const toggle = (title) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <React.Fragment>
      {groups.map(({ title, items }) => {
        const doneCount = items.filter(({ q }) => answers[q.question].confirmed).length;
        const isOpen = openGroups.has(title);
        const allDone = doneCount === items.length;
        return (
          <div key={title} className="qgroup" data-open={isOpen} data-done={allDone}>
            <button className="qgroup__header" onClick={() => toggle(title)}>
              <ChevronRight />
              <span className="qgroup__title">{title}</span>
              <span className="qgroup__badge">{doneCount}/{items.length}</span>
            </button>
            {isOpen && (
              <div className="qgroup__body">
                {items.map(({ q, origIdx }) => (
                  <QItem key={q.question} q={q} i={origIdx} answers={answers} current={current} goTo={goTo} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </React.Fragment>
  );
}

/* ─────────────────── sidebar: arama + filtre çubuğu ─────────────────── */
function SidebarSearch({ searchQuery, onSearch, showUnanswered, onToggleUnanswered, searchRef }) {
  return (
    <div className="sidebar__search">
      <input
        ref={searchRef}
        className="search__input"
        type="text"
        placeholder="Filter questions…"
        value={searchQuery}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="search__row">
        <button
          className="search__toggle"
          data-active={showUnanswered}
          onClick={onToggleUnanswered}
          type="button"
        >
          <span className="search__toggle__dot">
            {showUnanswered && <Check s={9} c="var(--accent-fg)" />}
          </span>
          Show unanswered only
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── sidebar ─────────────────── */
// N ≤ 8 → düz liste, arama/accordion yok. N > 8 → arama + accordion gruplar.
const ACCORDION_THRESHOLD = 8;

function Sidebar({ QUESTIONS, answers, current, n, answered, isSummary, submitted, goTo,
                   searchQuery, onSearch, showUnanswered, onToggleUnanswered,
                   onJumpUnanswered, onSkipAll, searchRef }) {
  const useLarge = n > ACCORDION_THRESHOLD;

  // Filtrelenmiş indeks kümesi (sadece large modda kullanılır).
  // isAnswered varsa onu kullan; yoksa geriye uyumlu sel.length kontrolü.
  const filteredIndices = useMemoView(() => {
    if (!useLarge) return null;
    const qStr = (searchQuery || "").toLowerCase().trim();
    const set = new Set();
    QUESTIONS.forEach((question, i) => {
      const a = answers[question.question];
      const isAns = (typeof AnswerMap !== "undefined" && AnswerMap.isAnswered)
        ? AnswerMap.isAnswered(question, a)
        : (a.sel.length > 0);
      if (showUnanswered && isAns) return;
      if (qStr && !question.question.toLowerCase().includes(qStr)) return;
      set.add(i);
    });
    return set;
  }, [QUESTIONS, answers, searchQuery, showUnanswered, useLarge]);

  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <div className="brand">
          <span className="brand__mark"><Brand s={20} /></span>
          <span className="brand__name">Agent <span>· clarify</span></span>
        </div>
        <div className="progress__label">
          <span>Questions</span><span><b>{Math.min(answered, n)}</b> / {n}</span>
        </div>
        <div className="progress__track">
          <div className="progress__fill" style={{ width: `${(answered / n) * 100}%` }} />
        </div>
      </div>
      {useLarge && (
        <SidebarSearch
          searchRef={searchRef}
          searchQuery={searchQuery}
          onSearch={onSearch}
          showUnanswered={showUnanswered}
          onToggleUnanswered={onToggleUnanswered}
        />
      )}
      {useLarge && (
        <div className="sidebar__bulk">
          <button className="sidebar__bulk-btn" onClick={onSkipAll} type="button">
            <span>Skip remaining &amp; review</span>
            <Kbd>→</Kbd>
          </button>
        </div>
      )}
      <div className="qlist">
        {useLarge ? (
          <SidebarGrouped
            QUESTIONS={QUESTIONS}
            answers={answers}
            current={current}
            goTo={goTo}
            filteredIndices={filteredIndices}
          />
        ) : (
          <SidebarFlatList
            QUESTIONS={QUESTIONS}
            answers={answers}
            current={current}
            goTo={goTo}
          />
        )}
        <button className="qitem" data-active={isSummary} data-state={submitted ? "done" : "pending"}
                onClick={() => goTo(n, "right")} style={{ marginTop: 4 }}>
          <span className="qitem__idx">{submitted ? <Check s={12} /> : "✓"}</span>
          <span className="qitem__body">
            <span className="qitem__header">Review</span>
            <span className="qitem__q">Confirm &amp; submit your answers</span>
          </span>
        </button>
      </div>
      <div className="sidebar__foot">
        <div className="legend"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span><span>Move between questions</span></div>
        <div className="legend"><span className="kbd-group"><Kbd>1</Kbd><Kbd>4</Kbd></span><span>Select · press again to confirm</span></div>
        {useLarge && (
          <div className="legend">
            <span className="kbd-group"><Kbd>U</Kbd></span>
            <span>Jump to next unanswered</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─────────────────── ipuçları (qType'a göre) ─────────────────── */
function Hints({ q }) {
  const qType = (typeof AnswerMap !== "undefined" && AnswerMap.qType)
    ? AnswerMap.qType(q)
    : (q.type || (q.multiSelect ? "multi" : "single"));

  if (qType === "scale") {
    // Slider odaktayken ←/→ değeri ayarlar; sorular arası geçiş ↵ (onayla→ilerle) veya kenar çubuğu.
    return (
      <footer className="hints">
        <span className="hint"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span> Ayarla</span>
        <span className="hint"><Kbd>↵</Kbd> Onayla ve ilerle</span>
      </footer>
    );
  }
  if (qType === "ranking") {
    return (
      <footer className="hints">
        <span className="hint"><span className="kbd-group"><Kbd>↑</Kbd><Kbd>↓</Kbd></span> Taşı</span>
        <span className="hint"><Kbd>↵</Kbd> Onayla</span>
        <span className="hint__spacer" />
        <span className="hint"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span> Navigate</span>
      </footer>
    );
  }
  if (qType === "tree") {
    return (
      <footer className="hints">
        <span className="hint"><span className="kbd-group"><Kbd>1</Kbd>–<Kbd>9</Kbd></span> Seç</span>
        <span className="hint"><Kbd>⌫</Kbd> Geri</span>
        <span className="hint__spacer" />
        <span className="hint"><Kbd>→</Kbd> İleri soru</span>
      </footer>
    );
  }
  if (qType === "binary") {
    return (
      <footer className="hints">
        <span className="hint"><span className="kbd-group"><Kbd>1</Kbd><Kbd>2</Kbd></span> Seç</span>
        <span className="hint__spacer" />
        <span className="hint"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span> Navigate</span>
      </footer>
    );
  }
  // single / multi (mevcut)
  return (
    <footer className="hints">
      <span className="hint">
        <span className="kbd-group"><Kbd>1</Kbd>–<Kbd>{Math.min(9, fullOptions(q).length)}</Kbd></span> Select
      </span>
      <span className="hint">
        {q.multiSelect
          ? <><Kbd>↵</Kbd> Confirm selection</>
          : <><span style={{ color: "var(--fg-faint)" }}>press key again →</span> Confirm</>}
      </span>
      <span className="hint"><Kbd>↵</Kbd> on "Other" to type</span>
      <span className="hint__spacer" />
      <span className="hint"><span className="kbd-group"><Kbd>←</Kbd><Kbd>→</Kbd></span> Navigate</span>
    </footer>
  );
}

/* ─────────────────── BinaryCard ─────────────────── */
function BinaryCard({ q, qIndex, ans, onActivate }) {
  const opts = fullOptions(q); // binary için 2 şık (Evet/Hayır veya özel)
  return (
    <div className="binary">
      {opts.map((o, i) => {
        const sel = ans.sel.includes(i);
        const confirmed = ans.confirmed && sel;
        return (
          <button
            key={i}
            className="binary__opt"
            data-sel={sel}
            data-confirmed={confirmed}
            onClick={() => onActivate(qIndex, i)}
          >
            <span className="opt__key">{i + 1}</span>
            <span className="opt__label">{o.label}</span>
            {sel && <span className="opt__check"><Check c={confirmed ? "var(--success)" : "var(--accent)"} /></span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────── ScaleCard ─────────────────── */
function ScaleCard({ q, ans, qIndex, setQ, onConfirm }) {
  const min = q.min != null ? q.min : 0;
  const max = q.max != null ? q.max : 10;
  const step = q.step != null ? q.step : 1;
  // Görsel başlangıç: value ?? orta nokta — ama state'e null bırak (isAnswered value!=null bekler)
  const displayValue = ans.value != null ? ans.value : Math.round((min + max) / 2);

  const handleChange = (e) => {
    const clamped = (typeof AnswerMap !== "undefined" && AnswerMap.clampScale)
      ? AnswerMap.clampScale(q, +e.target.value)
      : Math.min(max, Math.max(min, +e.target.value));
    setQ({ value: clamped });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      e.preventDefault();
      // Dokunulmamış slider'da bile gösterilen değeri (orta nokta) onayla — patch ile geç (stale-ref'siz).
      const committed = (typeof AnswerMap !== "undefined" && AnswerMap.clampScale)
        ? AnswerMap.clampScale(q, displayValue)
        : displayValue;
      onConfirm(qIndex, { value: committed });
    }
  };

  return (
    <div className="scale">
      <div className="scale__value" data-empty={ans.value == null}>{displayValue}</div>
      <input
        type="range"
        className="scale__range"
        min={min}
        max={max}
        step={step}
        value={displayValue}
        autoFocus
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className="scale__labels">
        <span>{q.leftLabel || ""}</span>
        <span>{q.rightLabel || ""}</span>
      </div>
    </div>
  );
}

/* ─────────────────── RankingCard ─────────────────── */
function RankingCard({ q, ans, qIndex, setQ, onConfirm }) {
  const initOrder = (typeof AnswerMap !== "undefined" && AnswerMap.initOrder)
    ? AnswerMap.initOrder(q)
    : q.options.map((_, i) => i);
  const order = ans.order || initOrder;

  // cursor: hangi satır odakta (klavye ile gezilecek)
  const [cursor, setCursor] = useStateView(0);
  // grabbed: o satır "tutuldu mu" (Enter/Space ile kap/bırak)
  const [grabbed, setGrabbed] = useStateView(false);

  const moveRank = (idx, dir) => {
    if (typeof AnswerMap !== "undefined" && AnswerMap.moveRank) {
      return AnswerMap.moveRank(order, idx, dir);
    }
    const newOrder = [...order];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return newOrder;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    return newOrder;
  };

  const handleKeyDown = (e) => {
    // Sadece kartın kullandığı tuşları yut; ←/→ ve u/b app'e ulaşıp navigasyonu sürdürsün.
    if (e.key === "ArrowUp") {
      e.stopPropagation();
      e.preventDefault();
      if (grabbed) {
        const newOrder = moveRank(cursor, -1);
        setQ({ order: newOrder });
        setCursor(Math.max(0, cursor - 1));
      } else {
        setCursor((c) => Math.max(0, c - 1));
      }
    } else if (e.key === "ArrowDown") {
      e.stopPropagation();
      e.preventDefault();
      if (grabbed) {
        const newOrder = moveRank(cursor, 1);
        setQ({ order: newOrder });
        setCursor(Math.min(order.length - 1, cursor + 1));
      } else {
        setCursor((c) => Math.min(order.length - 1, c + 1));
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.stopPropagation();
      e.preventDefault();
      if (grabbed) {
        setGrabbed(false);
      } else if (e.key === " ") {
        setGrabbed(true);
      } else {
        // Enter kapalıyken → gösterilen sırayı onayla (dokunulmamışsa initOrder; patch ile stale-ref'siz).
        onConfirm(qIndex, { order: order });
      }
    }
  };

  return (
    <div
      className="ranking"
      tabIndex={0}
      autoFocus
      onKeyDown={handleKeyDown}
    >
      {order.map((optIdx, rankPos) => {
        const opt = q.options[optIdx];
        const isCursor = cursor === rankPos;
        const isGrabbed = grabbed && isCursor;
        return (
          <div
            key={optIdx}
            className="rank-row"
            data-cursor={isCursor}
            data-grabbed={isGrabbed}
          >
            <span className="rank-row__badge">{rankPos + 1}</span>
            <span className="opt__label">{opt ? opt.label : ""}</span>
            <span className="rank-row__moves">
              <button
                className="rank-row__move"
                tabIndex={-1}
                disabled={rankPos === 0}
                onClick={(e) => { e.stopPropagation(); setQ({ order: moveRank(rankPos, -1) }); }}
                aria-label="Yukarı taşı"
              >↑</button>
              <button
                className="rank-row__move"
                tabIndex={-1}
                disabled={rankPos === order.length - 1}
                onClick={(e) => { e.stopPropagation(); setQ({ order: moveRank(rankPos, 1) }); }}
                aria-label="Aşağı taşı"
              >↓</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── TreeCard ─────────────────── */
function TreeCard({ q, ans, qIndex, setQ, onConfirm }) {
  const path = ans.path || [];

  const getChildren = (currentPath) => {
    if (typeof AnswerMap !== "undefined" && AnswerMap.treeChildrenAt) {
      return AnswerMap.treeChildrenAt(q, currentPath);
    }
    // Fallback: manuel gezinti
    let nodes = q.options;
    for (const idx of currentPath) {
      if (!nodes || !nodes[idx]) return [];
      nodes = nodes[idx].children || [];
    }
    return nodes || [];
  };

  const isLeafNode = (node) => {
    if (typeof AnswerMap !== "undefined" && AnswerMap.isLeaf) {
      return AnswerMap.isLeaf(node);
    }
    return !node.children || node.children.length === 0;
  };

  const getNodeAt = (currentPath) => {
    if (typeof AnswerMap !== "undefined" && AnswerMap.treeNodeAt) {
      return AnswerMap.treeNodeAt(q, currentPath);
    }
    if (currentPath.length === 0) return null;
    let nodes = q.options;
    let node = null;
    for (const idx of currentPath) {
      if (!nodes || !nodes[idx]) return null;
      node = nodes[idx];
      nodes = node.children || [];
    }
    return node;
  };

  const children = getChildren(path);

  // Breadcrumb için yol etiketleri
  const crumbs = path.map((_, depth) => {
    const node = getNodeAt(path.slice(0, depth + 1));
    return node ? node.label : "";
  });

  const handleSelect = (i) => {
    const child = children[i];
    if (!child) return;
    const newPath = [...path, i];
    if (isLeafNode(child)) {
      // Yaprak → patch ile onayla (onConfirm path'i yazar + confirmed + ilerler; stale-ref yok).
      onConfirm(qIndex, { path: newPath });
    } else {
      setQ({ path: newPath });
    }
  };

  const handleBack = () => {
    if (path.length > 0) {
      setQ({ path: path.slice(0, -1) });
    }
  };

  const handleKeyDown = (e) => {
    // Sadece kartın kullandığı tuşları yut; → (ileri) ve u/b app navigasyonuna geçsin.
    if (e.key === "Backspace") {
      e.stopPropagation();
      e.preventDefault();
      handleBack();
    } else if (e.key === "ArrowLeft") {
      if (path.length > 0) {
        // Ağaç içinde geri: yut
        e.stopPropagation();
        e.preventDefault();
        handleBack();
      }
      // Kökte iken: bubble → app-level ← soruyu geçsin
    } else if (e.key === "Enter") {
      e.stopPropagation();
      e.preventDefault();
      // Yaprak kontrolü: mevcut path bir yaprak ise onayla (patch ile path'i geç).
      if (path.length > 0) {
        const currentNode = getNodeAt(path);
        if (currentNode && isLeafNode(currentNode)) {
          onConfirm(qIndex, { path: path });
        }
      }
    } else {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        e.stopPropagation();
        e.preventDefault();
        handleSelect(num - 1);
      }
    }
  };

  return (
    <div
      className="tree"
      tabIndex={0}
      autoFocus
      onKeyDown={handleKeyDown}
    >
      {crumbs.length > 0 && (
        <div className="tree__crumbs">
          <button className="tree__crumb tree__back" onClick={handleBack} tabIndex={-1}>
            ← Geri
          </button>
          {crumbs.map((label, i) => (
            <button
              key={i}
              className="tree__crumb"
              tabIndex={-1}
              onClick={() => setQ({ path: path.slice(0, i + 1) })}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="options">
        {children.map((child, i) => {
          const isLeaf = isLeafNode(child);
          return (
            <button
              key={i}
              className="opt"
              data-sel={false}
              data-confirmed={false}
              onClick={() => handleSelect(i)}
            >
              <span className="opt__key">{i + 1}</span>
              <span className="opt__body">
                <span className="opt__label">{child.label}</span>
                {child.description && <span className="opt__desc">{child.description}</span>}
              </span>
              {!isLeaf && <span className="opt__arrow">›</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────── question card dağıtıcı ─────────────────── */
// props: { q, qIndex, ans, motion, dir, onActivate, setQ, onConfirm }
function QuestionCard({ q, qIndex, ans, motion, dir, onActivate, setQ, onConfirm }) {
  const qType = (typeof AnswerMap !== "undefined" && AnswerMap.qType)
    ? AnswerMap.qType(q)
    : (q.type || (q.multiSelect ? "multi" : "single"));

  let cardBody;
  switch (qType) {
    case "binary":
      cardBody = (
        <BinaryCard q={q} qIndex={qIndex} ans={ans} onActivate={onActivate} />
      );
      break;
    case "scale":
      cardBody = (
        <ScaleCard q={q} ans={ans} qIndex={qIndex} setQ={setQ} onConfirm={onConfirm} />
      );
      break;
    case "ranking":
      cardBody = (
        <RankingCard q={q} ans={ans} qIndex={qIndex} setQ={setQ} onConfirm={onConfirm} />
      );
      break;
    case "tree":
      cardBody = (
        <TreeCard q={q} ans={ans} qIndex={qIndex} setQ={setQ} onConfirm={onConfirm} />
      );
      break;
    default: {
      // single / multi — mevcut SelectCard gövdesi
      const opts = fullOptions(q);
      cardBody = (
        <div className="options">
          {opts.map((o, i) => {
            const sel = ans.sel.includes(i);
            const confirmed = ans.confirmed && sel;
            const isCustom = !!o.custom;
            const showCustomVal = isCustom && ans.customText;
            return (
              <button key={i} className={"opt" + (isCustom ? " opt--custom" : "")}
                      data-sel={sel} data-confirmed={confirmed} onClick={() => onActivate(qIndex, i)}>
                <span className="opt__key">{i + 1}</span>
                <span className="opt__body">
                  <span className="opt__label">
                    {isCustom && showCustomVal
                      ? <>Other <span className="custom-val">— "{ans.customText}"</span></>
                      : o.label}
                  </span>
                  <span className="opt__desc">
                    {isCustom
                      ? (sel
                          ? <span className="hint-edit">Press <Kbd>{i + 1}</Kbd> or <Kbd>↵</Kbd> to type your own answer.</span>
                          : o.description)
                      : o.description}
                  </span>
                </span>
                {q.multiSelect
                  ? <span className="opt__box">{sel && <Check c="#fff" s={12} />}</span>
                  : <span className="opt__check"><Check c={confirmed ? "var(--success)" : "var(--accent)"} /></span>}
              </button>
            );
          })}
        </div>
      );
    }
  }

  // meta metni qType'a göre
  let metaText;
  switch (qType) {
    case "binary":   metaText = "Bir seçenek seçin."; break;
    case "scale":    metaText = `${q.min ?? 0} – ${q.max ?? 10} arasında bir değer seçin.`; break;
    case "ranking":  metaText = "Öğeleri öncelik sırasına göre düzenleyin."; break;
    case "tree":     metaText = "Bir dal seçin; yaprak düğüme ulaşınca onaylanır."; break;
    default:
      metaText = q.multiSelect ? "Select all that apply. An \"Other\" choice is always available." : "Select one option. An \"Other\" choice is always available.";
  }

  return (
    <div className="qcard" data-motion={motion} data-dir={dir}>
      <div className="qcard__chip"><span className="dot" />{q.header}</div>
      <h1 className="qcard__q">{q.question}</h1>
      <p className="qcard__meta">{metaText}</p>
      {cardBody}
    </div>
  );
}

/* ─────────────────── custom popup (referans birebir) ─────────────────── */
function CustomPopup({ q, draft, selected, inputRef, onChange, onSave, onRemove, onCancel }) {
  const autosize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  useEffectView(() => { autosize(inputRef.current); }, [draft]);
  const trimmed = (draft || "").trim();
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="popup">
        <div className="popup__chip">{q.header} · Other</div>
        <div className="popup__title">{q.question}</div>
        <textarea ref={inputRef} className="popup__input" rows={1} value={draft}
                  placeholder="Type your own answer — write as much as you need…"
                  onChange={(e) => { onChange(e.target.value); autosize(e.target); }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSave(); }
                    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
                  }} />
        <div className="popup__foot">
          <span className="popup__hint"><Kbd>↵</Kbd> Save · <Kbd>⇧↵</Kbd> New line · <Kbd>esc</Kbd> Cancel</span>
          <div className="popup__actions">
            {selected && <button className="btn btn--danger" onClick={onRemove}>Remove</button>}
            <button className="btn" onClick={onCancel}>Cancel</button>
            <button className="btn btn--primary" onClick={onSave} disabled={!selected && !trimmed}>
              {trimmed ? "Save answer" : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── summary (q.question anahtarı) ─────────────────── */
function Summary({ answers, QUESTIONS, onEdit, onBack, onSubmit, submitted, canSubmit }) {
  const allDone = QUESTIONS.every((q) => answers[q.question].confirmed);
  return (
    <div className="summary">
      <div className="summary__chip"><Check c="var(--success)" s={12} /> Ready to send</div>
      <h1 className="summary__title">Review your answers</h1>
      <p className="summary__sub">These get sent back to the agent so it can continue. Edit anything before submitting.</p>
      <div className="summary__list">
        {QUESTIONS.map((q, i) => {
          const a = answers[q.question];
          const summaryText = (typeof AnswerMap !== "undefined" && AnswerMap.summaryText)
            ? AnswerMap.summaryText(q, a)
            : (() => {
                const opts = fullOptions(q);
                if (!a.sel || a.sel.length === 0) return "";
                return a.sel.map((s) => {
                  const o = opts[s];
                  return o ? (o.custom ? a.customText : o.label) : "";
                }).filter(Boolean).join(", ");
              })();
          return (
            <div className="srow" key={q.question}>
              <div className="srow__head">{q.header}</div>
              <div className="srow__val">
                <div className="srow__q">{q.question}</div>
                <div className="srow__a">
                  {!summaryText
                    ? <span className="none">No answer yet</span>
                    : <span className="tag">{summaryText}</span>}
                </div>
              </div>
              <button className="srow__edit" onClick={() => onEdit(i)}>Edit</button>
            </div>
          );
        })}
      </div>
      <div className="summary__actions">
        <button className="btn btn--lg btn--ghost" onClick={onBack}>
          <Kbd>B</Kbd> Back{allDone ? "" : " to unanswered"}
        </button>
        <button className="btn btn--lg btn--primary" onClick={onSubmit} disabled={!canSubmit || submitted}>
          {submitted ? "Submitted ✓" : canSubmit ? <>Submit answers <Kbd>↵</Kbd></> : "Answer at least one"}
        </button>
      </div>
    </div>
  );
}
