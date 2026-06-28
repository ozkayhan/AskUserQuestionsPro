export const meta = {
  name: 'askuserquestionspro-hardening',
  description: 'Remediate all 195 audit findings with systemic fixes + regression guards',
  phases: [
    { title: 'Ledger', detail: 'parse report → finding-ledger.json', model: 'sonnet' },
    { title: 'Fix & Review', detail: 'per-bundle fix then adversarial review (pipeline)' },
    { title: 'Integrate & self-heal', detail: 'format+lint+test+shellcheck, repair loop ≤3' },
    { title: 'Completeness', detail: 'ledger walk, no orphan rows' },
    { title: 'Smoke', detail: 'Chrome MCP + axe-core (best-effort)' },
    { title: 'Docs', detail: 'surgical sync + hardening note' },
  ],
};

const REPORT = '.context/attachments/54n4RS/audit-report.md';

const CONTRACTS = `PINNED CROSS-BUNDLE CONTRACTS (obey verbatim, do not redesign):
Contract R (round id): server/bridge.js provideAnswers(id,answers)→ return false if !this._pending || this._pending.id!==id, else resolve+true; cancel(reason,expectedId)→ false if no pending or (expectedId!=null && id mismatch), else reject. server/server.js POST /answer parses {id,answers}; Array.isArray(answers) else 400; if(!bridge.provideAnswers(id,answers)) 409. /ask captures its submit id; on client disconnect bridge.cancel('client disconnected', id). web/live.js postAnswers(id,answers) body {id,answers}. web/app.js passes round.id. lib/bridge-client.mjs & MCP are NOT part of R.
Contract W (settings): lib/settings.js write(patch)→{ok,value,error?} (success {ok:true,value:next}; failure logs via log(), unlinks orphan .tmp, {ok:false,value:next,error}). bin/cli.js settings-set: if(!r.ok){stderr+exit 1}. POST /settings: if(!r.ok) 500 else 200 {ok:true,settings:r.value}.
Contract L (logger): lib/log.cjs log(scope,x)→ writes "[askuser:<scope>] <message-or-stack>\\n" to stderr, never throws. Single import at every former catch{} site.
Contract T (test): test/helpers/isolation.js withClean(t,fn) snapshots AnswerMap ENABLED + relevant process.env, runs fn, restores in t.after even on throw.
Do-not-touch: any finding tagged "dogrulama — bulgu degil" → NO code change (at most a clarifying comment).
Zero new runtime deps (zero-dep invariant). devDeps/CDN only for tooling (eslint plugins, axe).`;

