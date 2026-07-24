# Phase 19: Browser Lifecycle and Recovery Corrections - Pattern Map

**Mapped:** 2026-07-19  
**Files analyzed:** 17 expected modified files across the two executable plans  
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/bridge.js` | service/coordinator | event-driven + request-response | `lib/round-store.cjs` `recoverable()` and existing `Bridge` lifecycle methods | exact lifecycle match |
| `server/server.js` | HTTP/SSE boundary | request-response + streaming | existing `/rounds`, `/current`, `/events`, and `/cancel` route seams | exact boundary match |
| `lib/round-store.cjs` | private persistence | request-response + transform | existing `_file()`, `_records`, `mutate()`, and `cleanupExpired()` primitives | exact persistence match |
| `web/live.js` | hook/transport utility | streaming + request-response | existing `useLiveQuestions()` generation/reconnect loop | exact |
| `web/app.js` | component/state machine | event-driven + request-response | existing `Flow.submit()` and `App` recovery hydration | exact |
| `web/views.js` | component/presentation | request-response UI | existing `RecoveryChooser`, `DeliveryPanel`, and `useModalFocus` | exact |
| `web/styles.css` | config/presentation | transform/render | existing `.app--waiting`, `.btn`, `.recovery-*`, responsive and motion rules | exact |
| `web/settings-schema.js` | config/contract | transform/normalization | existing v2 envelope defaults, matrix, and validation | exact |
| `docs/api.md` | config/documentation | request-response contract | existing durable recovery and final-delivery contract | role match |
| `test/live.test.js` | test | streaming + request-response | existing transport, delivery transition, and close tests | exact |
| `test/app-state.test.js` | test | transform/source contract | existing source-contract assertions for app state | exact |
| `test/views-a11y-recovery.test.js` | test | request-response UI | existing dialog/live-region assertions | exact |
| `test/views-a11y.test.js` | test | request-response UI | existing keyboard/ARIA source assertions | exact |
| `test/browser-recovery-e2e.test.js` | test | streaming + UI integration | existing browser recovery shell/redaction contract | exact |
| `test/settings-schema.test.js` | test | transform/normalization | existing envelope/default/migration tests | exact |
| `test/server.test.js` | test | request-response + streaming | existing `/rounds`, `/events`, ack, detached, and uncertain-delivery tests | exact |
| `test/bridge.test.js` | test | event-driven lifecycle | existing durable persistence, uncertain delivery, and resume tests | exact |

No new application files are implied. `lib/round-state.cjs` is an inspected supporting contract for canonical states and transitions. `web/ui-kit.js`, `web/themes.js`, and `web/answer-map.js` are explicitly reuse/no-change surfaces under the approved UI contract. The two plans intentionally edit `server/server.js` and `lib/round-store.cjs`: the former owns the thin exact-delete HTTP/SSE boundary, and the latter owns the private exact-record removal primitive; filtering remains in Bridge rather than in the route.

## Pattern Assignments

### `server/bridge.js` (service/coordinator, event-driven + request-response)

**Analog:** `lib/round-store.cjs` `recoverable()` plus the existing `Bridge` transition/ownership methods.

**Imports and lifecycle contract** (`server/bridge.js:3-6`):

```js
const { randomBytes } = require('node:crypto');
const { createRecord, transition, snapshot } = require('../lib/round-state.cjs');
const Record = require('../lib/round-record.cjs');
const { deliveryPolicy, closurePolicy } = require('../lib/runtime-settings.cjs');
```

Keep lifecycle policy in the bridge and use the canonical `transition`/`Record` APIs. Do not filter in the browser alone: `/rounds` is a bridge-owned recovery policy.

**Existing hydration filter** (`server/bridge.js:68-72`):

```js
_hydrateUniqueRecovery() {
  if (!this._store) return;
  const records = this._store.recoverable();
  if (records.length === 1) this._hydrate(records[0]);
}
```

**Closest filtering rule** (`lib/round-store.cjs:90-100`):

```js
list() {
  return [...this._records.values()].filter((r) => r.expiresAt > this.now()).map(Record.metadata);
}
recoverable() {
  return [...this._records.values()].filter(
    (record) =>
      record.expiresAt > this.now() &&
      !record.answers &&
      ['drafting', 'detached', 'reconnecting'].includes(record.lifecycle.state)
  );
}
```

The new `listRecoverable()` policy should preserve redacted `Record.metadata` and retain records with immutable answers only when their state is genuinely recovery-selectable (`delivery-uncertain`), while excluding terminal `delivered` records. Preserve expiry checks and exact-round identity.

**Ownership and transition pattern** (`server/bridge.js:213-257`):

```js
_owns(p, expectedId, capability) {
  return (
    !!p &&
    (expectedId == null || p.id === expectedId) &&
    (capability == null || p.record.capability === capability)
  );
}

