'use strict';
const Settings = require('./settings.js');
function effective(source) { return source?.effective || source || Settings.inspect().effective; }
function runtimeSettings(source) {
  const value = effective(source);
  return { delivery: { mode: value.delivery?.mode || 'auto', retryMs: value.delivery?.retryMs || 1000 }, closure: { mode: value.closure?.mode || 'never' }, adapters: { claudeEnabled: value.adapters?.claudeEnabled !== false, codexEnabled: value.adapters?.codexEnabled !== false }, diagnostics: { enabled: value.diagnostics?.enabled === true, includePaths: value.diagnostics?.includePaths === true } };
}
function adapterEnabled(adapter, source) { const a = runtimeSettings(source).adapters; return adapter === 'claude' || adapter === 'hook' ? a.claudeEnabled : adapter === 'codex' || adapter === 'mcp' ? a.codexEnabled : true; }
function diagnosticsPolicy(source) { const d = source === undefined ? { enabled: true, includePaths: false } : runtimeSettings(source).diagnostics; return { enabled: d.enabled, redact(details = {}) { if (d.includePaths) return details; const { path: _path, file: _file, ...safe } = details; return safe; } }; }
function deliveryPolicy(source) { const d = runtimeSettings(source).delivery; return { ...d, requiresAcknowledgement: d.mode === 'confirm' }; }
function closurePolicy(source) { return runtimeSettings(source).closure; }
module.exports = { runtimeSettings, adapterEnabled, diagnosticsPolicy, deliveryPolicy, closurePolicy };
