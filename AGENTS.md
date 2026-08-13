# Contributor and agent guidance

AskUserQuestionsPro is a local-first Node.js application. Keep the bridge
bound to `127.0.0.1`, preserve Node.js 18+ support, keep production runtime
dependencies at zero, and do not expose question or answer content in logs,
diagnostics, or documentation examples.

## Useful commands

```bash
npm ci
npm test
npm run lint
npm run format:check
```

Use the repository’s native `node:test`, ESLint, and Prettier setup. Add focused
regression coverage for behavior changes and keep browser accessibility and
keyboard semantics intact. Run `git diff --check` before handoff.

## Documentation and release rules

- Maintained, contributor-facing documentation belongs in `docs/` and is
  indexed by `docs/README.md`; historical reports belong in `docs/archive/`.
- Do not reintroduce `.planning/`, `.omo/`, `.mcp.json`, Playwright sessions,
  coverage, or browser QA output into the public tree.
- Do not hardcode a package version or test count in README/support prose.
- npm publication uses the GitHub Actions trusted-publishing path described in
  [`docs/release.md`](docs/release.md). Never begin with local `npm publish`.
- Shell installation instructions must use an immutable release tag and a
  maintainer-published checksum. Never recommend `main | bash`.

## Scope and safety

Do not add host tools, change MCP tool names or answer value types, or broaden
the localhost trust boundary without an explicit design decision. Keep user
configuration and recovery data private on disk. When a change affects host
behavior, update the relevant canonical document and support instructions.