provideAnswers(id, answers, capability) {
  if (!this._owns(this._pending, id, capability)) return false;
  const p = this._pending;
  // persist immutable result, transition, then clear active pending state
  if (!this._transition(p, 'answerAccepted')) return false;
  this._pending = null;
  this._rememberDelivery(p, answers);
  this._lastSnapshot = snapshot(p.record);
  p.resolve(answers);
  for (const waiter of p.waiters) waiter.resolve(answers);
  return true;
}
```

Use the same id/capability guard and idempotent lifecycle transitions for recovery filtering; do not expose answers or capabilities in the chooser metadata.

**Delivery boundary** (`server/bridge.js:376-431`):

`confirmDelivery()` persists `Record.acknowledge`, transitions the in-memory record to `delivered`, updates `_lastSnapshot`, and removes the delivery from the pending delivery map. `markDeliveryUncertain()` persists the uncertain state and leaves the result available. These are the authoritative terminal/uncertain distinctions the browser must consume.

### `web/live.js` (hook/transport utility, streaming + request-response)

**Analog:** current `useLiveQuestions()` (`web/live.js:17-84`).

**Imports/global convention** (`web/live.js:1-5`):

```js
/* global React */
const _React = typeof React !== 'undefined' ? React : {};
const { useState: useStateLive, useEffect: useEffectLive, useRef: useRefLive } = _React;
```

Keep the browser-global/CommonJS dual-use style; expose any pure acceptance/retirement seam through the existing `module.exports` block rather than introducing a build step.

**Existing generation guard** (`web/live.js:27-82`):

```js
let closed = false;
let generation = 0;
const connect = () => {
  const currentGeneration = ++generation;
  const source = new EventSource('/events');
  source.onmessage = (e) => {
    if (closed || currentGeneration !== generation) return;
    // parse and merge the snapshot
    setRound((prev) => (prev.id === next.id ? { ...prev, ...next } : next));
  };
  source.onerror = () => {
    if (closed || currentGeneration !== generation) return;
    source.close();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!closed && currentGeneration === generation) connect();
    }, delay);
  };
};
```

Extend this boundary with a permanent per-tab retirement flag/generation invalidation. Retirement must gate `onmessage`, `onerror`, reconnect timers, and later snapshots. A browser-denied close must not unset retirement or allow a new `Flow` mount.

**Existing transport/error patterns** (`web/live.js:86-120`, `148-221`):

- `responseError()` preserves HTTP status, `reason`, and `roundId` for state decisions.
- `postAnswers()` uses an `AbortController` and a 10-second deadline, throwing server errors with `err.server = true`.
- `getRecoverableRounds()` converts network/invalid response failures into `RecoveryError` with human-safe copy.
- `acknowledgeDelivery()` calls the exact durable route and returns `{ ...body, state: 'delivered', acknowledged: true }`; failed acknowledgement is uncertain, not a close signal.

**Close and delivery helpers** (`web/live.js:206-253`):

```js
function attemptClose(close = typeof window !== 'undefined' ? window.close.bind(window) : null) {
  if (typeof close !== 'function') return { closed: false, denied: true };
  try {
    close();
    return { closed: true, denied: false };
  } catch {
    return { closed: false, denied: true };
  }
}
```

Preserve this result-object pattern. `deliveryTransition()` already maps pending timeout/network failure to `delivery-uncertain` and acknowledgement to `delivered`; ordinary SSE reconnect must not enter recovery.

### `web/app.js` (component/state machine, event-driven + request-response)

**Analog:** current `App` recovery hydration and `Flow.submit()` (`web/app.js:37-112`, `410-484`).

**v2 boot/legacy compatibility** (`web/app.js:7-20`):

```js
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
```

The closure setting lives in the v2 envelope, while `browserToLegacy()` only projects browser fields (`web/settings-schema.js:538-546`). Preserve v1 compatibility but read the v2 closure value for lifecycle decisions; do not invent a second setting key.

**Recovery discovery and exact selection** (`web/app.js:52-108`):

```js
useEffect(() => {
  if (id != null || typeof getRecoverableRounds !== 'function') return undefined;
  getRecoverableRounds()
    .then(setRecoverableRounds)
    .catch((error) => setRecoveryError(error.message));
  return undefined;
}, [id]);

