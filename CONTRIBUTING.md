# Contributing

Thanks for helping improve AskUserQuestionsPro. The project is a small,
local-first Node.js application, so changes should stay focused and preserve
the host and privacy contracts described in the [architecture guide](docs/architecture.md).

## Before you start

1. Search existing issues and discussions before opening a new report.
2. For a substantial change, open an issue or discussion first so the scope
   and compatibility impact are clear.
3. Keep public contributor-facing documentation in English.
4. Never include real question text, answers, host logs, credentials, or local
   filesystem paths in a commit or issue.

## Development setup

Requirements: Node.js 18 or newer and npm.

```bash
git clone https://github.com/ozkayhan/AskUserQuestionsPro.git
cd AskUserQuestionsPro
npm ci
```

The browser uses vendored React, ReactDOM, and Babel; there is no frontend
build step. The runtime deliberately has no production npm dependencies.

## Quality checks

Run the checks relevant to your change before opening a pull request:

```bash
npm test
npm run lint
npm run format:check
git diff --check
```

Shell changes additionally require `bash -n install.sh uninstall.sh
reinstall.sh` and ShellCheck where available. Changes that cross the browser
or host boundary need a reproducible integration or manual verification path.

## Design constraints

- Keep the bridge on `127.0.0.1`; do not add remote endpoints or telemetry.
- Preserve Claude Code, Codex, ChatGPT desktop Codex, and Antigravity adapter
  behavior unless a compatibility change is explicitly documented.
- Preserve existing MCP tool names and answer value types.
- Validate at HTTP, MCP, and host boundaries and keep round identity checks in
  place for answer, cancel, disconnect, and resume operations.
- Avoid new production dependencies and build tooling without a documented
  decision.
- Keep generated plans, session metadata, screenshots, and coverage out of
  commits.

## Pull requests

Use a focused branch and explain the user-visible behavior, test coverage, and
documentation impact. Include a changeset for a release-visible package
change. Keep unrelated formatting or refactors out of the pull request.

Review the [security policy](SECURITY.md) before reporting a vulnerability and
the [support guide](SUPPORT.md) before opening a troubleshooting issue.
