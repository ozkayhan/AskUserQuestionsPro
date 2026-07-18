# Phase 13 compatibility evidence matrix

Generated from `test/host-compatibility-evidence.json`; validate with
`node --test test/host-evidence-matrix.test.js`.

| id                 | host               | status      | version     | evidence                          | limitation / next gate                           |
| ------------------ | ------------------ | ----------- | ----------- | --------------------------------- | ------------------------------------------------ |
| cursor             | Cursor             | Researching | unavailable | official-doc                      | install isolated exact version and run lifecycle |
| github-copilot-cli | GitHub Copilot CLI | Researching | unavailable | official-doc                      | authenticate and verify policy/scope             |
| gemini-cli         | Gemini CLI         | Researching | unavailable | official-doc                      | verify trust and lifecycle                       |
| amazon-q-developer | Amazon Q Developer | Researching | unavailable | official-doc                      | test CLI and IDE separately                      |
| cline              | Cline              | Researching | unavailable | official-doc                      | select exact product surface                     |
| kiro               | Kiro               | Researching | unavailable | official-doc                      | verify governance and scopes                     |
| kilo-code          | Kilo Code          | Researching | unavailable | source-gap                        | obtain authoritative source                      |
| qwen-code          | Qwen Code          | Researching | unavailable | official-doc                      | verify installed lifecycle                       |
| opencode           | OpenCode           | Researching | 1.15.12     | official-doc+installed-unverified | authenticated conformance required               |
| roo-code           | Roo Code           | Researching | unavailable | official-doc                      | native extension run required                    |
| windsurf           | Windsurf           | Researching | unavailable | source-gap                        | obtain vendor source                             |
| aider              | Aider              | Unsupported | unavailable | official-doc-no-safe-surface      | no safe integration proven                       |

Researching, Unsupported, and Unavailable are not support promises. MCP
discoverability or a configuration example is not lifecycle evidence.
