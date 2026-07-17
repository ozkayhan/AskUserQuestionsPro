
## Settings commands

`askuserquestionspro settings export` prints the allowlisted v2 envelope. `settings import-preview <file|->` validates without applying and exits 0 for an applicable preview, 2 for invalid/future input, or 64 for usage/I/O errors. `settings reset <namespace>` performs a namespace-only CAS reset. Export and doctor output never includes raw unknown values, secrets, commands, or loopback configuration.
