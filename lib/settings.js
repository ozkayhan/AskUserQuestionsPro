'use strict';
// Ayarların disk kalıcılığı. ~/.config/askuserquestionspro/settings.json.
// validate() şemadan gelir → bozuk/eski/geçersiz içerik asla throw etmez.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Schema = require('../web/settings-schema.js');
const { writeFileAtomic } = require('./atomic-write.cjs');
const { log } = require('./log.cjs');

const DIR = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'askuserquestionspro'
);
const FILE = path.join(DIR, 'settings.json');
const BACKUP = `${FILE}.v1-backup.json`;
const V = 1; // legacy flat write compatibility; v2 uses writeEnvelope()
const V2 = 2;
const crypto = require('node:crypto');

function revision(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readRaw() {
  try {
    return fs.readFileSync(FILE);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function fsyncDirectory() {
  try {
    const fd = fs.openSync(DIR, 'r');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    if (!['EINVAL', 'EISDIR', 'ENOTSUP'].includes(error.code)) throw error;
  }
}

function backupLegacy(bytes) {
  fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
  try {
    const fd = fs.openSync(BACKUP, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, bytes);
      fs.fsyncSync(fd);
      fs.fchmodSync(fd, 0o600);
    } finally {
      fs.closeSync(fd);
    }
    fsyncDirectory();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = fs.readFileSync(BACKUP);
    if (!existing.equals(bytes)) {
      const conflict = new Error('legacy settings backup collision');
      conflict.code = 'BACKUP_COLLISION';
      throw conflict;
    }
  }
  return true;
}

function migrateLegacy(bytes, parsed) {
  const inspected = Schema.inspectEnvelope(parsed);
  if (!inspected.migrated) return inspected;
  try {
    backupLegacy(bytes);
    writeFileAtomic(FILE, JSON.stringify(inspected.envelope, null, 2) + '\n');
    fsyncDirectory();
    return { ...inspected, migration: { needed: true, backup: true } };
  } catch (error) {
    log('settings migration', error);
    return {
      ...inspected,
      migration: {
        needed: true,
        backup: false,
        failed: true,
        code: error.code || 'MIGRATION_FAILED',
      },
    };
  }
}

function inspect() {
  const bytes = readRaw();
  if (!bytes)
    return {
      status: 'missing',
      revision: null,
      hash: null,
      effective: Schema.envelopeDefaults(),
      migration: null,
    };
  const hash = revision(bytes);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return {
      status: 'invalid',
      revision: hash,
      hash,
      effective: Schema.envelopeDefaults(),
      migration: null,
    };
  }
  const result = migrateLegacy(bytes, parsed);
  const currentBytes = result.migrated && result.migration?.backup ? readRaw() : bytes;
  const currentHash = revision(currentBytes);
  return {
    ...result,
    revision: currentHash,
    hash: currentHash,
    effective: result.envelope || Schema.envelopeDefaults(),
    migration: result.migration || { needed: false, backup: false },
  };
}

/**
 * read() → settings object (schema shape, WITHOUT `_v`).
 *
 * Contract (L-25, kasıtlı asimetri — artık belgeli):
 *   - Disk formatı `_v` (versiyon marker) + ayar anahtarlarını içerir.
 *   - read() çıktısı YALNIZCA Schema.validate() şeklidir; `_v` bilinmeyen key
 *     olarak elenir. Yani `_v` bir DISK persistence detayıdır, public okuma
 *     sözleşmesinin parçası DEĞİLDİR. Tüketiciler (server inject, CLI, MCP)
 *     `_v` görmez; sadece doctor diski ham JSON.parse ile okur.
 *   - ENOENT + bozuk JSON aynı yol → şemadan default'lar. Asla throw etmez.
 */
function read() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Schema.validate(raw && typeof raw === 'object' ? raw : {});
  } catch {
    return Schema.validate({});
  }
}

function load() {
  return inspect();
}

