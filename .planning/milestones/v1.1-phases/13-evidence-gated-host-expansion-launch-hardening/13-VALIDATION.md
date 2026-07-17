---
phase: 13-evidence-gated-host-expansion-launch-hardening
status: planned
---

# Phase 13 Nyquist validation map

| Wave | Plan/task | Automated validation | Expected evidence |
|---|---|---|---|
| 1 | 13-01 ledger | `node --test test/host-evidence-matrix.test.js` | All 12 candidate rows, status prerequisites, redaction, and ledger-to-card/matrix mapping pass. |
| 1 | 13-02 research/gates | `node --test test/host-research-integrity.test.js test/host-install-gates.test.js test/host-evidence-matrix.test.js` | Every candidate has a dated source record and no-install gate. |
| 2 | 13-03 OS/release | `node --test test/cross-platform-evidence.test.js test/release-gates.test.js test/package-boundary.test.js test/workflows-ci.test.js test/workflows-release.test.js` | OS parity, release commands, package boundary, and workflow ordering are validated. |
| 3 | 13-05 native lanes | `node --test test/native-os-evidence.test.js test/cross-platform-evidence.test.js test/host-evidence-matrix.test.js` | Native metadata/scenario rows fail closed; unavailable Linux/Windows are explicit. |
| 4 | 13-04 launch docs | `node --test test/docs-integrity.test.js test/host-evidence-matrix.test.js test/native-os-evidence.test.js` | User/maintainer docs remain linked and cannot promote unsupported evidence. |

## Required manual lanes

Native Linux and Windows execution remains an external handoff in this macOS workspace. Their rows must stay `Unavailable` until a maintainer records native OS metadata and the full scenario command set. WSL, emulation, or protocol discovery cannot satisfy QLT-01.
