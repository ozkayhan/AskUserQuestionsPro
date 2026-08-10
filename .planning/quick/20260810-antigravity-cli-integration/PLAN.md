---
name: antigravity-cli-integration
created: 2026-08-10
status: complete
---

# Antigravity CLI integration

Add first-class Antigravity CLI support to the installer and lifecycle commands so `--target auto|all|antigravity` installs a global AskPro MCP registration plus an Antigravity plugin/skill bundle without mutating unrelated host configuration.

## Research decisions

- Use the official Antigravity CLI MCP contract: `~/.gemini/config/mcp_config.json`, `mcpServers`, stdio `command` + `args`.
- Use the official CLI plugin staging path: `~/.gemini/antigravity-cli/plugins/askuserquestionspro/` with `plugin.json`, `mcp_config.json`, and `skills/askpro/SKILL.md`.
- Set the AskPro MCP timeout to one hour where the Antigravity schema supports it; keep the config valid if the host ignores optional timeout fields.
- Do not install the Claude `AskUserQuestion` hook into Antigravity; Antigravity exposes different hook events and AskPro is delivered through MCP + skill guidance.

## Work items

1. Add an isolated Antigravity adapter module for paths, JSON merge/remove, plugin deployment, and doctor checks.
2. Extend host detection, target parsing, install/uninstall/doctor, shell installer/uninstaller, and help text.
3. Add lifecycle and adapter regression tests, docs/capability evidence, and update AskPro skill wording for Antigravity.
4. Run focused tests, full test/lint/format gates, inspect the diff, and record the handoff summary.
