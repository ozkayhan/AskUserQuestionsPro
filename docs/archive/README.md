# Historical archive

These files are retained for provenance, not as current implementation plans.
The maintained decisions and evidence extracted from them live in
[`../decisions.md`](../decisions.md), [`../hardening.md`](../hardening.md), and
[`../timeout-runbook.md`](../timeout-runbook.md).

| Archive file | Disposition |
| --- | --- |
| `audit-report-legacy.md` | Original 195-finding audit; retained as evidence of the remediation baseline. |
| `hardening-plan-v2.md` | Canonical historical plan; its Contracts R/W/L/T and do-not-touch rule are extracted into `decisions.md`. |
| `hardening-plan-dynamic.md` | Duplicate/earlier execution plan; retained because it records bundle ownership and verification strategy. |
| `audit-workflow-spec.md` | Proposed dynamic audit workflow; no longer executable project process. |
| `code-review-workflow-spec.md` | Superseded review workflow; retained for historical context only. |
| `hardening-workflow-spec.js` | Historical workflow-tool script; not a runtime entrypoint and excluded from lint/package scope. |

Removed during consolidation:

- `docs/old/todos.md` was empty.
- Root `planv2.md` was an exact duplicate of the archived `hardening-plan-v2.md`.
- The `docs/old/` directory was removed so there is one unambiguous archive path.
