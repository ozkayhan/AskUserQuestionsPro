'use strict';

module.exports = {
  lines: 90,
  branches: 80,
  functions: 80,
  criticalLine: 85,
  include: [
    // Keep the native gate focused on the runtime state machine and boundary
    // validators. Adapter CLIs and long-lived stdio processes need separate
    // process-level smoke coverage and would otherwise dilute this signal.
    'lib/app-id.cjs',
    'lib/host-platforms.cjs',
    'lib/protocol-limits.cjs',
    'lib/question-contract.cjs',
    'lib/round-lifecycle.cjs',
    'lib/round-record.cjs',
    'lib/round-state.cjs',
    'lib/round-store.cjs',
    'server/bridge.js',
  ],
  exclude: ['test/**', 'web/**'],
  criticalFiles: ['lib/round-lifecycle.cjs', 'lib/question-contract.cjs', 'lib/round-store.cjs'],
};
