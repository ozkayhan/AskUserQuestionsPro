# askuserquestionspro

## 1.3.1

### Patch Changes

- f205c43: Ensure MCP stdio processes terminate cleanly after client or transport loss instead of becoming orphaned CPU-spinning processes.

## 1.3.0

### Minor Changes

- 996271b: Add first-class Antigravity CLI integration. Automatic installation now detects
  `agy`, registers the AskPro stdio MCP server in Antigravity's global config,
  and deploys the `askpro` skill plugin with doctor and uninstall lifecycle support.

### Patch Changes

- 558c159: Reopen the configured local question panel when an MCP round is resumed, so a
  recoverable round cannot remain invisible after its original host request ends.
- e66f3d6: Add an exact-round `cancel_round` MCP control tool and preserve the user's
  language when replacing an active question round. Host disconnect recovery
  continues to use explicit durable `resume` selection.

## 1.2.1

### Patch Changes

- Expose redacted recoverable-round discovery through MCP and give pending-round
  collisions actionable exact-ID recovery guidance.

## 1.2.0

### Minor Changes

- 4ff112f: Fix browser round retirement and state-driven recovery so completed tabs cannot duplicate later rounds, normal draft acknowledgements do not trigger false conflict prompts, and recoverable interruptions expose exact valid actions.

## 1.1.1

### Patch Changes

- 4d4e634: Harden the v1.1 release with deterministic quality gates, safer local recovery, privacy checks, installer evidence, and complete release documentation.

## 1.1.0

### Minor Changes

- f12e710: 5 q/a mode added, tens of bugs fixed etc.