const chooseRecovery = (round) => {
  setRecoveryError(null);
  setSelectedRecovery(round);
  selectRecoveryRound(round).catch((error) => setRecoveryError(error.message));
};
```

Keep recovery discovery only in the waiting/eligible state. Terminal delivered records should already be filtered by the bridge, with a defensive browser-side state check if needed. Selection must carry the chosen `roundId`/`requestId`; never infer newest.

**Submit/ack sequencing** (`web/app.js:410-464`):

```js
if (ref.current.submitted || inflight.current) return;
setSubmitted(true);
setDeliveryState('delivery-pending');
inflight.current = true;
postAnswers(roundId, mapped, capability)
  .then(() => acknowledgeDelivery(durableRoundId, capability))
  .then(() => {
    setDeliveryState('delivered');
    // close only after acknowledgement
  })
  .catch(() => setDeliveryState('delivery-uncertain'));
```

Add the live retirement call immediately after submit is accepted and before any later snapshot can remount the completed flow. Keep the form locked and show only the quiet pending status. On successful acknowledgement, close according to the v2/default closure mode; on denied close, render the passive retired state. On acknowledgement/network uncertainty, do not close and route to the three-action recovery surface.

**Existing retry seam** (`web/app.js:466-484`) is the pattern for exact acknowledgement retry: guard missing durable identity/capability and `inflight`, set pending, call `acknowledgeDelivery`, then settle delivered/uncertain and clear the guard in `finally`.

**Current render seams to simplify** (`web/app.js:639-651`):

```jsx
{submitted && <div className="toast" role="status" aria-live="polite">...</div>}
<DeliveryPanel state={deliveryState} closeDenied={closeDenied} onRetry={retryAcknowledgement} />
```

Replace normal-success toast/panel output with the contract’s quiet pending inline status and direct post-ack close/retired behavior. Preserve conflict reconciliation separately.

### `web/views.js` (component/presentation, request-response UI)

**Analog:** current modal and recovery components (`web/views.js:10-189`).

**Focus/keyboard pattern** (`web/views.js:10-46`):

```js
function useModalFocus(ref, onEscape) {
  const restoreRef = useRefView(null);
  useEffectView(() => {
    restoreRef.current = document.activeElement;
    ref.current?.focus();
    // Escape dismissal and Tab cycling stay inside the dialog
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [onEscape, ref]);
}
```

Reuse this hook for recovery and destructive confirmation. Escape may dismiss the chooser/confirmation but must never silently delete a retained round.

**Current chooser structure** (`web/views.js:48-95`):

```jsx
<div
  className="recovery-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="recovery-title"
  aria-describedby="recovery-description"
>
  <div className="recovery-panel">
    <h2 id="recovery-title" tabIndex="-1" ref={titleRef}>...</h2>
    <p id="recovery-description">...</p>
    <div className="recovery-list">...</div>
  </div>
</div>
```

Retain the labelled dialog, exact selector keys, native `button type="button"`, focus trap, and restore-focus behavior. Change the current technical heading, `Retry recovery`, and `Continue without recovery` actions to the approved human copy and exactly three actions: `Continue this exact round`, `Cancel/Delete it` with confirmation, and `Start a new round`. Selected state must be announced with `aria-pressed` or an equivalent pattern; action row stays unavailable until an exact record is selected.

**Current delivery surface to replace** (`web/views.js:132-187`):

`DeliveryPanel` currently exposes a success panel, retry acknowledgement, and a `role="alert"` close-denied warning. Preserve `role="status" aria-live="polite"` for pending/uncertain status, but remove normal-success recovery copy and turn close denial into the passive, non-alert complete state required by the UI contract.

**Waiting analog** (`web/views.js:213-229`) already renders a one-column waiting shell. Update its body to the approved English empty-state copy while keeping the existing `.qcard`/`.stage` structure.

### `web/styles.css` (config/presentation, transform/render)

**Analog:** existing shell and recovery rules (`web/styles.css:93-109`, `1902-1958`).

**Shell and waiting layout** (`web/styles.css:93-109`):

```css
.app {
  height: 100%;
  display: grid;
  grid-template-columns: clamp(330px, 24vw, 416px) 1fr;
  background: var(--bg);
}
.app--waiting {
  grid-template-columns: 1fr;
}
```

Add `.app--retired` as a quiet centered single-column state using existing background/theme tokens, with wrapped copy and no fixed height that clips localized text.

**Button hierarchy** (`web/styles.css:697-760`): preserve `.btn`, `.btn--primary`, and `.btn--danger`; use accent only for continue/primary, existing danger treatment only for delete, and a neutral secondary style for start-new-round.

**Recovery panel/list** (`web/styles.css:1902-1958`):

```css
.recovery-overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(0 0 0 / 58%);
}
.recovery-panel,
.delivery-panel {
  width: min(620px, 100%);
  max-height: min(760px, calc(100vh - 48px));
  overflow: auto;
  padding: 28px;
  background: var(--panel);
}
.recovery-list,
.recovery-actions {
  display: grid;
  gap: 12px;
}
```

Extend these existing rules for 16px contract gaps, 44px controls, stacked mobile actions at `max-width: 760px`, wrapped long labels, and compact secondary metadata. Do not add gradients, fonts, colors, or a second overlay model. Preserve the existing `prefers-reduced-motion` and `[data-reduce-motion='true']` rules (`web/styles.css:1387-1395`, `1895-1897`).

### `web/settings-schema.js` (config/contract, transform/normalization)

**Analog:** v2 namespace and field metadata (`web/settings-schema.js:395-430`).

```js
var NAMESPACE_DEFAULTS = {
  // ...
  delivery: { mode: 'auto', retryMs: 1000 },
  closure: { mode: 'never' },
};
var FIELD_META = [
  ['delivery.mode', 'select', 'auto', ['auto', 'confirm'], 'runtime', 'live'],
  ['closure.mode', 'select', 'never', ['never', 'after-delivery'], 'runtime', 'lifecycle'],
];
```

Change only the closure defaults from `never` to `after-delivery`; preserve `never` and `after-delivery` as the existing options, field owner/effect, namespace shape, and validation behavior. `envelopeDefaults()` clones namespace defaults (`web/settings-schema.js:467-477`), and `validateEnvelope()` preserves valid explicit choices while falling back to the schema default (`web/settings-schema.js:547-568`); tests should target those public methods.

### `docs/api.md` (documentation/config, request-response contract)

**Analog:** existing durable recovery/final-delivery contract (`docs/api.md:41-70`).

Preserve the established redaction and exact-selector language:

```md
`GET /rounds` returns redacted metadata ... it never returns question text,
answers, capabilities, paths, or recovery diagnostics.
```

Update the contract to state that `/rounds` excludes terminal `delivered` records, retains genuinely recoverable interrupted/detached and uncertain records, and that ordinary SSE reconnect/normal acknowledgement never opens recovery. Document submit-time browser retirement and acknowledgement-time close, including passive behavior when `window.close()` is denied. Keep the existing two-step `delivery-pending` → `ack` → `delivered` and uncertain-delivery semantics.

### `test/live.test.js` (test, streaming + request-response)

**Analog:** existing mocked-fetch and pure helper tests (`test/live.test.js:18-25`, `131-186`).

```js
function withFetch(t, impl) {
  const prev = global.fetch;
  global.fetch = impl;
  t.after(() => {
    global.fetch = prev;
  });
}
```

Add pure tests beside `reconnectDelay`, `deliveryTransition`, and `attemptClose` for live-round acceptance/retirement: same round remains accepted, a different round is rejected after retirement, old generation callbacks do nothing, and a retired tab schedules no reconnect. Extend the existing denied-close and uncertain-delivery tests to assert result objects and sequencing, without requiring a DOM.

### `test/app-state.test.js` (test, source-contract transform)

**Analog:** source-string assertions (`test/app-state.test.js:8-31`).

Continue reading `web/app.js` with `fs.readFileSync` and use focused `assert.match`/`assert.doesNotMatch` checks. Cover the submit-time retirement call, pending `Sending answers…` state, acknowledgement-before-close ordering, v2 closure read/default and explicit `never`, no normal success toast/panel, uncertain/interrupted recovery routing, and no delivered recovery state. Keep the existing stale-round retry guard assertions.

### `test/views-a11y-recovery.test.js` (test, request-response UI)

**Analog:** existing dialog/live-region assertions (`test/views-a11y-recovery.test.js:22-28`).

```js
assert.match(views, /role="dialog"[\s\S]{0,80}aria-modal="true"/);
assert.match(views, /aria-live="polite"/);
```

Extend with assertions for unique labelled/described dialog, selected exact-round state, `button type="button"`, the three exact action labels, destructive confirmation copy, `role="status"` pending/uncertain text, and passive close-denied copy with no `role="alert"` technical warning.

### `test/views-a11y.test.js` (test, request-response UI)

**Analog:** existing function-body and keyboard semantic assertions (`test/views-a11y.test.js:18-57`).

Preserve the current `fnBody()`/regex style for localized view semantics. Add regression checks for recovery action button types, `aria-pressed`/selection labeling, focus-trap hook usage, and unchanged question/sidebar keyboard semantics. Do not inspect answer payloads in recovery assertions.

### `test/browser-recovery-e2e.test.js` (test, streaming + UI integration)

**Analog:** current cross-file source contract (`test/browser-recovery-e2e.test.js:8-32`).

Keep this as the integration-level contract over `app.js`, `views.js`, `live.js`, and `styles.css`. Add checks for active two-column versus waiting/retired one-column shells, no recovery on normal completion or reconnect, exact three recovery labels, redacted metadata, disabled-until-selected actions, and responsive/reduced-motion selectors. Retain the existing no-payload assertion.

### `test/settings-schema.test.js` (test, transform/normalization)

**Analog:** public v2 envelope tests (`test/settings-schema.test.js:11-73`).

Add a focused test using `Schema.envelopeDefaults()`, `Schema.validateEnvelope()`, and/or `Schema.inspectEnvelope()` that fresh v2 defaults contain `closure.mode === 'after-delivery'`, explicit `never` remains valid/preserved, and invalid closure values fall back to `after-delivery`. Do not mutate private schema structures.

### `test/server.test.js` (test, request-response + streaming)

**Analog:** existing durable discovery/ack test (`test/server.test.js:170-201`) and uncertain recovery tests (`test/server.test.js:514-576`).

The existing confirm-delivery test currently expects `/rounds` to contain a delivered record (`test/server.test.js:111-168`); update that expectation to assert terminal delivery is excluded. Add/extend a test that creates delivered plus interrupted/uncertain records and asserts only recoverable metadata is listed, with question text absent. Preserve the exact result/ack idempotency checks and detached/uncertain `/resume` coverage.

Use the server route as the thin boundary analog (`server/server.js:260-262`):

```js
if (req.method === 'GET' && url === '/rounds') {
  return sendJson(res, 200, { rounds: bridge.listRecoverable() });
}
```

No new filtering logic belongs in the HTTP route unless required to preserve the bridge policy.

### `test/bridge.test.js` (test, event-driven lifecycle)

**Analog:** durable persistence and lifecycle tests (`test/bridge.test.js:10-24`, `414-428`).

Reuse temporary `RoundStore` roots and the existing `Bridge` API. Add a direct `listRecoverable()` test with drafting/detached/reconnecting, delivery-uncertain, and delivered records; assert uncertain/interrupted records remain and delivered does not. Preserve capability/round identity, immutable answer replay, and idempotent `confirmDelivery()` assertions.

## Shared Patterns

### Exact-round ownership and opaque metadata

**Sources:** `server/bridge.js:107-127`, `213-235`; `server/server.js:264-279`; `web/live.js:174-204`; `docs/api.md:43-62`.

Every answer, draft, resume, result, and acknowledgement operation carries exact round identity and capability where required. Recovery UI receives only `roundId`/request selector, lifecycle state, timestamps, expiry, revision, and question count. Never render question text, answers, capabilities, filesystem paths, or raw diagnostics.

### Submit/acknowledge/uncertain state machine

**Sources:** `web/live.js:206-253`; `web/app.js:410-484`; `server/bridge.js:376-441`; `server/server.js:300-314`, `457-464`; `lib/round-state.cjs:25-56`.

Use this sequence:

```text
active -> submit/retire -> delivery-pending
delivery-pending + ack -> delivered -> close attempt
delivery-pending + timeout/network -> delivery-uncertain -> exact recovery
```

Only acknowledgement is the final close boundary. Close denial is a passive terminal UI state; it is not recovery or an error. Ordinary SSE reconnect is transport-only and silent.

### SSE generation and retirement guards

**Source:** `web/live.js:33-81`.

The existing `closed` + `generation` checks protect stale EventSource callbacks and reconnect timers. Add permanent retirement to the same boundary so a physically open completed tab cannot accept a later snapshot or begin a new reconnect generation.

### Accessible modal and focus ownership

**Source:** `web/views.js:10-46`, `48-95`; verified by `test/views-a11y-recovery.test.js:22-28`.

Keep `role="dialog"`, `aria-modal`, labelled/described heading/body, initial focus, Tab trap, Escape handling, and return focus. Destructive confirmation must have an explicit non-destructive escape and must not delete on Escape.

### Theme-token and responsive styling

**Source:** `web/styles.css:697-760`, `973-1043`, `1387-1395`, `1902-1958`.

Use existing `var(--bg)`, `var(--surface-1/2/3)`, `var(--panel)`, `var(--accent)`, border, danger, focus, and reduced-motion rules. Keep recovery panels viewport-bounded and internally scrollable; stack actions on mobile with 44px minimum targets and wrapped labels.

### v2 settings with legacy browser projection

**Sources:** `web/settings-schema.js:467-477`, `538-568`; `server/server.js:222-229`; `web/settings-panel.js:460-493`; `web/app.js:7-20`.

The v2 envelope is canonical. The flat browser object remains a compatibility projection and does not carry runtime `closure.mode`; lifecycle code must read the v2 envelope while preserving the flat projection for existing consumers.

## Supporting Contracts Inspected (No Edit Expected)

| File | Existing pattern to preserve |
|---|---|
| `lib/round-state.cjs:3-56` | Canonical states and legal transitions; do not add a parallel lifecycle vocabulary. |
| `web/ui-kit.js` | Existing inline `Check`/`Brand` helpers only; no new icon dependency. |
| `web/themes.js` | Existing `KNOWN_TOKENS`/theme application remains the source for AMOLED, Paper, Phosphor, Dusk, Aurora, and high-contrast themes. |
| `web/answer-map.js` | Answer mapping remains opaque and question-type behavior is unchanged. |

## No Analog Found

None for the expected modified files. The phase is a correction of existing lifecycle, recovery, and UI seams. No new event bus, persistence model, component library, or browser integration should be introduced.

## Metadata

**Analog search scope:** `server/`, `lib/`, `web/`, `docs/`, and focused files under `test/`  
**Files scanned:** 28 source, contract, and test files  
**Pattern extraction date:** 2026-07-19
