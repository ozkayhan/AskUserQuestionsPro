# Release and npm publishing

This repository's canonical npm publishing path is GitHub Actions. Do not
start a release with a local `npm publish` command.

## Why GitHub Actions is the publisher

[`release.yml`](../.github/workflows/release.yml) runs the Changesets release
flow after successful CI on `main` (or after an explicitly requested manual
dispatch). Its job has `id-token: write`, configures the npm registry, and
invokes `changeset publish`. npm trusted publishing supplies the short-lived
OIDC identity, so the normal repository release does not depend on a local
npm login, authenticator code, or long-lived npm token.

The normal lifecycle is:

1. Add a `.changeset/*.md` file with the code change.
2. Run the quality gates, then commit and push the change.
3. Open and merge the PR into `main`.
4. Let the Release workflow create the Version Packages PR.
5. Merge the Version Packages PR and wait for the resulting publish job.
6. Verify the workflow, npm version, dist-tag, git tag, and GitHub release.

Manual `workflow_dispatch` is an exception for an already-versioned package
or an operational recovery. Use it only after checking the exact ref and
confirming that the package version is not already published.

## Agent and maintainer guardrails

Before publishing, inspect these files in the current checkout:

- `.github/workflows/release.yml` — trigger, ref, OIDC permission, and
  Changesets command;
- `package.json` and `package-lock.json` — package name, version, and release
  scripts;
- `.changeset/` — whether the release is pending versioning or already
  versioned;
- `docs/tech-stack.md` — the maintained release contract.

Local `npm publish` is a fallback only when the user explicitly chooses a
local registry publication and has confirmed the required npm credentials.
It is not the default for this repository. In particular:

- `npm publish --provenance` is expected to fail on a developer machine when
  no supported CI provenance provider is present;
- retrying with `--provenance=false` can reach npm but may fail with `EOTP`;
- `EOTP` means the wrong publication path was selected here. Do not ask the
  user for an authenticator code as the first recovery. Route the release
  through GitHub Actions trusted publishing instead.

Never claim a release succeeded until all of these are verified:

- the GitHub Release workflow completed successfully;
- `npm view askuserquestionspro version dist-tags --json` shows the expected
  version and tag;
- the published artifact was checked with `npm pack --dry-run --json` before
  release;
- the working tree and pushed commit are the intended ones.

## Incident learning

The 2026-08-03 `1.2.1` release attempt initially used local `npm publish`
before auditing the repository's release workflow and history. That caused an
avoidable provenance-provider error followed by an OTP prompt, even though
the repository already had a working GitHub OIDC/trusted-publishing path.
The durable correction is procedural: inspect the release workflow first and
select the repository-native publisher before touching local npm credentials.
