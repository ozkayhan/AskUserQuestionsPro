# AskUserQuestionsPro

> A local, full-screen structured-question UI for Claude Code, Codex CLI,
> Antigravity CLI, and the Codex surface in the ChatGPT desktop app.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-3c873a.svg)](https://nodejs.org/)

AskUserQuestionsPro replaces cramped terminal prompts with a keyboard-friendly
browser flow for grouped questions, rich input types, review, recovery, and
structured results. It is local-first: the bridge binds to `127.0.0.1`, there
is no remote application service or telemetry, and the runtime has no npm
production dependencies.

## Install

### npm (recommended)

Prerequisite: Node.js 18 or newer.

```bash
npm install --global askuserquestionspro
askuserquestionspro install --target auto
```

Use `--target claude`, `--target codex`, `--target antigravity`, or
`--target all` when automatic host selection is not what you want. Run
`askuserquestionspro doctor --target all` after installation.

### Shell installer from a release archive

Use a published release tag and its published checksum. Do not pipe a mutable
branch into a shell. Replace the placeholders below with values copied from
the GitHub release page, then verify the archive before running the installer:

```bash
release_tag="vX.Y.Z"
expected_sha256="PASTE_THE_RELEASED_SHA256_HERE"
archive="AskUserQuestionsPro-${release_tag#v}.tar.gz"

curl --fail --location --output "$archive" \
  "https://github.com/ozkayhan/AskUserQuestionsPro/archive/refs/tags/${release_tag}.tar.gz"
printf '%s  %s\n' "$expected_sha256" "$archive" | shasum --algorithm 256 --check
tar --extract --gzip --file "$archive"
cd "AskUserQuestionsPro-${release_tag#v}"
./install.sh --target auto
```

The checksum must come from the same release’s trusted maintainer-published
checksums, not from the branch or an unverified mirror. The archive installer
requires `curl`, `tar`, `shasum`, and Node.js. The repository’s release policy
is documented in [`docs/release.md`](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/docs/release.md).

## Hosts and capabilities

| Host                          | Adapter                                  | Support status                                                                                             |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Claude Code                   | `AskUserQuestion` hook plus MCP/skill    | Hook and local contract verified; authenticated host evidence is maintained separately                     |
| Codex CLI                     | MCP tool plus `askpro` skill             | Live-verified path with bounded resume behavior                                                            |
| ChatGPT desktop Codex surface | Shared Codex MCP registration plus skill | Uses the Codex adapter; restart the app after installation                                                 |
| Antigravity CLI               | MCP registration plus plugin skill       | Automated installer/contract coverage; treat as experimental until authenticated live evidence is recorded |

The maintained [host matrix](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/test/host-compatibility-evidence.md)
is the source of truth. Configuration discovery alone is not a support
promise.

## How it works

Claude’s native question hook and the shared MCP adapter converge on the same
bridge client, localhost HTTP/SSE server, and browser UI:

```text
Claude native AskUserQuestion ── hook ─┐
                                       ├─ bridge client → 127.0.0.1 bridge ⇄ browser
Claude / Codex / Antigravity / Desktop ─ MCP + skill ─┘
```

The bridge is single-flight: one round is active at a time, and round IDs
protect answers, cancellation, disconnect recovery, and replay from crossing
rounds. Recoverable snapshots stay on the local machine; browser storage is a
best-effort mirror. See the [architecture guide](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/docs/architecture.md)
and [security policy](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/SECURITY.md).

## MCP tools

The installer registers:

- `mcp__askuserquestionspro__ask`
- `mcp__askuserquestionspro__resume`
- `mcp__askuserquestionspro__list_recoverable_rounds`
- `mcp__askuserquestionspro__cancel_round`

The question contract supports `binary`, `single`, `multi`, `scale`,
`ranking`, and `tree` inputs. Results preserve their typed values: strings,
string arrays, numbers, or tree paths as appropriate. Existing tool names and
answer value types are part of the compatibility contract.

## CLI

```text
askuserquestionspro install [--target ...]    Install selected host adapters
askuserquestionspro uninstall [--target ...] Remove selected host adapters
askuserquestionspro doctor [--target ...]    Check registration and bridge state
askuserquestionspro serve                     Run the localhost bridge
askuserquestionspro mcp                       Run the stdio MCP server
askuserquestionspro settings ...              Inspect or update UI settings
```

## Development

```bash
npm ci
npm test
npm run lint
npm run format:check
```

Contributions should preserve Node.js 18+ compatibility, localhost-only
binding, zero production dependencies, the build-free browser runtime, and
the host contracts. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a
pull request.

## Documentation and support

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security policy](SECURITY.md)
- [Support](SUPPORT.md)
- [API and protocol reference](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/docs/api.md)
- [Testing guide](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/docs/testing.md)
- [Troubleshooting and recovery](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/docs/timeout-runbook.md)
- [Release runbook](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/docs/release.md)
- [Architecture decisions](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/docs/decisions.md)

Please use [GitHub Discussions](https://github.com/ozkayhan/AskUserQuestionsPro/discussions)
for questions and [GitHub Issues](https://github.com/ozkayhan/AskUserQuestionsPro/issues)
for reproducible bugs and feature requests. Do not post secrets, question
answers, or private host logs in public issues.
