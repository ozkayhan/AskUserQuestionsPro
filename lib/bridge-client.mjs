// Köprü istemcisi — hem hook hem MCP sunucusu tarafından kullanılan paylaşımlı mantık.
// Node core modülleri dışında bağımlılık yok.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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

export function createRequestId() {
  return randomUUID();
}

// askBridge timeout'unu ağ/HTTP/JSON hatalarından ayırt etmek için tipli hata.
export class TimeoutError extends Error {
  constructor(message, { deadlineOwner = 'application', boundary = 'bridge' } = {}) {
    super(message);
    this.name = 'TimeoutError';
    this.deadlineOwner = deadlineOwner;
    this.boundary = boundary;
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
  if (process.env.ASKUSER_OPEN_BROWSER === '0') {
    log('browser', 'browser opening disabled by ASKUSER_OPEN_BROWSER=0');
    return;
  }
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
export async function waitForPending({ timeoutMs = 5000, intervalMs = 50, requestId } = {}) {
  const deadline = Date.now() + timeoutMs;
  const query = requestId ? `?requestId=${encodeURIComponent(requestId)}` : '';
  for (;;) {
    try {
      const r = await fetch(`${BASE}/current${query}`);
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
export async function askBridge(
  questions,
  { timeoutMs, signal, requestId, lifecycle, timerApi = globalThis } = {}
) {
  const controller = new AbortController();
  let deadlineExpired = false;
  const timer = timerApi.setTimeout(() => {
    deadlineExpired = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (signal?.aborted) controller.abort();
  lifecycle?.event('ask_received');
  try {
    const r = await fetch(`${BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestId ? { questions, requestId } : { questions }),
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
    lifecycle?.event('answer_received');
    lifecycle?.finish('completed');
    return body.answers;
  } catch (e) {
    // Abort → timeout: çağıranın ağ hatası/HTTP 5xx/JSON hatasından ayırt edebilmesi için tiple.
    if (e?.name === 'AbortError') {
      if (signal?.aborted) {
        lifecycle?.event('host_abort', { boundary: 'bridge', deadlineOwner: 'host' });
        lifecycle?.finish('host_cancelled', { boundary: 'bridge', deadlineOwner: 'host' });
        throw new Error('askBridge cancelled by caller');
      }
      lifecycle?.event('round_timeout', { boundary: 'bridge', deadlineOwner: 'application' });
      lifecycle?.finish('application_timeout', {
        boundary: 'bridge',
        deadlineOwner: 'application',
      });
      throw new TimeoutError(`askBridge timed out after ${timeoutMs}ms`, {
        deadlineOwner: deadlineExpired ? 'application' : 'transport',
      });
    }
    lifecycle?.finish('bridge_error');
    throw e;
  } finally {
    timerApi.clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

/**
 * Retrieve one explicitly selected detached round after a host process lost
 * its original MCP connection. The browser round stays owned by the bridge
 * until the bounded detached-round TTL expires.
 */
export async function resumeBridge(
  selector,
  { timeoutMs = 60 * 60 * 1000, signal, timerApi = globalThis } = {}
) {
  const recoverySelector =
    typeof selector === 'string' && selector
      ? { requestId: selector }
      : selector &&
          typeof selector === 'object' &&
          (typeof selector.requestId === 'string' || typeof selector.roundId === 'string')
        ? selector
        : null;
  if (!recoverySelector) {
    throw new BridgeError('resumeBridge requires an explicit requestId or roundId', {
      status: 400,
      body: { reason: 'invalid_selector' },
    });
  }
  const controller = new AbortController();
  const timer = timerApi.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const r = await fetch(`${BASE}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recoverySelector),
      signal: controller.signal,
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new BridgeError(body?.error || `bridge returned ${r.status}`, {
        status: r.status,
        body,
      });
    }
    if (body == null || body.answers == null) {
      throw new Error('bridge resume response missing answers field');
    }
    return body.answers;
  } catch (e) {
    if (e?.name === 'AbortError') {
      if (signal?.aborted) throw new Error('resumeBridge cancelled by caller');
      throw new TimeoutError(`resumeBridge timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    timerApi.clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

/** Explicitly cancel an MCP round before closing its host-owned HTTP stream. */
export async function cancelBridge(requestId, reason = 'host cancelled') {
  const query = requestId ? `?requestId=${encodeURIComponent(requestId)}` : '';
  const currentResponse = await fetch(`${BASE}/current${query}`);
  const current = await currentResponse.json().catch(() => ({}));
  if (current?.id == null) return false;
  const r = await fetch(`${BASE}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: current.id, capability: current.capability, reason }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new BridgeError(body?.error || `bridge returned ${r.status}`, {
      status: r.status,
      body,
    });
  }
  return true;
}
