// Köprü istemcisi — hem hook hem MCP sunucusu tarafından kullanılan paylaşımlı mantık.
// Node core modülleri dışında bağımlılık yok.

import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import APP_ID from './app-id.cjs';

const require = createRequire(import.meta.url);
const { log } = require('./log.cjs');
const Settings = require('./settings.js');
const { deliveryPolicy } = require('./runtime-settings.cjs');
const {
  BRIDGE_PROTOCOL_VERSION,
  packageVersion,
  isCompatibleHealth,
} = require('./bridge-protocol.cjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ASKUSER_PORT || '4517';
const BASE = `http://127.0.0.1:${PORT}`;
const DEFAULT_TRANSPORT_TIMEOUT_MS = 2000;
const STARTUP_HEALTH_TIMEOUT_MS = 250;
const DEFAULT_ASK_TIMEOUT_MS = 60 * 60 * 1000;

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

function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TRANSPORT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener('abort', forwardAbort, { once: true });
  if (options.signal?.aborted) controller.abort();
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  });
}

async function healthStatus(timeoutMs = DEFAULT_TRANSPORT_TIMEOUT_MS) {
  try {
    const r = await fetchWithTimeout(`${BASE}/health`, {}, timeoutMs);
    const body = await r.json().catch(() => ({}));
    return { response: r, body };
  } catch {
    return null;
  }
}

// Sunucunun ayakta VE aynı bridge sözleşmesini sunduğunu kontrol et. Eksik veya
// farklı protocol/package kimliği eski ya da yabancı daemon anlamına gelir.
async function isUp({ timeoutMs = DEFAULT_TRANSPORT_TIMEOUT_MS } = {}) {
  const health = await healthStatus(timeoutMs);
  return Boolean(
    health?.response.ok &&
    isCompatibleHealth(health.body, {
      app: APP_ID,
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      packageVersion,
    })
  );
}

function managedServerPath() {
  return path.join(HERE, '..', 'server', 'server.js');
}

function managedPids(serverPath) {
  if (process.platform === 'win32') return [];
  try {
    const output = execFileSync('lsof', ['-ti', `tcp:${PORT}`], { encoding: 'utf8' });
    return output
      .split(/\s+/)
      .filter((pid) => /^\d+$/.test(pid))
      .filter((pid) => {
        try {
          const command = execFileSync('ps', ['-p', pid, '-o', 'command='], {
            encoding: 'utf8',
          });
          return command.includes(serverPath);
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

function stopManagedServer() {
  for (const pid of managedPids(managedServerPath())) {
    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch {
      // Process may exit between verification and kill. Foreign processes are
      // never targeted because their command line was not an exact runtime path.
    }
  }
}

// Aynı process'te eşzamanlı çağrılar tek spawn paylaşsın (single-flight).
let inflight = null;

/**
 * Köprü sunucusunun çalıştığından emin ol; gerekirse başlat.
 * @returns {Promise<boolean>} Sunucu hazırsa true, başlatılamazsa false.
 */
export async function ensureServer() {
  const health = await healthStatus();
  if (
    health?.response.ok &&
    isCompatibleHealth(health.body, {
      app: APP_ID,
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      packageVersion,
    })
  )
    return true;
  if (health?.response) stopManagedServer();
  if (inflight) return inflight; // ponytail: zaten uçan bir spawn varsa onu bekle
  inflight = startServer().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function startServer() {
  const serverPath = managedServerPath();
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
    if (await isUp({ timeoutMs: STARTUP_HEALTH_TIMEOUT_MS })) return true;
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
export function openBrowser({ url = BASE } = {}) {
  const browser = Settings.inspect().effective.browser || {};
  if (
    browser.strategy === 'manual' ||
    (browser.strategy === 'auto' && process.env.ASKUSER_OPEN_BROWSER === '0')
  ) {
    log('browser', 'browser opening disabled by ASKUSER_OPEN_BROWSER=0');
    return { attempted: false, strategy: 'manual', url };
  }
  const plat = process.platform;
  const cmd = plat === 'darwin' ? 'open' : plat === 'win32' ? 'cmd' : 'xdg-open';
  const args = plat === 'win32' ? ['/c', 'start', '', url] : [url];
  // ponytail: spawn() senkron throw etmez; hata async 'error' event'inden gelir.
  // Ölü try/catch yerine tek error handler — 'open'/'xdg-open' yoksa çökmesin.
  const c = spawn(cmd, args, { stdio: 'ignore', detached: true });
  c.on('error', (e) => log('browser', e));
  c.unref();
  return {
    attempted: true,
    strategy: browser.strategy || 'auto',
    profile: browser.profile || null,
    url,
  };
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
  intervalMs = deliveryPolicy(Settings.inspect()).retryMs || intervalMs;
  const deadline = Date.now() + timeoutMs;
  const query = requestId ? `?requestId=${encodeURIComponent(requestId)}` : '';
  for (;;) {
    try {
      const remaining = Math.max(1, deadline - Date.now());
      const r = await fetchWithTimeout(
        `${BASE}/current${query}`,
        {},
        Math.min(DEFAULT_TRANSPORT_TIMEOUT_MS, remaining)
      );
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
  timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_ASK_TIMEOUT_MS;
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
    lifecycle?.finish('completed', { deadlineOwner: 'none' });
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
 * through the bounded detached period; after resume it remains reconnecting
 * until the browser answers or an explicit cancellation occurs.
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

/** Return only the bridge's redacted metadata for recoverable rounds. */
export async function listRecoverableRounds() {
  const r = await fetchWithTimeout(`${BASE}/rounds`);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new BridgeError(body?.error || `bridge returned ${r.status}`, {
      status: r.status,
      body,
    });
  }
  if (!Array.isArray(body?.rounds)) {
    throw new Error('bridge recovery discovery response missing rounds array');
  }
  return body.rounds;
}

/** Cancel one exact active round after an explicit user request. */
export async function cancelRound(selector, reason = 'user cancelled') {
  const selected =
    typeof selector === 'string' && selector
      ? { requestId: selector }
      : selector &&
          typeof selector === 'object' &&
          (typeof selector.requestId === 'string' || typeof selector.roundId === 'string')
        ? selector
        : null;
  if (!selected) {
    throw new BridgeError('cancelRound requires an explicit requestId or roundId', {
      status: 400,
      body: { reason: 'invalid_selector' },
    });
  }

  let roundId = selected.roundId;
  if (!roundId && selected.requestId) {
    const rounds = await listRecoverableRounds();
    roundId = rounds.find((round) => round.requestId === selected.requestId)?.roundId;
    if (!roundId) {
      throw new BridgeError('no active round matches the requestId', {
        status: 409,
        body: { reason: 'stale_round' },
      });
    }
  }

  const r = await fetchWithTimeout(`${BASE}/rounds/${encodeURIComponent(roundId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new BridgeError(body?.error || `bridge returned ${r.status}`, {
      status: r.status,
      body,
    });
  }
  return body;
}

/** Explicitly cancel an MCP round before closing its host-owned HTTP stream. */
export async function cancelBridge(requestId, reason = 'host cancelled') {
  const query = requestId ? `?requestId=${encodeURIComponent(requestId)}` : '';
  const currentResponse = await fetchWithTimeout(`${BASE}/current${query}`);
  const current = await currentResponse.json().catch(() => ({}));
  if (current?.id == null) return false;
  const r = await fetchWithTimeout(`${BASE}/cancel`, {
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
