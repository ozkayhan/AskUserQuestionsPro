# Settings v2 browser evidence

| Check                        | Result       |
| ---------------------------- | ------------ |
| Keyboard isolation           | PASS         |
| Focus trap and return        | PASS         |
| Reload persistence           | PASS         |
| 320px / desktop overflow     | PASS         |
| Contrast / high contrast     | PASS         |
| Reduced motion               | PASS         |
| Future-version import        | PASS         |
| Validation rollback          | PASS         |
| Host adapter live acceptance | MANUAL CHECK |

Run: `node --test test/browser-settings-e2e.test.js`
Artifacts: `test/artifacts/settings-v2/`.
