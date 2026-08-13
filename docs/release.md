# Release runbook

GitHub Actions is the only normal publisher. A release is not complete because
a local package was built: the exact source commit, npm artifact, git tag,
checksum, provenance, and GitHub Release must agree.

## Pre-release gate

Before merging a release change, inspect the release workflow, package
manifest and lockfile, `.changeset/`, and this runbook. Run the repository’s
quality gates from a clean checkout:

```bash
npm ci
npm test
npm run lint
npm run format:check
npm audit --audit-level=high --omit=dev
npm pack --dry-run --json
git diff --check
```

The release workflow must run against the exact `main` SHA that passed the
release gate. It must use the repository’s Changesets flow, Node.js 24, npm
11.5.1 or newer, a clean npm cache policy, and npm trusted publishing through
GitHub OIDC (`id-token: write`). A long-lived `NPM_TOKEN` is not an acceptable
substitute. Release publication must not bypass the quality gate through a
manual dispatch or a different ref.

## Normal lifecycle

1. Add a focused `.changeset/*.md` file for a release-visible package change.
2. Run the full local gate and open a pull request against `main`.
3. Merge only after the required CI/release aggregator status is green.
4. Let Changesets create the Version Packages pull request from the tested
   source state, including the lockfile update.
5. Merge the Version Packages pull request after reviewing its exact head SHA.
6. Wait for the trusted-publishing job and verify all post-release identities.

Do not start with local `npm publish`. If local publishing reports `EOTP`,
stop; do not request an authenticator code. Route the release through the
GitHub Actions OIDC publisher instead.

## Post-release verification

Record the exact commit and verify, using the published package name:

```bash
npm view askuserquestionspro version dist-tags --json
npm view askuserquestionspro dist.tarball --json
git ls-remote --tags origin
```

Confirm that the npm version and dist-tag, git tag, GitHub Release, provenance
attestation, and package contents all refer to the intended source. A failed
or partial verification is a release incident, not a successful release.

## Shell installer integrity

The shell path is a fallback for users who cannot use npm. The release job
publishes `AskUserQuestionsPro-<version>.tar.gz`, the matching ZIP asset, and a
SHA-256 manifest containing both archives plus `install.sh` and `uninstall.sh`.
Keep the source tag immutable. The README requires users to supply the
published tar.gz SHA-256 value before extraction. After a user verifies and
extracts that archive, the included installer must prefer its complete sibling
source and must not require a second checksum setting.

A standalone `install.sh` has no verified sibling source, so its remote
fallback downloads the published ZIP asset and must require an explicit
`ASKUSER_RELEASE_TAG` and the ZIP’s `ASKUSER_RELEASE_SHA256`. A standalone
remote `reinstall.sh` must likewise require the release checksum and the
published `install.sh` and `uninstall.sh` checksums before it begins
uninstalling; it forwards the archive checksum to the replacement installer.
These values belong to release metadata; do not embed a package version in
either script or require Changesets to synchronize shell constants.

Never document or recommend `curl .../main/install.sh | bash`, a mutable
branch ZIP, or a checksum downloaded from an unrelated branch.

## Handoff

This repository does not publish from a developer workstation. The maintainer
should merge the prepared pull request, allow the release workflow to publish,
then attach the verification results to the release record. No release claim
should rely on an unauthenticated host session or an unverified installer
archive.
