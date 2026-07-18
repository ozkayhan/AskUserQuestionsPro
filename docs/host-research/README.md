# Candidate host research gates

These records are dated first-party documentation reviews, not support claims.
Every candidate remains `Researching` or `Unsupported` until an exact installed,
authenticated, native-host run completes the gate below. This workspace never
installs candidate hosts.

## Gate procedure

Use a disposable verification machine and temporary `HOME`, `XDG_CONFIG_HOME`,
and product config roots. Snapshot unrelated configuration before and after.
Record exact host version, OS/architecture, conformance, idle/reconnect/restart/
cancel/replay/ack scenarios, and install/upgrade/uninstall/trust/scope results.
Credentials, payloads, and sensitive paths never enter evidence.

| Stage               | Required evidence                                   | Promotion effect          |
| ------------------- | --------------------------------------------------- | ------------------------- |
| official docs       | dated first-party URLs and product/channel identity | Researching               |
| installed gate      | exact version, isolated scope, config snapshot      | Researching               |
| conformance         | lifecycle and redacted result evidence              | Experimental candidate    |
| manual long round   | authenticated timeout/cancel/recovery/ack           | Experimental or Supported |
| lifecycle ownership | install, upgrade, uninstall, trust, scope           | Supported eligible        |

Missing executable or authentication is `Unavailable`; it is never a pass.
