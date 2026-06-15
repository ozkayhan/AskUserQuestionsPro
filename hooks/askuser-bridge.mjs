#!/usr/bin/env node
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { buildHookOutput } = require("./hook-output.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ASKUSER_PORT || "4517";
const BASE = `http://127.0.0.1:${PORT}`;
const TIMEOUT_MS = 5 * 60 * 1000;

// Her beklenmedik hata native picker'a düşmeli (ARCHITECTURE §7 değişmezi).
process.on("uncaughtException", () => process.exit(0));
process.on("unhandledRejection", () => process.exit(0));

function readStdin() {
  return new Promise((resolve) => {
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => resolve(d));
    process.stdin.on("error", () => resolve(d));
  });
}

async function isUp() {
  try { return (await fetch(`${BASE}/health`)).ok; } catch { return false; }
}

async function ensureServer() {
  if (await isUp()) return true;
  const child = spawn(process.execPath, [path.join(HERE, "..", "server", "server.js")], {
    detached: true, stdio: "ignore", env: process.env,
  });
  child.on("error", () => {}); // spawn başarısızsa aşağıdaki poll false döner
  child.unref();
  for (let i = 0; i < 30; i++) { if (await isUp()) return true; await delay(100); }
  return false;
}

// Tarayıcıyı platforma uygun komutla aç; başarısızlık AKIŞI BOZMASIN.
function openBrowser() {
  const plat = process.platform;
  const cmd = plat === "darwin" ? "open" : plat === "win32" ? "cmd" : "xdg-open";
  const args = plat === "win32" ? ["/c", "start", "", BASE] : [BASE];
  try {
    const c = spawn(cmd, args, { stdio: "ignore", detached: true });
    c.on("error", () => {}); // 'open'/'xdg-open' yoksa unhandled 'error' ile çökmesin
    c.unref();
  } catch { /* yok say — kullanıcı sekmeyi elle açabilir */ }
}

// stdout'u flush ederek çık: process.exit() bekleyen pipe yazımını kesebilir (B5).
function writeAndExit(payload) {
  process.exitCode = 0;
  process.stdout.write(payload, () => process.exit(0));
}

async function main() {
  const raw = await readStdin();
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); } // bozuk → native UI
  const toolInput = input.tool_input || {};
  if (!toolInput.questions) process.exit(0);

  if (!(await ensureServer())) process.exit(0); // köprü yok → native fallback

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let answers;
  try {
    const askPromise = fetch(`${BASE}/ask`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions: toolInput.questions }), signal: controller.signal,
    });
    openBrowser();
    const r = await askPromise;
    if (!r.ok) throw new Error(`bridge returned ${r.status}`); // 409/4xx/5xx → native fallback
    answers = (await r.json()).answers;
  } catch {
    clearTimeout(timer);
    process.exit(0); // timeout/hata → native fallback
  }
  clearTimeout(timer);

  // Cevap yok ya da hiçbir soru cevaplanmamış ({}) → native picker'a düş.
  if (answers == null || (typeof answers === "object" && Object.keys(answers).length === 0)) {
    process.exit(0);
  }
  writeAndExit(JSON.stringify(buildHookOutput(toolInput, answers)));
}

main().catch(() => process.exit(0)); // her sapma → native fallback
