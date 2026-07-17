'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Record = require('./round-record.cjs');
const { writeFileAtomic } = require('./atomic-write.cjs');

class RoundStore {
  constructor({ root, now = Date.now, fsImpl = fs } = {}) {
    this.root =
      root ||
      path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
        'askuserquestionspro'
      );
    this.roundsDir = path.join(this.root, 'rounds');
    this.quarantineDir = path.join(this.root, 'quarantine');
    this.now = now;
    this.fs = fsImpl;
    this._ensure();
    this._records = new Map();
    this._load();
    this.cleanupExpired();
  }
  _ensure() {
    for (const directory of [this.roundsDir, this.quarantineDir]) {
      this.fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      // mkdir's mode is ignored for an existing directory. Tighten reused config
      // roots too, because round names and quarantined payloads are private data.
      this.fs.chmodSync(directory, 0o700);
    }
  }
  _file(id) {
    return path.join(this.roundsDir, `${id}.json`);
  }
  _load() {
    for (const name of this.fs.readdirSync(this.roundsDir)) {
      if (!name.endsWith('.json')) continue;
      const source = path.join(this.roundsDir, name);
      try {
        const valid = Record.validate(JSON.parse(this.fs.readFileSync(source, 'utf8')));
        if (!valid.ok || path.basename(this._file(valid.record.roundId)) !== name)
          throw new Error(valid.code || 'invalid_record');
        this._records.set(valid.record.roundId, valid.record);
      } catch {
        const target = path.join(
          this.quarantineDir,
          `${name}.${this.now()}.${process.pid}.invalid`
        );
        try {
          this.fs.renameSync(source, target);
        } catch {
          /* a raced cleanup leaves no recoverable record */
        }
      }
    }
  }
  _write(record) {
    try {
      writeFileAtomic(this._file(record.roundId), JSON.stringify(record), {
        fsImpl: this.fs,
        mode: 0o600,
      });
      this._records.set(record.roundId, record);
      return { ok: true, record };
    } catch (error) {
      return { ok: false, code: 'persistence_error', error };
    }
  }
  create(input) {
    try {
      return this._write(Record.create({ ...input, now: this.now() }));
    } catch (error) {
      return { ok: false, code: 'persistence_error', error };
    }
  }
  get(roundId) {
    const record = this._records.get(roundId);
    return record ? { ok: true, record } : { ok: false, code: 'not_found' };
  }
  findByRequestId(requestId) {
    const matches = [...this._records.values()].filter((item) => item.requestId === requestId);
    return matches.length === 1
      ? { ok: true, record: matches[0] }
      : matches.length
        ? { ok: false, code: 'ambiguous_selection' }
        : { ok: false, code: 'not_found' };
  }
  list() {
    return [...this._records.values()].filter((r) => r.expiresAt > this.now()).map(Record.metadata);
  }
  recoverable() {
    return [...this._records.values()].filter(
      (record) =>
        record.expiresAt > this.now() &&
        !record.answers &&
        ['drafting', 'detached', 'reconnecting'].includes(record.lifecycle.state)
    );
  }
  mutate(roundId, fn) {
    const current = this._records.get(roundId);
    if (!current) return { ok: false, code: 'not_found' };
    const outcome = fn(current, this.now());
    return outcome.ok && !outcome.replayed ? this._write(outcome.record) : outcome;
  }
  cleanupExpired() {
    const removed = [];
    for (const [id, record] of this._records)
      if (record.expiresAt <= this.now()) {
        try {
          this.fs.unlinkSync(this._file(id));
        } catch (error) {
          if (error.code !== 'ENOENT') continue;
        }
        this._records.delete(id);
        removed.push(id);
      }
    return removed;
  }
}

module.exports = { RoundStore };
