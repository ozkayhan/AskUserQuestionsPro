'use strict';
// writeFileAtomic: tmp→rename ile atomik dosya yazımı + lockfile ile eşzamanlılık koruması.
// POSIX'te rename FS seviyesinde atomik → yarım yazma bozuk dosya bırakmaz.
// ponytail: sıfır bağımlılık, tek sorumluluk.
const fs = require('node:fs');

// Aynı hedefe yazan iki process/PID, farklı .tmp.<pid> dosyaları kullansa bile
// aynı rename hedefine yarışırdı (L-46). O_EXCL ('wx') ile oluşturulan kilit
// dosyası, ikinci yazıcının fail-fast etmesini sağlar: kazanan tek yazıcı olur,
// kaybeden EEXIST throw → çağıran ok:false alır, hedef tutarlı kalır.
const LOCK_STALE_MS = 10 * 1000; // 10sn'den eski kilit → çökmüş yazıcıdan kalmış say, devral

function acquireLock(lockPath) {
  try {
    // wx: dosya yoksa oluştur, varsa EEXIST throw (atomik test-and-set).
    fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
    return true;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    // Bayat kilit kurtarma: yazıcı kilidi bırakmadan çöktüyse (kill -9, panic)
    // kilit sonsuza dek asılı kalmasın. mtime eşiği aşıldıysa devral.
    try {
      // ponytail: stat→unlink arası dar yarış var; iki process aynı bayat kiliti aynı anda
      // devralabilir. Tek-kullanıcılı yerel config için ihmal edilebilir. Çok-yazıcı gerekirse:
      // unlink sonrası restat ile sahiplik doğrula.
      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age > LOCK_STALE_MS) {
        fs.unlinkSync(lockPath);
        fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
        return true;
      }
    } catch {
      // stat/unlink yarışı (başka yazıcı aynı anda devraldı) → kilit alınamadı.
    }
    return false;
  }
}

/**
 * Dosyayı atomik olarak ve eşzamanlı yazıcılara karşı kilitli yazar.
 * Başarıda void döner; başarısızlıkta tmp'yi temizleyip throw eder.
 * @param {string} file   Hedef dosya yolu
 * @param {string} data   Yazılacak içerik (utf8)
 */
function writeFileAtomic(file, data) {
  const lock = file + '.lock';
  if (!acquireLock(lock)) {
    throw new Error(`writeFileAtomic: concurrent write lock held for ${file}`);
  }
  const tmp = file + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, file);
  } catch (e) {
    // Yetim .tmp'yi temizle; başarısız olsa sorun değil (best-effort).
    try {
      fs.unlinkSync(tmp);
    } catch {
      // Yetim .tmp zaten yoksa/silinemezse yut: asıl hata (e) aşağıda fırlatılır.
    }
    throw e;
  } finally {
    // Kilidi her durumda (başarı/hata) bırak — yoksa sonraki yazım bayatlık
    // eşiğine kadar bloke olurdu.
    try {
      fs.unlinkSync(lock);
    } catch {
      // Kilit zaten silinmiş/devralınmışsa yut.
    }
  }
}

module.exports = { writeFileAtomic };
