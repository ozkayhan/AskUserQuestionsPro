'use strict';

// Contract L: tek satır stderr logger. Eski catch{} sessizliklerinin yerine geçer.
// log(scope, x) → stderr'e "[askuser:<scope>] <message-or-stack>\n" yazar, ASLA throw etmez.
// x bir Error ise stack (yoksa message), aksi halde String(x) yazılır.
function log(scope, x) {
  try {
    const detail = x instanceof Error ? x.stack || x.message : String(x);
    process.stderr.write(`[askuser:${scope}] ${detail}\n`);
  } catch {
    // ponytail: logger bile yazamıyorsa yapacak bir şey yok — yutarak çıkıyoruz.
  }
}

module.exports = { log };
