# Support

AskUserQuestionsPro is maintained as a local-first open-source tool. Start
with the [README](README.md), then use the guide that matches the problem:

- [Host matrix and evidence](https://github.com/ozkayhan/AskUserQuestionsPro/blob/main/test/host-compatibility-evidence.md)
- [Host lifecycle guide](docs/hosts.md)
- [API and protocol reference](docs/api.md)
- [Long-round timeout and recovery runbook](docs/timeout-runbook.md)
- [Testing and release gates](docs/testing.md)

## Where to ask

- Use [GitHub Discussions](https://github.com/ozkayhan/AskUserQuestionsPro/discussions)
  for usage questions and configuration help.
- Use the [bug report form](https://github.com/ozkayhan/AskUserQuestionsPro/issues/new?template=bug_report.yml)
  for a reproducible defect.
- Use the [feature request form](https://github.com/ozkayhan/AskUserQuestionsPro/issues/new?template=feature_request.yml)
  for a proposed improvement.
- Follow [SECURITY.md](SECURITY.md) for vulnerabilities; do not disclose them
  in a public issue.

## Include useful, safe evidence

For a bug, include the host, OS, Node.js major version, installation route,
selected target, exact command, expected behavior, observed behavior, and a
small synthetic reproduction. For a long-running round, include the question
count, idle duration, first terminal lifecycle event and redacted error text.

Never include real question or answer content, tokens, credentials, private
paths, or full host logs. `askuserquestionspro doctor --target <target>` and
the redacted lifecycle lines are preferred diagnostics.

## Support boundaries

Host support is evidence-gated. A configuration entry or MCP tool discovery is
not proof of authenticated, live-host compatibility. The compatibility matrix
records `live-verified`, `experimental`, `researching`, and `unsupported`
states; those labels are more authoritative than a generic “works with” claim.
