// Planned Phase 18 shared validator. Executors must implement this as one complete gate runner.
// It captures baseline state before edits and compares all later state relative to that capture.
// The redaction matcher must be assembled with String.raw fragments and new RegExp so path
// delimiters are escaped safely; do not place an absolute-home delimiter in a regex literal.
// Run every manifest gate, fail fast per gate order, print bounded results, and exit nonzero
// for any failure. Protected checks must compare bytes/hash, unstaged diff, index hash, cached
// diff, and status against the captured baseline. Source policy must reject new tracked worktree
// or index paths outside the declared allowlist while permitting paths already in the baseline.