function writeEnvelope(envelope, expectedRevision) {
  const current = inspect();
  if (expectedRevision !== undefined && expectedRevision !== current.revision)
    return { ok: false, code: 'STALE_REVISION', status: current };
  if (!envelope || envelope._v !== V2)
    return { ok: false, code: 'INVALID_SETTINGS', status: current };
  const next = Schema.validateEnvelope(envelope);
  try {
    fs.mkdirSync(DIR, { recursive: true, mode: 0o700 });
    writeFileAtomic(FILE, JSON.stringify(next, null, 2) + '\n');
    return { ok: true, value: next, status: inspect() };
  } catch (error) {
    log('settings', error);
    return { ok: false, code: error.code || 'WRITE_FAILED', error, status: current };
  }
}

function mutateCompareAndSwap(expectedRevision, mutator) {
  const current = inspect();
  if (current.status === 'invalid' || current.status === 'unsupported-future')
    return { ok: false, code: 'UNSAFE_SOURCE', status: current };
  if (expectedRevision !== undefined && expectedRevision !== current.revision)
    return { ok: false, code: 'STALE_REVISION', status: current };
  const next = mutator(current.effective);
  return writeEnvelope(next, current.revision);
}

/**
 * Contract W: write(patch) → { ok: boolean; value: object; error?: Error }
 * Başarıda  { ok: true,  value: next }
 * Başarısızda { ok: false, value: next, error: e }  (disk değişmez, next bellek içi)
 */
function write(patch) {
  const next = { _v: V, ...Schema.validate({ ...read(), ...patch }) };
  try {
    fs.mkdirSync(DIR, { recursive: true });
    writeFileAtomic(FILE, JSON.stringify(next, null, 2));
    return { ok: true, value: next };
  } catch (e) {
    // Contract L: tek logger. Lock çakışması (EEXIST) dahil her yazma hatası
    // ok:false ile caller'a iletilir; disk değişmez (atomic rename gerçekleşmedi).
    log('settings', e);
    return { ok: false, value: next, error: e };
  }
}

function getPath() {
  return FILE;
}

function doctorProjection(status = inspect()) {
  const e = status.effective || Schema.envelopeDefaults();
  const projection = {
    status: status.status,
    revision: status.revision,
    migration: status.migration
      ? { needed: !!status.migration.needed, backup: !!status.migration.backup }
      : null,
    effective: {
      browser: {
        strategy: e.browser.strategy,
        theme: e.browser.theme,
        uiScale: e.browser.uiScale,
        highContrast: e.browser.highContrast,
        reduceMotion: e.browser.reduceMotion,
      },
      recovery: { retentionMs: e.recovery.retentionMs, mode: e.recovery.mode },
      autosave: { enabled: e.autosave.enabled, debounceMs: e.autosave.debounceMs },
      diagnostics: { enabled: e.diagnostics.enabled, includePaths: e.diagnostics.includePaths },
      delivery: { mode: e.delivery.mode, retryMs: e.delivery.retryMs },
      closure: { mode: e.closure.mode },
      adapters: { claudeEnabled: e.adapters.claudeEnabled, codexEnabled: e.adapters.codexEnabled },
    },
  };
  return projection;
}

function inspectReadOnly() {
  const bytes = readRaw();
  if (!bytes)
    return {
      status: 'missing',
      revision: null,
      hash: null,
      effective: Schema.envelopeDefaults(),
      migration: null,
    };
  const hash = revision(bytes);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return {
      status: 'invalid',
      revision: hash,
      hash,
      effective: Schema.envelopeDefaults(),
      migration: null,
    };
  }
  const result = Schema.inspectEnvelope(parsed);
  return {
    ...result,
    revision: hash,
    hash,
    effective: result.envelope || Schema.envelopeDefaults(),
    migration: result.migrated ? { needed: true, backup: false } : { needed: false, backup: false },
  };
}

module.exports = {
  read,
  write,
  load,
  inspect,
  inspectReadOnly,
  writeEnvelope,
  mutateCompareAndSwap,
  getPath,
  doctorProjection,
  BACKUP,
};