const BUNDLES = [
  {
    id: 'B1',
    model: undefined,
    files: ['server/server.js', 'server/bridge.js', 'test/server.test.js', 'test/bridge.test.js'],
    role: 'Single validation authority (deepen validQuestions w/ recursive tree-label check + new validAnswers); Contract R server side as id-owning rendezvous; readBody O(n^2)→Buffer.concat + deterministic 8MB reject + hang guards; broadcast dead-write guard; static cache/ETag; settings in-mem cache; EADDRINUSE→exit(1)+log; consume W(→500/200) & L. New tests: wire round-trip (correct id→resolve, stale→409, garbage→400), validator fuzz, concurrent /ask 409, traversal 403, poll-not-sleep. Use withClean.',
  },
  {
    id: 'B2',
    model: undefined,
    files: [
      'lib/bridge-client.mjs',
      'hooks/askuserquestionspro-bridge.mjs',
      'hooks/hook-output.js',
      'mcp-server/askuserquestionspro-mcp.mjs',
      'test/bridge-client.test.js',
      'test/mcp-server.test.js',
      'test/hook-output.test.js',
    ],
    role: 'CREATE lib/log.cjs (Contract L). askBridge TimeoutError + .answers null-guard + JSON-parse catch; ensureServer single-flight + surfaced spawn error; openBrowser dead-catch; MCP catch{}→catch(e) + id===undefined notification fix + sendResponse try/catch; hook readStdin watchdog + EPIPE callback + uncaught arg; MCP child try/finally (the 5x zombie); extend e2e wire test; XDG_CONFIG_HOME isolation; filter/force-MCP tests; withClean.',
  },
  {
    id: 'B3',
    model: 'sonnet',
    files: [
      'lib/settings.js',
      'bin/cli.js',
      'bin/install.js',
      'lib/atomic-write.cjs',
      'test/settings.test.js',
      'test/install.test.js',
    ],
    role: 'CREATE lib/atomic-write.cjs writeFileAtomic(file,data) tested incl. mid-write failure, used by settings.js + install.js (Critical #1); Contract W producer + .tmp cleanup; CLI try/catch around read/writeSettings; spawn error listener + signal-aware exit code; cmdDoctor fetch timeout; main().catch; toggle hint yes/no; addHook conflict-vs-already; isOurEntry boundary; write() error-path test.',
  },
  {
    id: 'B4',
    model: 'sonnet',
    files: ['install.sh', 'reinstall.sh'],
    role: 'Intent-based hook dedupe; jq corrupt → no fake success + validate-before-mv; supply-chain: pinned-SHA download + shasum -c replaces curl|bash; quote $pids/$remaining (readarray); cp -R error msg; empty-content guard; rm -rf failure msg; TMPDIR→WORKDIR + single-quote trap; PORT validation; drop vestigial hooks:{}; verify via jq -e not grep.',
  },
  {
    id: 'B5',
    model: 'sonnet',
    files: [
      '.github/workflows/ci.yml',
      '.github/workflows/release.yml',
      'eslint.config.js',
      'test/workflows-ci.test.js',
      'test/workflows-release.test.js',
      'test/eslint-prettier-config.test.js',
      'test/changesets-config.test.js',
    ],
    role: 'The enforcement wall: no-empty {allowEmptyCatch:false} on all Node files; @babel/eslint-parser + eslint-plugin-react-hooks on web/** (exhaustive-deps, rules-of-hooks); shellcheck step in CI lint job; SHA-pin actions/checkout@v4 & actions/setup-node@v4; update workflow/config tests to assert all of it. IMPORTANT: actually add the new devDeps (@babel/eslint-parser, @babel/core, eslint-plugin-react-hooks) to package.json devDependencies AND run npm install so lint resolves. Use web fetch to resolve action SHAs for the v4 tags.',
  },
  {
    id: 'F1',
    model: undefined,
    files: ['web/answer-map.js', 'test/helpers/isolation.js', 'test/answer-map.test.js'],
    role: 'CREATE optionLabel(q,i) single guarded accessor (route mapAnswers/summaryText/isAnswered through it) + CREATE test/helpers/isolation.js withClean (Contract T). Critical #2/#3 via accessor; tree truncated-path via treeNodeAt/isLeaf single source; decideActivate multi stale-customText popup; isAnswered(ranking) bounds; ABSORB F2 stale-prone decisions as pure helpers (params in, no ref.current); fuzz/property tests (random+OOB never throw); setEnabled leak → withClean.',
  },
  {
    id: 'F2',
    model: undefined,
    files: ['web/app.js', 'web/live.js'],
    role: 'Contract R client side; delegate every stale-prone decision to F1 pure helpers (no ref.current in decisions) to satisfy exhaustive-deps; number-key type guard; binary bounds; double-submit inflight ref; CustomPopup stale-q guard + auto-dismiss; Enter-retry; postAnswers net-vs-server error split; SSE backoff+jitter+timeout; equality-guarded setRound; toast dismiss; aria-keyshortcuts; return-focus triggerRef.',
  },
  {
    id: 'F3',
    model: 'sonnet',
    files: ['web/views.js'],
    role: 'TreeCard confirmed:false reset; fullOptions cardinality on type-degrade; RankingCard stale-cursor ref; CustomPopup role=dialog/aria-modal/focus-trap; ~14 ARIA gaps (accordion aria-expanded, range label/valuetext, ranking role=listbox, tree role=tree, binary/single/multi aria-pressed, sidebar-search label, aria-current, progressbar role, show-unanswered switch, h1→h2 + sr-only h1); aria-hidden once inside the Check SVG.',
  },
  {
    id: 'F4a',
    model: 'sonnet',
    files: ['web/themes.js', 'test/themes.test.js'],
    role: 'amoled/aurora swatch↔token color fixes; swapFont document.head null-guard; tests: read() cascade, swapFont idempotency/null-font, USED_KEYS⊇KNOWN_TOKENS drift, surface-blur cleanup, token-syntax validation.',
  },
  {
    id: 'F4b',
    model: 'sonnet',
    files: ['web/settings-panel.js', 'web/settings-schema.js', 'web/ui-kit.js'],
    role: 'SettingsModal isSaving + Save-disable + AbortController on unmount; cancel-revert of in-flight live preview; double-save reentrancy guard; SettingRow aria-label; applyAll empty-catch→console.warn (browser).',
  },
];

