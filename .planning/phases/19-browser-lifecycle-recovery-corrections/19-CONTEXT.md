# Phase 19: Browser Lifecycle and Recovery Corrections - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the two existing browser regressions: a successfully submitted question round must not be rendered by both an old and a new tab, and recovery UI must appear only for an interrupted or delivery-uncertain round with clear user-facing actions. Preserve the existing localhost bridge, exact-round recovery, host contracts, and current question flow.

</domain>

<decisions>
## Implementation Decisions

### Tab lifecycle

- **D-01:** Preserve the existing closure setting, but make automatic close the default after successful delivery acknowledgement. An explicit user setting that disables closure remains respected.
- **D-02:** The old tab must retire from future round updates at submit time, before a later SSE snapshot can remount the completed flow. Acknowledgement remains the delivery boundary for final close handling.
- **D-03:** If the browser rejects `window.close()`, leave the tab in a quiet passive waiting state. Do not show a technical warning or ask the user to troubleshoot browser permissions in the normal flow.
- **D-04:** The completed tab must remain permanently ineligible to render later rounds even when physical close is denied.

### Recovery lifecycle and scope

- **D-05:** Successfully delivered terminal rounds must never appear in the recovery chooser.
- **D-06:** Show recovery UI only for an actual host/browser interruption or an uncertain delivery result. Ordinary SSE reconnects and normal successful completion must not open a recovery prompt.
- **D-07:** After normal successful delivery, show no success/recovery panel; close directly according to the closure setting.
- **D-08:** A real recovery surface may offer: continue the exact round, delete/cancel the retained round, or start a new round. Do not make technical state details an action or primary user-facing choice.

### Copy and information hierarchy

- **D-09:** Recovery messages use a simple human-language heading and explanation. Technical state/details may appear in a small secondary treatment, not as the primary copy.
- **D-10:** The recovery flow should explain what happened and what each action does without exposing question/answer payloads or requiring the user to understand bridge internals.

### the agent's Discretion

- Exact wording, typography, and placement of the small technical state detail.
- Whether “start a new round” is a separate recovery button or a clearly equivalent dismiss/start path, as long as it does not silently discard the retained round.
- The precise internal gate/ownership mechanism used to retire the tab, provided submit-time retirement and acknowledgement-time closure are both enforced.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements

- `.planning/ROADMAP.md` — Phase 19 goal and success criteria.
- `.planning/REQUIREMENTS.md` — TAB-01/TAB-02 and REC-01/REC-02 requirements.
- `.planning/phases/19-browser-lifecycle-recovery-corrections/19-01-PLAN.md` — existing implementation plan and root-cause evidence; replan it after this context is incorporated.

### Architecture and conventions

- `.planning/codebase/ARCHITECTURE.md` — bridge, SSE, browser, and delivery data flow.
- `.planning/codebase/STACK.md` — Node/browser runtime and zero-production-dependency constraints.
- `.planning/codebase/CONVENTIONS.md` — lifecycle race guards, accessibility, testing, and formatting conventions.

### Runtime and browser integration points

- `server/bridge.js` — single-flight round ownership, lifecycle transitions, and durable record selection.
- `server/server.js` — localhost HTTP/SSE routes and browser recovery endpoints.
- `lib/round-state.cjs` — canonical lifecycle state names and transitions.
- `web/live.js` — SSE subscription, reconnect behavior, answer delivery, acknowledgement, and close helper.
- `web/app.js` — round ownership, submit/ack flow, recovery selection, and delivery UI wiring.
- `web/views.js` — recovery chooser and delivery-panel copy/actions.
- `docs/api.md` — maintained bridge and recovery contract documentation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `Bridge` in `server/bridge.js`: already owns one active round and durable lifecycle transitions; recovery filtering should remain a bridge-level policy.
- `useLiveQuestions` in `web/live.js`: owns the EventSource and reconnect loop; the tab-retirement guard belongs at this live subscription boundary.
- `attemptClose`, `acknowledgeDelivery`, and `deliveryTransition` in `web/live.js`: existing seams for close denial, acknowledgement, and uncertain delivery behavior.
- `RecoveryChooser` and `DeliveryPanel` in `web/views.js`: existing accessible surfaces to simplify and clarify rather than introduce a new recovery system.

### Established Patterns

- Round identity and capability are required for answer/draft/ack operations; stale round responses must not resolve a later round.
- The browser treats server answers as opaque and recovery selection is exact-round based; no question or answer payload belongs in recovery metadata or diagnostics.
- Expected recovery outcomes use explicit state/result objects; unexpected local failures throw at boundaries and are logged through existing project conventions.
- Browser UI changes must preserve ARIA dialog/focus semantics and native keyboard behavior.

### Integration Points

- `POST /answer` and `POST /rounds/:roundId/ack` define the submit and acknowledgement boundary.
- `GET /events` can deliver a later round to any still-connected tab, so tab retirement must gate both message handling and reconnect scheduling.
- `GET /rounds` feeds the recovery chooser; terminal delivered records must be excluded while interrupted and uncertain records remain selectable.

</code_context>

<specifics>
## Specific Ideas

- Kullanıcının önceliği normal başarılı akışın tamamen sessiz olması: cevap gönderilir, acknowledgement alınır, sekme kapanır; recovery açıklaması araya girmez.
- Kapanma reddedilirse kullanıcıya teknik uyarı göstermek yerine eski sekme pasif bırakılmalı ve yeni round’u dinlememeli.
- Recovery metni sade bir başlıkla başlamalı; teknik state bilgisi yalnızca küçük ikincil metin olarak bulunabilir.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 19 scope.

</deferred>

---

*Phase: 19-browser-lifecycle-recovery-corrections*
*Context gathered: 2026-07-19*
