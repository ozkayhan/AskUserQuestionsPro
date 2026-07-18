# Phase 19 Installer Matrix

candidate SHA: 24dcd564e8d6e7faf13076e9a4ce3ea4bf43c502
fixture scope: disposable HOME and XDG_CONFIG_HOME only
captured at: 2026-07-18T13:37:23Z

## install-codex
command: bash install.sh --target codex
status: 0
output/summary: AskUserQuestionsPro kurulumu — Claude Code + Codex (target: codex)
interpretation: PASS
outside fixture mutation: not observed

## install-claude
command: bash install.sh --target claude
status: 0
output/summary: AskUserQuestionsPro kurulumu — Claude Code + Codex (target: claude)
interpretation: PASS
outside fixture mutation: not observed

## install-all
command: bash install.sh --target all
status: 0
output/summary: AskUserQuestionsPro kurulumu — Claude Code + Codex (target: all)
interpretation: PASS
outside fixture mutation: not observed

## reinstall-codex
command: bash reinstall.sh --target codex
status: 0
output/summary: AskUserQuestionsPro yeniden kurulumu — Claude Code + Codex (target: codex)
interpretation: PASS
outside fixture mutation: not observed

## uninstall-codex
command: bash uninstall.sh --target codex
status: 0
output/summary: AskUserQuestionsPro kaldırma — Claude Code + Codex (target: codex)
interpretation: PASS
outside fixture mutation: not observed

## uninstall-claude
command: bash uninstall.sh --target claude
status: 0
output/summary: AskUserQuestionsPro kaldırma — Claude Code + Codex (target: claude)
interpretation: PASS
outside fixture mutation: not observed

## uninstall-all
command: bash uninstall.sh --target all
status: 0
output/summary: AskUserQuestionsPro kaldırma — Claude Code + Codex (target: all)
interpretation: PASS
outside fixture mutation: not observed

## lifecycle-tests
command: node --test test/shell-lifecycle.test.js test/install.test.js test/host-install-gates.test.js
status: 0
output/summary: TAP version 13
interpretation: PASS
outside fixture mutation: not observed

## External lanes

| lane | status | reason |
|---|---|---|
| native-windows | UNAVAILABLE | no Windows environment |
| native-linux | UNAVAILABLE | no Linux environment |
| authenticated-host | UNAVAILABLE | no authenticated Claude/Codex host session |
