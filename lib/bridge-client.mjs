// Köprü istemcisi — hem hook hem MCP sunucusu tarafından kullanılan paylaşımlı mantık.
// Node core modülleri dışında bağımlılık yok.

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import APP_ID from './app-id.cjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ASKUSER_PORT || '4517';
const BASE = `http://127.0.0.1:${PORT}`;

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

/**
 * Köprü sunucusunun çalıştığından emin ol; gerekirse başlat.
 * @returns {Promise<boolean>} Sunucu hazırsa true, başlatılamazsa false.
 */
export async function ensureServer() {
  if (await isUp()) return true;
  const serverPath = path.join(HERE, '..', 'server', 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.on('error', () => {}); // spawn başarısızsa aşağıdaki poll false döner
  child.unref();
  for (let i = 0; i < 30; i++) {
    if (await isUp()) return true;
    await delay(100);
  }
  return false;
}

/**
 * Tarayıcıyı platforma uygun komutla aç; başarısızlık akışı bozmasın.
 */
export function openBrowser() {
  const plat = process.platform;
  const cmd = plat === 'darwin' ? 'open' : plat === 'win32' ? 'cmd' : 'xdg-open';
  const args = plat === 'win32' ? ['/c', 'start', '', BASE] : [BASE];
  try {
    const c = spawn(cmd, args, { stdio: 'ignore', detached: true });
    c.on('error', () => {}); // 'open'/'xdg-open' yoksa unhandled 'error' ile çökmesin
    c.unref();
  } catch {
    /* yok say — kullanıcı sekmeyi elle açabilir */
  }
}

/**
 * Köprü sunucusuna soru seti gönder, cevapları bekle.
 * @param {Array} questions - Soru nesneleri dizisi.
 * @param {{ timeoutMs: number }} opts
 * @returns {Promise<object>} answers nesnesi.
 */
export async function askBridge(questions, { timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions }),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`bridge returned ${r.status}`);
    return (await r.json()).answers;
  } finally {
    clearTimeout(timer);
  }
}
