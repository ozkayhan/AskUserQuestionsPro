# Security policy

## Scope

AskUserQuestionsPro is designed for one user on one machine. The bridge binds
to `127.0.0.1` and is intentionally unauthenticated within that local model.
It is not a remote service and must not be exposed through a network
interface, reverse proxy, tunnel, or shared host without a separate threat
model and authentication design.

The application stores settings and recoverable round snapshots locally. Do
not include question text, answers, credentials, or unredacted host logs in
bug reports. Lifecycle diagnostics are intended to contain correlation data,
not user content.

## Reporting a vulnerability

Please use GitHub’s [private vulnerability reporting](https://github.com/ozkayhan/AskUserQuestionsPro/security/advisories/new)
when it is available. If that form is unavailable, open a minimal public issue
with no exploit details and ask the maintainers for a private reporting route.

Include the affected component, operating system and Node.js major version,
reproduction steps using synthetic data, impact, and a suggested mitigation
when known. Please allow maintainers reasonable time to investigate before
public disclosure. There is no guaranteed response or remediation SLA.

Do not report vulnerabilities in public discussions, pull requests, or issue
comments, and never attach credentials or private user data.

## Security expectations for contributors

- Keep all HTTP behavior localhost-only unless a reviewed design decision says
  otherwise.
- Validate input at HTTP, MCP, and host boundaries.
- Preserve exact round identity and capability checks for answer, resume, and
  cancellation paths.
- Keep persisted files private and use the existing atomic-write patterns.
- Treat installer and release changes as supply-chain-sensitive. Release
  instructions must use immutable tags and published checksums.
- Do not add telemetry or log question/answer content.

See the [architecture decisions](docs/decisions.md) and [release runbook](docs/release.md)
for the maintained rationale.
