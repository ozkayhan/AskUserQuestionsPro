#!/usr/bin/env node
import { createRequire } from "node:module";
import { ensureServer, openBrowser, askBridge } from "../lib/bridge-client.mjs";

const require = createRequire(import.meta.url);
const { buildHookOutput } = require("./hook-output.js");

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

  // ASKUI_FORCE_MCP etkinse modeli mcp__askui__ask aracını kullanmaya yönlendir.
  // Varsayılan davranışı değiştirmez — yalnızca açıkça etkinleştirildiğinde çalışır.
  if (process.env.ASKUI_FORCE_MCP) {
    writeAndExit(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Use the mcp__askui__ask tool instead — it can ask unlimited questions in one rich UI.",
      },
    }));
    return;
  }

  if (!(await ensureServer())) process.exit(0); // köprü yok → native fallback

  let answers;
  try {
    const askPromise = askBridge(toolInput.questions, { timeoutMs: TIMEOUT_MS });
    openBrowser();
    answers = await askPromise;
  } catch {
    process.exit(0); // timeout/hata → native fallback
  }

  // Cevap yok ya da hiçbir soru cevaplanmamış ({}) → native picker'a düş.
  if (answers == null || (typeof answers === "object" && Object.keys(answers).length === 0)) {
    process.exit(0);
  }
  writeAndExit(JSON.stringify(buildHookOutput(toolInput, answers)));
}

main().catch(() => process.exit(0)); // her sapma → native fallback
