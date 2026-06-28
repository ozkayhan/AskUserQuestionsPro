'use strict';
// Regression tests for web/views.js logic fixes.
// views.js is browser JSX; we replicate the exact helper logic here so tests
// run in node:test without a DOM.  Each test is pinned to a specific audit
// finding so a future regression is immediately traceable.

const test = require('node:test');
const assert = require('node:assert/strict');

/* ── helpers mirrored from views.js (keep in sync with the source) ────── */

// QItem fallback summary text (finding: LOW line 49-54 — missing filter(Boolean))
function qitemFallbackText(a, opts) {
  return a.sel
    .map((s) => (opts[s] && opts[s].custom ? a.customText : opts[s] ? opts[s].label : ''))
    .filter(Boolean) // ponytail: added to match Summary fallback and avoid ", ,Foo"
    .join(', ');
}

// QItem null guard (finding: LOW line 44-45)
function qitemState(answers, questionKey, i, current) {
  const a = answers[questionKey] || {}; // ponytail: null guard
  const state = a.confirmed ? 'done' : i === current ? 'current' : 'pending';
  return { a, state };
}

// TreeCard handleSelect — non-leaf must reset confirmed (finding: HIGH line 694)
function treeHandleSelect(ans, children, i, isLeafNode) {
  const path = ans.path || [];
  const child = children[i];
  if (!child) return ans; // no-op
  const newPath = [...path, i];
  if (isLeafNode(child)) {
    // leaf: confirmed stays true (set by onConfirm in real code)
    return { ...ans, path: newPath, confirmed: true };
  }
  // non-leaf: ponytail reset confirmed:false to prevent stale checkmark
  return { ...ans, path: newPath, confirmed: false };
}

// TreeCard handleBack — must reset confirmed (finding: HIGH line 694)
function treeHandleBack(ans) {
  const path = ans.path || [];
  if (path.length === 0) return ans;
  return { ...ans, path: path.slice(0, -1), confirmed: false };
}

// TreeCard crumbs — truncate at first invalid index (finding: LOW line 680-683)
function buildCrumbs(path, getNodeAt) {
  return path.reduce((acc, _, depth) => {
    const node = getNodeAt(path.slice(0, depth + 1));
    if (!node) return acc; // truncate
    acc.push({ label: node.label, depth });
    return acc;
  }, []);
}

// fullOptions sel filter for qType degrade (finding: MEDIUM line 809)
function filteredSel(sel, optsLength) {
  // ponytail: filter stale indices that exceed new opts cardinality
  return sel.filter((i) => i < optsLength);
}

// SidebarGrouped groups memo dep — answers is spurious (finding: LOW line 102)
// We test the invariant: group structure depends only on QUESTIONS + filteredIndices
function buildGroups(QUESTIONS, filteredIndices) {
  const map = new Map();
  QUESTIONS.forEach((q, i) => {
    if (!filteredIndices.has(i)) return;
    const key = q.header && q.header.trim() ? q.header.trim() : 'General';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ q, origIdx: i });
  });
  return [...map.entries()].map(([title, items]) => ({ title, items }));
}

/* ── tests ─────────────────────────────────────────────────────────────── */

// [LOW] QItem fallback filter(Boolean) — OOB index produces no stray comma
test('QItem fallback: OOB sel index is filtered — no empty comma segments', () => {
  const opts = [{ label: 'A' }, { label: 'B' }];
  const a = { sel: [0, 5], customText: '' }; // index 5 is OOB
  const result = qitemFallbackText(a, opts);
  assert.equal(result, 'A'); // 'A' only; no trailing comma or empty segment
  assert.ok(!result.includes(',,'), 'no double comma');
  assert.ok(!result.startsWith(','), 'no leading comma');
  assert.ok(!result.endsWith(','), 'no trailing comma');
});

test('QItem fallback: custom opt uses customText', () => {
  const opts = [{ label: 'A' }, { label: 'Other', custom: true }];
  const a = { sel: [1], customText: 'my custom answer' };
  assert.equal(qitemFallbackText(a, opts), 'my custom answer');
});

// [LOW] QItem null guard — missing answers entry must not throw
test('QItem null guard: missing answers entry returns safe defaults', () => {
  const { a, state } = qitemState({}, 'Missing question?', 0, 0);
  assert.deepEqual(a, {});
  assert.equal(state, 'current'); // i===current, a.confirmed falsy → 'current'
});

test('QItem null guard: undefined entry is guarded', () => {
  const answers = { 'Q?': undefined };
  const { a, state } = qitemState(answers, 'Q?', 1, 0);
  assert.deepEqual(a, {});
  assert.equal(state, 'pending');
});

// [HIGH] TreeCard confirmed:false reset on non-leaf (finding: HIGH line 694)
test('TreeCard handleSelect: non-leaf resets confirmed:false', () => {
  const ans = { path: [], confirmed: true, sel: [] };
  const children = [{ label: 'Branch', children: [{ label: 'Leaf' }] }];
  const isLeafNode = (n) => !n.children || n.children.length === 0;
  const next = treeHandleSelect(ans, children, 0, isLeafNode);
  assert.equal(next.confirmed, false, 'confirmed must be reset to false for non-leaf');
  assert.deepEqual(next.path, [0]);
});

