# Refactor Parity Contract

This manifest is the maintained source contract for the Pass 0–5 backend
refactor. It names the boundaries that structural changes must preserve; it
does not authorize lifecycle behavior changes.

| Boundary             | Contract                                                                                                                                                                                                                                                | Source of truth                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Package entry points | The published CLI remains `askuserquestionspro` → `bin/cli.js`; the stdio MCP entry remains `askuserquestionspro-mcp` → `mcp-server/askuserquestionspro-mcp.mjs`.                                                                                       | `package.json`                                                                                                         |
| Local HTTP boundary  | The bridge listens only on `127.0.0.1`. `server.requestTimeout = 0` leaves the open `/ask` and `/resume` request deadline to the application/client; a host can still impose its own deadline.                                                          | `server/server.js`, `lib/bridge-client.mjs`                                                                            |
| Browser boot         | `web/index.html` loads React, ReactDOM, and Babel before the ordered browser globals: answer map, themes, settings schema, draft writer, UI kit, live transport, views, settings panel, and app.                                                        | `web/index.html`                                                                                                       |
| Durable recovery     | The Node-side per-round snapshot in `lib/round-store.cjs` is authoritative for recoverable round lifecycle, drafts, and delivery state. Browser storage is a non-authoritative replay mirror. Settings persistence remains a separate contract.         | [D-010](decisions.md#d-010--durable-per-round-recovery-snapshots), [API durable recovery](api.md#durable-recovery-api) |
| Resumed long rounds  | Once a detached round becomes `reconnecting`, its existing expiry callback must not automatically expire the round or reject its pending resumed waiter. This intentionally permits multi-day user work; detached-round TTL policy itself is unchanged. | [D-010](decisions.md#d-010--durable-per-round-recovery-snapshots), `test/bridge.test.js`                               |

The focused `test/contract-manifest.test.js` regression locks these source
boundaries. Beyond the deliberate resumed-long-round characterization above,
lifecycle expiry/state-machine behavior is intentionally deferred to separately
approved decision work; this manifest records parity only.
