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
const LOCK_STALE_MS = 10 * 1000;

function lockOwner(token) {
  const pid = Number(String(token).split(':', 1)[0]);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function ownerIsDead(token) {
  const pid = lockOwner(token);
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error.code === 'ESRCH';
  }
}

function acquireLock(lockPath, fsImpl) {
  const token = `${process.pid}:${randomBytes(12).toString('hex')}`;
  try {
    // wx: dosya yoksa oluştur, varsa EEXIST throw (atomik test-and-set).
    fsImpl.writeFileSync(lockPath, token, { flag: 'wx', mode: 0o600 });
    return token;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    // Age alone is not ownership proof: a slow but live writer must never be
    // pre-empted. Reclaim only a stale lock whose recorded process is gone,
    // and only if the observed token still owns the pathname.
    try {
      const observed = fsImpl.readFileSync(lockPath, 'utf8');
      const age = Date.now() - fsImpl.statSync(lockPath).mtimeMs;
      if (
        age > LOCK_STALE_MS &&
        ownerIsDead(observed) &&
        fsImpl.readFileSync(lockPath, 'utf8') === observed
      ) {
        fsImpl.unlinkSync(lockPath);
        fsImpl.writeFileSync(lockPath, token, { flag: 'wx', mode: 0o600 });
        return token;
      }
    } catch {
      // A racing writer changed/reclaimed the lock, so this writer fails closed.
    }
    return null;
  }
}

function releaseLock(lockPath, token, fsImpl) {
  try {
    if (fsImpl.readFileSync(lockPath, 'utf8') === token) fsImpl.unlinkSync(lockPath);
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

module.exports = { writeFileAtomic, acquireLock, releaseLock, ownerIsDead };
