'use strict';
// writeFileAtomic: tmp→rename ile atomik dosya yazımı + lock directory ile eşzamanlılık koruması.
// POSIX'te rename FS seviyesinde atomik → yarım yazma bozuk dosya bırakmaz.
// ponytail: sıfır bağımlılık, tek sorumluluk.
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');

// Aynı hedefe yazan iki process/PID, farklı .tmp.<pid> dosyaları kullansa bile
// aynı rename hedefine yarışırdı (L-46). mkdir ile oluşturulan kilit dizini,
// ikinci yazıcının fail-fast etmesini sağlar: kazanan tek yazıcı olur,
// kaybeden EEXIST throw → çağıran ok:false alır, hedef tutarlı kalır.
function processIdentity(pid, fsImpl = fs) {
  // Linux exposes a stable per-process start tick in procfs. PIDs can be
  // recycled, so this distinguishes a crashed lease owner from a later,
  // unrelated process with the same PID.
  if (process.platform !== 'linux') return null;
  try {
    const stat = fsImpl.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const endOfCommand = stat.lastIndexOf(')');
    const fields = stat
      .slice(endOfCommand + 2)
      .trim()
      .split(/\s+/);
    const startTicks = fields[19]; // field 22; fields begin with state (3)
    return /^\d+$/.test(startTicks) ? `linux:${startTicks}` : null;
  } catch {
    return null;
  }
}

function ownerIsAlive(owner, { kill = process.kill, getProcessIdentity = processIdentity } = {}) {
  if (!Number.isInteger(owner?.pid) || owner.pid <= 0) return true;
  try {
    kill(owner.pid, 0);
  } catch (error) {
    // EPERM means the process exists but is not ours to signal. Any other
    // unexpected platform error is uncertain and must remain fail-closed.
    return error.code !== 'ESRCH';
  }

  // A missing/unreadable identity is uncertain and must fail closed. A
  // mismatch proves the PID has been recycled, so this lease owner is dead.
  const currentIdentity = getProcessIdentity(owner.pid);
  return (
    typeof owner.identity !== 'string' ||
    currentIdentity == null ||
    currentIdentity === owner.identity
  );
}

function parseLock(raw) {
  try {
    const value = JSON.parse(raw);
    if (Number.isInteger(value?.pid) && typeof value.token === 'string') return value;
  } catch {
    // Older directory leases used pid:token; keep their payload readable.
  }
  const legacy = /^(\d+):(.+)$/.exec(String(raw));
  return legacy ? { pid: Number(legacy[1]), token: legacy[2] } : null;
}

function ownerPath(lockPath) {
  return `${lockPath}/owner`;
}

// Locks are directories, not files. mkdir(2) acquires the public namespace
// atomically. Recovery can remove a dead owner's private lease file, then use
// rmdir(2) to atomically remove the *empty* directory. A contender cannot
// acquire the pathname between those operations: mkdir keeps failing until
// rmdir succeeds. This avoids the check-then-unlink race of file locks.
function recoverStaleLock(lockPath, fsImpl) {
  let lockStat;
  try {
    lockStat = fsImpl.lstatSync(lockPath);
  } catch (error) {
    // A concurrent release may already have removed it; retry acquisition.
    return error.code === 'ENOENT';
  }

  // A pre-directory lock may be from an earlier version. It cannot be safely
  // converted with pathname operations, so retain compatibility by treating it
  // as held rather than risking deletion of a replacement owner.
  if (!lockStat.isDirectory()) return false;

  const lease = ownerPath(lockPath);
  let owner;
  try {
    owner = parseLock(fsImpl.readFileSync(lease, 'utf8'));
  } catch (error) {
    // An empty directory is a crash during acquisition/release. rmdir is safe:
    // it succeeds only while no lease (and therefore no owner) exists.
    if (error.code === 'ENOENT') {
      try {
        fsImpl.rmdirSync(lockPath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  if (!owner || ownerIsAlive(owner)) return false;
  try {
    fsImpl.unlinkSync(lease);
    fsImpl.rmdirSync(lockPath);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(lockPath, fsImpl) {
  const token = `${process.pid}:${randomBytes(12).toString('hex')}`;
  try {
    // mkdir: public pathname yoksa oluştur, varsa EEXIST throw (atomik test-and-set).
    fsImpl.mkdirSync(lockPath, { mode: 0o700 });
    fsImpl.writeFileSync(
      ownerPath(lockPath),
      JSON.stringify({ pid: process.pid, token, identity: processIdentity(process.pid) }),
      {
        flag: 'wx',
        mode: 0o600,
      }
    );
    return token;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    if (!recoverStaleLock(lockPath, fsImpl)) return null;
    try {
      fsImpl.mkdirSync(lockPath, { mode: 0o700 });
      fsImpl.writeFileSync(
        ownerPath(lockPath),
        JSON.stringify({ pid: process.pid, token, identity: processIdentity(process.pid) }),
        {
          flag: 'wx',
          mode: 0o600,
        }
      );
      return token;
    } catch (retryError) {
      if (retryError.code === 'EEXIST') return null;
      throw retryError;
    }
  }
}

function releaseLock(lockPath, token, fsImpl) {
  try {
    const lease = ownerPath(lockPath);
    if (parseLock(fsImpl.readFileSync(lease, 'utf8'))?.token !== token) return;
    fsImpl.unlinkSync(lease);
    fsImpl.rmdirSync(lockPath);
  } catch {
    // Another owner may already have recovered the lock; never remove its directory.
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

module.exports = {
  writeFileAtomic,
  acquireLock,
  releaseLock,
  recoverStaleLock,
  ownerIsAlive,
  processIdentity,
};
