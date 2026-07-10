// Köprü istemcisi — hem hook hem MCP sunucusu tarafından kullanılan paylaşımlı mantık.
// Node core modülleri dışında bağımlılık yok.

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import APP_ID from './app-id.cjs';

const require = createRequire(import.meta.url);
const { log } = require('./log.cjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ASKUSER_PORT || '4517';
const BASE = `http://127.0.0.1:${PORT}`;

// askBridge timeout'unu ağ/HTTP/JSON hatalarından ayırt etmek için tipli hata.
export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class BridgeError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'BridgeError';
    this.status = status;
    this.body = body;
  }
}

// Sunucunun ayakta VE bizim server olduğunu kontrol et.
// Sadece ok:true yetmez; eski/yabancı bir server (örn. rebrand öncesi claude-askui)
// portu kapıp /health'e ok diyebilir ama UI'ı servis etmez -> "Not found". app kimliğini doğrula.
async function isUp() {
  try {
    const r = await fetch(`${BASE}/health`);
    if (!r.ok) return false;
    const body = await r.json().catch(() => ({}));
    return body.app === APP_ID;
  } catch {
    return false;
  }
}

// Aynı process'te eşzamanlı çağrılar tek spawn paylaşsın (single-flight).
let inflight = null;

/**
 * Köprü sunucusunun çalıştığından emin ol; gerekirse başlat.
 * @returns {Promise<boolean>} Sunucu hazırsa true, başlatılamazsa false.
 */
export async function ensureServer() {
  if (await isUp()) return true;
  if (inflight) return inflight; // ponytail: zaten uçan bir spawn varsa onu bekle
  inflight = startServer().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function startServer() {
  const serverPath = path.join(HERE, '..', 'server', 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  let spawnError = null;
  child.on('error', (e) => {
    spawnError = e;
  });
  child.unref();
  for (let i = 0; i < 30; i++) {
    if (await isUp()) return true;
    if (spawnError) {
      log('bridge', spawnError); // spawn ENOENT/izin hatası artık sessiz değil
      return false;
    }
    await delay(100);
  }
  if (spawnError) log('bridge', spawnError);
  return false;
}

/**
 * Tarayıcıyı platforma uygun komutla aç; başarısızlık akışı bozmasın.
 */
export function openBrowser() {
  const plat = process.platform;
  const cmd = plat === 'darwin' ? 'open' : plat === 'win32' ? 'cmd' : 'xdg-open';
  const args = plat === 'win32' ? ['/c', 'start', '', BASE] : [BASE];
  // ponytail: spawn() senkron throw etmez; hata async 'error' event'inden gelir.
  // Ölü try/catch yerine tek error handler — 'open'/'xdg-open' yoksa çökmesin.
  const c = spawn(cmd, args, { stdio: 'ignore', detached: true });
  c.on('error', (e) => log('browser', e));
  c.unref();
}

/**
 * Sunucuda bir tur (pending round) kayıtlı olana kadar /current'ı yokla.
 * Hook bunu openBrowser() öncesi bekler (L-46/L-8 race guard): aksi halde tarayıcı
 * /ask POST sunucuya ulaşmadan açılıp boş ("no pending question") sayfa gösterebilir.
 * Yarış güvenliği: yoklama başarısız/yavaşsa bile sınırlı sürede vazgeçer (best-effort,
 * akışı bloke etmez — döndüğünde tarayıcı yine açılır).
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 * @returns {Promise<boolean>} Tur görüldüyse true, süre dolduysa false.
 */
export async function waitForPending({ timeoutMs = 5000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await fetch(`${BASE}/current`);
      if (r.ok) {
        const body = await r.json().catch(() => ({}));
        if (body && body.id != null) return true;
      }
    } catch {
      // ağ/sunucu henüz hazır değil → tekrar dene (deadline'a kadar).
    }
    if (Date.now() >= deadline) return false;
    await delay(intervalMs);
  }
}

/**
 * Köprü sunucusuna soru seti gönder, cevapları bekle.
 * @param {Array} questions - Soru nesneleri dizisi.
 * @param {{ timeoutMs: number, signal?: AbortSignal }} opts
 * @returns {Promise<object>} answers nesnesi.
 */
export async function askBridge(questions, { timeoutMs, signal }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const r = await fetch(`${BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
      signal: controller.signal,
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new BridgeError(body?.error || `bridge returned ${r.status}`, {
        status: r.status,
        body,
      });
    }
    const body = await r.json().catch((e) => {
      throw new Error(`bridge returned invalid JSON: ${e.message}`);
    });
    if (body == null || body.answers == null) {
      throw new Error('bridge response missing answers field');
    }
    return body.answers;
  } catch (e) {
    // Abort → timeout: çağıranın ağ hatası/HTTP 5xx/JSON hatasından ayırt edebilmesi için tiple.
    if (e?.name === 'AbortError') {
      if (signal?.aborted) throw new Error('askBridge cancelled by caller');
      throw new TimeoutError(`askBridge timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}
