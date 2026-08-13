---
status: resolved
trigger: >-
  macOS'ta AskUserQuestionsPro MCP stdio süreçleri istemci kapandıktan sonra PPID=1
  olarak yetim kalıyor ve yaklaşık yüzde 100 CPU tüketiyor; aktif süreçler korunarak
  kök neden düzeltilmeli.
created: 2026-08-11
updated: 2026-08-11
---

## Symptoms

- Expected: A per-client MCP stdio process exits after stdin EOF, transport failure, or a terminal signal; valid concurrent clients remain independent.
- Actual: PIDs 8023, 10096, 10303, and 10790 were PPID=1, alive for about 16:49-16:52, and consumed 98.5-122.1% CPU. Active child processes 30055, 32821, 60046, and 71980 were low CPU and were preserved.
- Error evidence: `sample` repeatedly showed `uv__run_check -> node::Environment::CheckImmediate -> TriggerUncaughtException`, followed by V8 error stack formatting.
- Timeline: All four runaway processes had started on 2026-08-10 and persisted until targeted SIGTERM on 2026-08-11.
- Reproduction hypothesis: Closed stdio output or input leaves the MCP entrypoint's uncaught exception handler alive; output/error handling and request/heartbeat resources are not connected to one terminal shutdown path.

## Current Focus

- hypothesis: A handled uncaught exception from a closed stdio stream is repeatedly logged while the MCP process remains alive because the entrypoint installs non-terminating process-level error handlers and does not own a terminal stdio shutdown path.
- test: Add subprocess lifecycle tests for EOF, SIGTERM/SIGINT, transport/output failure, and concurrent clients; verify bounded exit and no CPU spin.
- expecting: The current implementation fails at least one terminal lifecycle test or leaves a child alive after transport closure.
- next_action: complete; lifecycle, full test, lint, format, and host process verification finished.

## Evidence

- timestamp: 2026-08-11T15:16:00+03:00
  detail: `ps` found four exact AskUserQuestionsPro MCP commands with PPID=1, approximately 16 hours elapsed, and 98.2-100.2% CPU; four live MCP commands had non-1 parents and 0.0% CPU.
- timestamp: 2026-08-11T15:17:20+03:00
  detail: Per-PID `lsof` showed stdin/stdout/stderr pipes and `sample` showed the main thread spending nearly all samples in `uv_check`, `CheckImmediate`, `TriggerUncaughtException`, and V8 error stack formatting.
- timestamp: 2026-08-11T15:18:00+03:00
  detail: SIGTERM was sent individually to 8023, 10096, 10303, and 10790. They exited within three seconds; live PIDs 30055, 32821, 60046, and 71980 remained.
- timestamp: 2026-08-11T15:19:00+03:00
  detail: Workspace entrypoint matches installed entrypoint byte-for-byte. It registers `uncaughtException`/`unhandledRejection` handlers that only log, catches stdin EOF by aborting active requests, but has no idempotent process shutdown path or stdout error listener.
- timestamp: 2026-08-11T15:40:00+03:00
  detail: The new EPIPE regression test failed before the fix because the MCP process stayed alive for 1000ms after stdout was destroyed; it passes after the idempotent shutdown implementation.
- timestamp: 2026-08-11T15:50:00+03:00
  detail: Final process check shows only live MCP children with non-1 parents and 0.0% CPU: 30055, 32821, 60046, 71980. The four former PPID=1 runaway PIDs are absent.

## Eliminated

- hypothesis: Docker, Conductor, OkuAI/Dallas, n8n, or database workloads caused the four-core anomaly.
  reason: The incident scope and process snapshot identify four exact AskUserQuestionsPro MCP processes as the high-CPU consumers; those services were explicitly untouched.

## Resolution

- root_cause: >-
    The MCP entrypoint installed process-level `uncaughtException` and
    `unhandledRejection` handlers that only logged and kept Node alive. A
    closed stdio output pipe could therefore emit repeated asynchronous
    write errors; the process stayed alive with its active request/transport
    handles and repeatedly formatted/logged the same errors in
    `uv_check/CheckImmediate`, producing the observed CPU spin. Stdin EOF
    only aborted active requests and did not define one terminal lifecycle
    path for all transport and process shutdown cases.
- fix: >-
    `mcp-server/askuserquestionspro-mcp.mjs` now owns one idempotent shutdown
    path. It tracks active tasks, aborts active requests, pauses stdin, handles
    stdin EOF/close/error, stdout error/close, SIGTERM/SIGINT/SIGHUP, and fatal
    process errors, suppresses writes after transport closure, waits briefly
    for cleanup, and force-exits within a bounded deadline. Startup, PID/PPID,
    transport connection/closure, and shutdown start/end are stderr-only
    diagnostics. `package-lock.json` root metadata now matches the existing
    package.json 1.3.0 release metadata.
- verification: >-
    `node --test test/mcp-lifecycle.test.js test/mcp-long-round.test.js` passed
    12/12; `npm run lint`, `npm run format:check`, and `npm test` passed
    (554 tests, 553 passed, 1 skipped). Before cleanup, four exact orphan MCP
    PIDs used 98.2-100.2% CPU (one sample reached 122.1%); after cleanup those
    PIDs were gone and the four active MCP children remained at 0.0% CPU.
- files_changed: mcp-server/askuserquestionspro-mcp.mjs, test/mcp-lifecycle.test.js, package-lock.json
