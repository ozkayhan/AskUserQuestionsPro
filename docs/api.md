
## Settings v2 HTTP API

`GET /settings/export` returns deterministic redacted JSON with `Cache-Control: no-store` and an attachment filename. `POST /settings/preview` accepts `{payload, baselineRevision}` and returns a one-time preview. `POST /settings/apply` consumes that preview and performs a revision-checked atomic mutation. `POST /settings/reset` accepts `{namespace, baselineRevision}` and resets one known namespace. Stale, reused, expired, invalid, and future previews are rejected without replacing the settings file.