// ---- Phase 0: ledger (the only full-report read) ----
phase('Ledger');
const LEDGER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'severity', 'file', 'title', 'type'],
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
          file: { type: 'string' },
          line: { type: ['integer', 'string'] },
          title: { type: 'string' },
          type: { type: 'string', enum: ['bug', 'verification'] },
        },
      },
    },
  },
};
const ledger = await agent(
  `Read ${REPORT} fully. Emit EVERY finding as a flat row. 'file' = the path in that finding's **Dosya:** block (normalize to repo-relative, e.g. server/server.js). type='verification' iff the finding text contains "dogrulama — bulgu degil", else 'bug'. id = the finding's number/label from the report. Do not group, do not summarize — one row per finding, all ~195.`,
  { label: 'ledger', phase: 'Ledger', model: 'sonnet', schema: LEDGER_SCHEMA }
);

log(
  `Ledger: ${ledger.findings.length} rows (${ledger.findings.filter((f) => f.type === 'verification').length} verification-only)`
);

// helper: ledger rows owned by a bundle
const rowsFor = (b) =>
  ledger.findings.filter((f) =>
    b.files.some(
      (p) =>
        (f.file && f.file.replace(/^\.?\/*/, '').endsWith(p.replace(/^test\//, 'test/'))) ||
        f.file === p ||
        (f.file && f.file.includes(p))
    )
  );

// ---- Phase 1: fix → review (pipeline, no barrier) ----
phase('Fix & Review');
const FIX_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['changed', 'findingsAddressed', 'notes'],
  properties: {
    changed: { type: 'array', items: { type: 'string' } },
    findingsAddressed: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
};
const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['perFinding', 'regressions'],
  properties: {
    perFinding: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'verdict', 'note'],
        properties: {
          id: { type: 'string' },
          verdict: {
            type: 'string',
            enum: ['fixed', 'partial', 'broken', 'verification-no-change'],
          },
          note: { type: 'string' },
        },
      },
    },
    regressions: { type: 'array', items: { type: 'string' } },
  },
};

const reviewed = await pipeline(
  BUNDLES,
  (b) =>
    agent(
      `${CONTRACTS}\n\nYou OWN exactly these files (create the ones marked CREATE): ${b.files.join(', ')}. Touch NO other file.\n` +
        `Step 1: grep "**Dosya:**" ${REPORT} and read ONLY the finding blocks whose Dosya path is one of your owned files.\n` +
        `Step 2: Fix EVERY one of those findings at production grade. Ponytail discipline: KISS/YAGNI/SOLID, reuse the consolidation primitives (optionLabel, validQuestions/validAnswers, writeFileAtomic, log, withClean), zero new runtime deps. Laziest correct seam wins. Mark deliberate simplifications with // ponytail:.\n` +
        `Step 3: Add the regression tests the report calls for to YOUR test files (node:test, no new frameworks). Cross-bundle primitives you import (lib/log.cjs, test/helpers/isolation.js) may not exist on disk yet — import them against their pinned Contract signature anyway; the integration gate guarantees they exist.\n` +
        `Bundle role: ${b.role}\n` +
        `Leave any "dogrulama — bulgu degil" finding unchanged. Return what you changed.`,
      { label: `fix:${b.id}`, phase: 'Fix & Review', model: b.model, schema: FIX_SCHEMA }
    ),
  (fix, b) =>
    agent(
      `Adversarial review of bundle ${b.id} (owned files: ${b.files.join(', ')}).\n` +
        `These are the audit ledger rows for this bundle (independent enumeration source — NOT from the fixer):\n${JSON.stringify(rowsFor(b))}\n\n` +
        `Run \`git diff -- ${b.files.join(' ')}\` and read the current state of those files. For EACH ledger row above: is it truly fixed, production-grade, with no regression? Verdict per row: fixed / partial / broken / verification-no-change (use the last only for "dogrulama — bulgu degil" rows). Also list any NEW issues/regressions the diff introduced. Be skeptical; default to partial/broken if not clearly fixed.`,
      { label: `review:${b.id}`, phase: 'Fix & Review', model: 'sonnet', schema: REVIEW_SCHEMA }
    )
);

const problems = reviewed
  .filter(Boolean)
  .flatMap((r, i) =>
    (r.perFinding || [])
      .filter((f) => f.verdict === 'partial' || f.verdict === 'broken')
      .map((f) => ({ bundle: BUNDLES[i].id, ...f }))
  );
log(`Review complete. ${problems.length} partial/broken findings flagged for repair.`);

// ---- Phase 2: integrate + self-heal (≤3) ----
phase('Integrate & self-heal');
const GATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['green', 'failures'],
  properties: {
    green: { type: 'boolean' },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'detail'],
        properties: {
          kind: {
            type: 'string',
            enum: ['test', 'lint', 'format', 'shellcheck', 'install', 'other'],
          },
          detail: { type: 'string' },
        },
      },
    },
  },
};
let green = false,
  attempt = 0,
  gate;
const reviewProblemsNote = problems.length
  ? `\nAlso address these reviewer-flagged partial/broken findings if still open: ${JSON.stringify(problems.slice(0, 40))}`
  : '';
while (!green && attempt < 3) {
  gate = await agent(
    `Integration gate. Run, in order, capturing failures:\n` +
      `1. npm install  (ensures B5's new devDeps resolve)\n` +
      `2. npm run format\n` +
      `3. npm run lint\n` +
      `4. npm test\n` +
      `5. shellcheck install.sh reinstall.sh  (skip gracefully if shellcheck not on PATH — report as a non-failing note, not a failure)\n` +
      `Return green=true ONLY if format+lint+test all pass. Provide structured per-failure detail (kind + concise actionable detail incl. file:line and the error).`,
    {
      label: `gate:${attempt}`,
      phase: 'Integrate & self-heal',
      model: 'sonnet',
      schema: GATE_SCHEMA,
    }
  );
  if (gate.green) {
    green = true;
    break;
  }
  await agent(
    `${CONTRACTS}\n\nThe integration gate is RED (attempt ${attempt + 1}/3). Failures:\n${JSON.stringify(gate.failures)}${attempt === 0 ? reviewProblemsNote : ''}\n\n` +
      `Fix the integration/contract breaks and any residual react-hooks exhaustive-deps / rules-of-hooks warnings. Minimal, production-grade, honor the pinned contracts. Do NOT mass-suppress lint (no blanket eslint-disable). If a primitive's contract was violated by a consumer, fix the consumer. Re-run the failing command yourself to confirm before returning.`,
    { label: `repair:${attempt}`, phase: 'Integrate & self-heal' }
  );
  attempt++;
}
log(
  `Gate ${green ? 'GREEN' : 'still RED after 3 attempts'} (attempts used: ${attempt + (green ? 0 : 0)})`
);

// ---- Phase 3: completeness (independent ledger walk) ----
phase('Completeness');
const ORPHAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rows'],
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'status'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['fixed', 'verification', 'orphan'] },
          evidence: { type: 'string' },
        },
      },
    },
  },
};
const critic = await agent(
  `Completeness critic. Here is the full audit ledger (${ledger.findings.length} rows):\n${JSON.stringify(ledger.findings)}\n\n` +
    `Walk EVERY row top-to-bottom. Against the final \`git diff\` (and current file contents), classify each row: 'fixed' (the change is present), 'verification' (row.type==='verification', no change expected), or 'orphan' (a real bug row with no corresponding change). ZERO blank rows — every id must get a status. List concrete evidence (file:line or diff hunk) for fixed; for orphan, the exact missing change.`,
  { label: 'critic', phase: 'Completeness', model: 'sonnet', schema: ORPHAN_SCHEMA }
);
const orphans = (critic.rows || []).filter((r) => r.status === 'orphan');
log(`Critic: ${critic.rows.length} rows walked, ${orphans.length} orphans.`);
if (orphans.length) {
  await agent(
    `${CONTRACTS}\n\nThese audit ledger rows were found ORPHAN (real bug, no fix in the diff). Fix each at production grade in its owning file, honoring the pinned contracts and zero-dep rule. Add/extend the regression test. Then re-run npm test to confirm green.\nOrphans:\n${JSON.stringify(orphans)}`,
    { label: 'repair:orphans', phase: 'Completeness' }
  );
}

// ---- Phase 4: smoke + axe (best-effort, non-blocking) ----
phase('Smoke');
const SMOKE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ran', 'consoleErrors', 'axeViolations', 'typesExercised', 'contractRok'],
  properties: {
    ran: { type: 'boolean' },
    consoleErrors: { type: 'array', items: { type: 'string' } },
    axeViolations: { type: 'array', items: { type: 'string' } },
    typesExercised: { type: 'array', items: { type: 'string' } },
    contractRok: { type: 'boolean' },
    note: { type: 'string' },
  },
};
let smoke = null;
try {
  smoke = await agent(
    `Chrome MCP smoke test (best-effort; if the claude-in-chrome browser tools are unavailable in this headless run, return ran=false with a note instead of failing). ` +
      `Load the chrome tools via ToolSearch first. Start the server: \`node server/server.js\` (port 4517) in the background. Open http://127.0.0.1:4517. ` +
      `Drive ONE round covering single/multi/binary/scale/ranking/tree question types + keyboard shortcuts (1-9, Enter, u, b, arrows). Submit and confirm it resolves over the wire (proves Contract R). ` +
      `Inject axe-core from CDN (https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js) and run axe.run(). Return console errors + axe violations + which types you exercised + contractRok. Kill the server when done.`,
    { label: 'smoke', phase: 'Smoke', model: 'sonnet', schema: SMOKE_SCHEMA }
  );
} catch (e) {
  log('Smoke phase skipped/failed (non-blocking).');
}

// ---- Phase 5: docs ----
phase('Docs');
const docs = await agent(
  `Surgically update docs for everything in the final \`git diff\`. Code-area→doc map: docs/api.md (/answer {id,answers} + 400/409, /settings 500), docs/backend.md (write→{ok}, validAnswers, atomic-write, log, id-ownership, shell hardening), docs/frontend.md (a11y, postAnswers(id), SSE backoff, pure-helper delegation), docs/testing.md (fuzz/wire/isolation helper), docs/tech-stack.md (shellcheck, SHA-pins, react-hooks lint, new devDeps), README.md (CLI error messages/troubleshooting). CREATE docs/hardening.md (CHANGELOG-style: the 5 themes A-E, the consolidation layer, the CI guards). Bump docs/README.md synced-commit hash if present. Touch ONLY affected sections — no rewrites.`,
  { label: 'docs', phase: 'Docs', model: 'sonnet' }
);

return {
  ledgerRows: ledger.findings.length,
  bundlesReviewed: reviewed.filter(Boolean).length,
  reviewProblems: problems.length,
  gateGreen: green,
  gateFailures: green ? [] : gate ? gate.failures : [],
  criticRows: critic.rows.length,
  orphans: orphans.length,
  smoke: smoke,
  docs: docs,
};