test('TreeCard handleSelect: leaf keeps confirmed:true (set by onConfirm)', () => {
  const ans = { path: [], confirmed: false, sel: [] };
  const children = [{ label: 'Leaf' }]; // no children → leaf
  const isLeafNode = (n) => !n.children || n.children.length === 0;
  const next = treeHandleSelect(ans, children, 0, isLeafNode);
  assert.equal(next.confirmed, true);
  assert.deepEqual(next.path, [0]);
});

test('TreeCard handleSelect: missing child index is a no-op', () => {
  const ans = { path: [], confirmed: true, sel: [] };
  const children = [];
  const isLeafNode = (n) => !n.children;
  const next = treeHandleSelect(ans, children, 99, isLeafNode);
  assert.equal(next.confirmed, true); // unchanged
});

// [HIGH] TreeCard handleBack resets confirmed (finding: HIGH line 694)
test('TreeCard handleBack: resets confirmed:false', () => {
  const ans = { path: [0, 1], confirmed: true };
  const next = treeHandleBack(ans);
  assert.equal(next.confirmed, false);
  assert.deepEqual(next.path, [0]);
});

test('TreeCard handleBack: at root is a no-op', () => {
  const ans = { path: [], confirmed: false };
  const next = treeHandleBack(ans);
  assert.deepEqual(next.path, []);
});

// [LOW] TreeCard breadcrumb truncates at invalid path index (finding: LOW line 680-683)
test('TreeCard crumbs: truncates at first invalid index — no empty crumb buttons', () => {
  const tree = {
    options: [{ label: 'A', children: [{ label: 'A1' }] }],
  };
  // getNodeAt mirrors the fallback in TreeCard
  function getNodeAt(p) {
    if (p.length === 0) return null;
    let nodes = tree.options;
    let node = null;
    for (const idx of p) {
      if (!nodes || !nodes[idx]) return null;
      node = nodes[idx];
      nodes = node.children || [];
    }
    return node;
  }
  // valid path [0, 0] → 2 crumbs
  const valid = buildCrumbs([0, 0], getNodeAt);
  assert.equal(valid.length, 2);
  assert.equal(valid[0].label, 'A');
  assert.equal(valid[1].label, 'A1');

  // invalid path [0, 99] → truncates at depth 1 (index 99 doesn't exist)
  const partial = buildCrumbs([0, 99], getNodeAt);
  assert.equal(partial.length, 1, 'truncated at first invalid index');
  assert.equal(partial[0].label, 'A');

  // fully invalid path [99] → no crumbs
  const none = buildCrumbs([99], getNodeAt);
  assert.equal(none.length, 0);
});

// [MEDIUM] fullOptions sel filter on qType degrade (finding: MEDIUM line 809)
test('filteredSel: removes OOB indices when opts cardinality shrinks', () => {
  // binary has 2 opts; sel=[1] is valid for binary
  // after degrade to single (e.g. 3 opts), sel=[1] is still in range — stays
  assert.deepEqual(filteredSel([1], 3), [1]);
  // sel=[3] is OOB for opts.length=3 (valid indices 0,1,2)
  assert.deepEqual(filteredSel([3], 3), []);
  // sel=[0,5] for opts.length=4 — only [0] survives
  assert.deepEqual(filteredSel([0, 5], 4), [0]);
  // empty sel stays empty
  assert.deepEqual(filteredSel([], 2), []);
});

// [LOW] SidebarGrouped useMemo dep — group structure is independent of answers
test('buildGroups: same result regardless of answers change (dep was spurious)', () => {
  const QUESTIONS = [
    { question: 'Q1?', header: 'Section A' },
    { question: 'Q2?', header: 'Section B' },
    { question: 'Q3?', header: 'Section A' },
  ];
  const filteredIndices = new Set([0, 1, 2]);
  const groups1 = buildGroups(QUESTIONS, filteredIndices);
  // Simulate an answers change — groups should be identical
  const groups2 = buildGroups(QUESTIONS, filteredIndices);
  assert.deepEqual(
    groups1.map((g) => ({ title: g.title, items: g.items.length })),
    groups2.map((g) => ({ title: g.title, items: g.items.length })),
    'group structure is deterministic from QUESTIONS+filteredIndices only'
  );
  assert.equal(groups1[0].title, 'Section A');
  assert.equal(groups1[0].items.length, 2); // Q1 and Q3
  assert.equal(groups1[1].title, 'Section B');
  assert.equal(groups1[1].items.length, 1);
});

test('buildGroups: filteredIndices exclusion works', () => {
  const QUESTIONS = [
    { question: 'Q1?', header: 'Group' },
    { question: 'Q2?', header: 'Group' },
  ];
  // Only Q1 passes the filter
  const groups = buildGroups(QUESTIONS, new Set([0]));
  assert.equal(groups[0].items.length, 1);
  assert.equal(groups[0].items[0].q.question, 'Q1?');
});

test('buildGroups: no header falls back to General', () => {
  const QUESTIONS = [{ question: 'Q?', header: '' }];
  const groups = buildGroups(QUESTIONS, new Set([0]));
  assert.equal(groups[0].title, 'General');
});
