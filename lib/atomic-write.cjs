'use strict';
// writeFileAtomic: tmp→rename ile atomik dosya yazımı + lockfile ile eşzamanlılık koruması.
// POSIX'te rename FS seviyesinde atomik → yarım yazma bozuk dosya bırakmaz.
// ponytail: sıfır bağımlılık, tek sorumluluk.
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');

// Aynı hedefe yazan iki process/PID, farklı .tmp.<pid> dosyaları kullansa bile
// aynı rename hedefine yarışırdı (L-46). O_EXCL ('wx') ile oluşturulan kilit
// dosyası, ikinci yazıcının fail-fast etmesini sağlar: kazanan tek yazıcı olur,
// kaybeden EEXIST throw → çağıran ok:false alır, hedef tutarlı kalır.
function ownerIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but is not ours to signal. Any other
    // unexpected platform error is uncertain and must remain fail-closed.
    return error.code === 'EPERM' || error.code !== 'ESRCH';
  }
}

function parseLock(raw) {
  try {
    const value = JSON.parse(raw);
    if (Number.isInteger(value?.pid) && typeof value.token === 'string') return value;
  } catch {
    // Older locks used pid:token. Keep them recoverable after an upgrade.
  }
  const legacy = /^(\d+):(.+)$/.exec(String(raw));
  return legacy ? { pid: Number(legacy[1]), token: legacy[2] } : null;
}

function sameInode(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

// Claim the stale inode with link(2) before removing its public name. The
// claim is an immutable ownership witness: normal contenders cannot create a
// replacement lock until the old pathname is gone, and any uncertain link,
// token, PID, or inode result leaves the lock untouched.
function recoverStaleLock(lockPath, fsImpl) {
  const claim = `${lockPath}.recover.${process.pid}.${randomBytes(8).toString('hex')}`;
  let claimed = false;
  try {
    fsImpl.linkSync(lockPath, claim);
    claimed = true;
    const owner = parseLock(fsImpl.readFileSync(claim, 'utf8'));
    if (!owner || ownerIsAlive(owner.pid)) return false;
    if (!sameInode(fsImpl.statSync(lockPath), fsImpl.statSync(claim))) return false;
    fsImpl.unlinkSync(lockPath);
    return true;
  } catch {
    return false;
  } finally {
    if (claimed)
      try {
        fsImpl.unlinkSync(claim);
      } catch {
        // The claim is private cleanup; an uncertain cleanup never authorizes
        // touching the public lock pathname.
      }
  }
}

function acquireLock(lockPath, fsImpl) {
  const token = `${process.pid}:${randomBytes(12).toString('hex')}`;
  try {
    // wx: dosya yoksa oluştur, varsa EEXIST throw (atomik test-and-set).
    fsImpl.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token }), {
      flag: 'wx',
      mode: 0o600,
    });
    return token;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    if (!recoverStaleLock(lockPath, fsImpl)) return null;
    try {
      fsImpl.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, token }), {
        flag: 'wx',
        mode: 0o600,
      });
      return token;
    } catch (retryError) {
      if (retryError.code === 'EEXIST') return null;
      throw retryError;
    }
  }
}

function releaseLock(lockPath, token, fsImpl) {
  try {
    if (parseLock(fsImpl.readFileSync(lockPath, 'utf8'))?.token === token) fsImpl.unlinkSync(lockPath);
  } catch {
    // Another owner may already have recovered the lock; never unlink its lock.
  }
}

/**
 * Dosyayı atomik olarak ve eşzamanlı yazıcılara karşı kilitli yazar.
 * Başarıda void döner; başarısızlıkta tmp'yi temizleyip throw eder.
 * @param {string} file   Hedef dosya yolu
 * @param {string} data   Yazılacak içerik (utf8)
 */
function writeFileAtomic(file, data, { fsImpl = fs, mode = 0o600 } = {}) {
  const lock = file + '.lock';
  const lockToken = acquireLock(lock, fsImpl);
  if (!lockToken) {
    throw new Error(`writeFileAtomic: concurrent write lock held for ${file}`);
  }
  const tmp = file + '.tmp.' + process.pid;
  try {
    const handle = fsImpl.openSync(tmp, 'w', mode);
    try {
      fsImpl.writeFileSync(handle, data, 'utf8');
      fsImpl.fsyncSync(handle);
    } finally {
      fsImpl.closeSync(handle);
    }
    fsImpl.renameSync(tmp, file);
  } catch (e) {
    // Yetim .tmp'yi temizle; başarısız olsa sorun değil (best-effort).
    try {
      fsImpl.unlinkSync(tmp);
    } catch {
      // Yetim .tmp zaten yoksa/silinemezse yut: asıl hata (e) aşağıda fırlatılır.
    }
    throw e;
  } finally {
    // Kilidi her durumda (başarı/hata) bırak — yoksa sonraki yazım bayatlık
    // eşiğine kadar bloke olurdu.
    releaseLock(lock, lockToken, fsImpl);
  }
}

module.exports = { writeFileAtomic, acquireLock, releaseLock, recoverStaleLock };
