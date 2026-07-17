# Documentation maintenance

## Canonical versus historical

- `docs/*.md` is the maintained, code-verified reference surface.
- `docs/archive/` contains historical reports and workflow specifications kept
  for provenance. Archive files are not implementation instructions.
- `.planning/` contains GSD planning state and phase artifacts. It is not a
  replacement for the user-facing docs index.

## Naming and ownership rules

Use descriptive lowercase kebab-case names. One document owns one topic:

- architecture and decisions: `architecture.md`, `decisions.md`
- runtime operations: `backend.md`, `hosts.md`, `timeout-runbook.md`
- interfaces: `api.md`
- UI behavior: `frontend.md`
- verification and release: `testing.md`, `tech-stack.md`

## Phase 13 launch checklist

Before promotion or release, validate the [matrix and cards](../test/host-compatibility-evidence.md),
run redaction checks, tests, lint/format, shell syntax/ShellCheck, audit,
package dry-run, and changeset/release workflow checks. Refresh evidence dates
and require native macOS, Linux, and Windows rows plus isolated
install/upgrade/uninstall/trust/scope evidence for any `Supported` host.
Keep absent hosts `Researching`/`Unavailable` and Aider `Unsupported`.

Add a link to `docs/README.md` for every new maintained document. Prefer updating
the existing owner over creating a second document with overlapping scope.

## Verification checklist

Before committing documentation changes:

1. Search source symbols and endpoint names with `rg`; do not trust historical
   signatures.
2. Check every relative Markdown link from `docs/` resolves to a file.
3. Run `npm test`, which includes the docs-index/link integrity test.
4. Run `npm run format:check` and `git diff --check`.
5. If a historical document is removed, extract decisions/findings first and
   record the disposition in `docs/archive/README.md`.

Delete empty files and exact duplicates. Archive non-empty material when it
contains rationale, evidence, or a reproducible historical finding; do not make
archived workflow code look like supported runtime code.
