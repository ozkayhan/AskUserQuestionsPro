'use strict';
// Ayarların disk kalıcılığı. ~/.config/askuserquestionspro/settings.json.
// validate() şemadan gelir → bozuk/eski/geçersiz içerik asla throw etmez.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Schema = require('../web/settings-schema.js');

const DIR = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'askuserquestionspro'
);
const FILE = path.join(DIR, 'settings.json');
const V = 1;

function read() {
  // ponytail: ENOENT + bozuk JSON aynı yol → şemadan default'lar. Asla throw etmez.
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Schema.validate(raw && typeof raw === 'object' ? raw : {});
  } catch { return Schema.validate({}); }
}

function write(patch) {
  const next = { _v: V, ...Schema.validate({ ...read(), ...patch }) };
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
    fs.renameSync(tmp, FILE); // atomic: yarım yazma = bozuk dosya olmaz
  } catch (e) {
    process.stderr.write(`[askuser] settings write failed: ${e.message}\n`);
  }
  return next;
}

function getPath() { return FILE; }

module.exports = { read, write, getPath };
