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
const V = 1;

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

module.exports = { read, write, getPath };
