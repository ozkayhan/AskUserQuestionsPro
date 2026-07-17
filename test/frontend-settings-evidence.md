# Settings v2 browser evidence

Run `npm run serve`, open `http://127.0.0.1:4517/`, and use Playwright CLI.

| Scenario | Result | Evidence protocol |
|---|---|---|
| Settings FAB opens labelled dialog | PASS (source + existing a11y tests) | Verify `role=dialog`, labelled heading, and Escape close. |
| Active-round shortcuts are isolated | MANUAL CHECK | Start a round, open Settings, press Enter/arrows/number/B/U; round state must not change. |
| Preview/import is non-mutating | PASS (HTTP contract) | POST `/settings/preview`; compare exported bytes before/after. |
| Future-version import | PASS (schema contract) | Preview `test/fixtures/settings-future.json`; Apply must be unavailable. |
| Reload persistence | MANUAL CHECK | Save a setting, reload, confirm the value remains. |
| Narrow viewport/contrast/reduced motion | MANUAL CHECK | Playwright viewports 320px/1280px; inspect overflow and focus ring. |

The automated evidence is intentionally dependency-free; manual rows are the remaining human-only browser checks.
