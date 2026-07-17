# Phase 5 Context: Tooling, Packaging & Release

## Objective

Make the project’s installation, host discovery, CLI diagnostics, package boundary,
and release gates deterministic on Node 18+ and safe to run repeatedly.

## Locked decisions

- Keep the zero-runtime-dependency design. The MCP server and bridge must remain
  runnable from a clean npm package with only Node.js installed.
- Keep host-specific operations explicit through `--target auto|all|claude|codex`.
  `auto` may use the compatibility Claude fallback, but an explicit target must
  never silently configure the other host.
- Preserve shared runtime files when uninstalling only one host while another host
  still references them.
- Keep CI’s security posture: `npm ci`, SHA-pinned actions, shellcheck, lint,
  format check, and production-only audit.
- Treat the gitignored `.codex/` bundle as workspace tooling, not application source.
  It must be excluded from source quality scans and npm artifacts.

## Existing evidence and risks

- `package.json` is version `1.1.0`, while the lockfile root is still `1.0.0`.
- `npm run lint` currently scans `.codex/gsd-core` and reports rules from plugins
  that are intentionally not application dependencies.
- The CLI already has atomic skill deployment and typed host discovery, but its
  subprocess and installer behavior needs explicit regression coverage.
- Shell installers are intentionally network-capable in production and support a
  local `ASKUSER_SOURCE_DIR` for tests; tests must use temporary HOME/config roots.

## Out of scope for this phase

- Live Codex/Claude long-round acceptance (Phase 7).
- Removing or reorganizing historical documentation (Phase 6).
- Adding a runtime dependency solely to improve tooling.

## Verification contract

The phase is complete only when application tests pass, lint and format checks do
not inspect workspace bundles, shell scripts pass shellcheck, production audit is
clean, and `npm pack --dry-run` contains only the declared runtime/install surface.
