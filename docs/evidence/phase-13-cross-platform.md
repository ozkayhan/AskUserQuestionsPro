# Phase 13 cross-platform and release evidence

This is a fillable evidence contract. Each native OS row must record
architecture, Node version, config root descriptor, exact command, date, result,
and limitation. WSL, emulation, and macOS-only results do not close native
Linux or Windows claims.

## Scenario parity

Every OS lane runs: idle; refresh/reconnect; detach/resume; restart;
corrupt/partial quarantine; exact selection; immutable replay; acknowledgement
retry; expiry; permissions; loopback; browser fallback; and installer scope.

| OS | Availability | Result | Limitation |
| --- | --- | --- | --- |
| macOS arm64 | available | Local automated evidence only | Native host/manual lifecycle remains unavailable |
| Linux native | unavailable | Unavailable | Requires maintainer-run native environment |
| Windows native | unavailable | Unavailable | Requires maintainer-run native environment; WSL does not count |

Do not record payloads, credentials, tokens, or sensitive absolute paths.
