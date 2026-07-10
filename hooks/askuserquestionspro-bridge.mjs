#!/usr/bin/env node
import { createRequire } from 'node:module';
import { ensureServer, openBrowser, askBridge, waitForPending } from '../lib/bridge-client.mjs';

const require = createRequire(import.meta.url);
const { buildHookOutput } = require('./hook-output.js');
const { log } = require('../lib/log.cjs');

const TIMEOUT_MS = 60 * 60 * 1000;
// stdin EOF gelmezse (parent yazma ucunu açık tutarsa) süresiz asılmamak için watchdog.
const STDIN_TIMEOUT_MS = 30 * 1000;

// Her beklenmedik hata native picker'a düşmeli (ARCHITECTURE §7 değişmezi).
// Hata nesnesini logla — yoksa neden native'e düştüğümüz görünmez (operasyonel kör nokta).
process.on('uncaughtException', (err) => {
  log('hook', err);
  process.exit(0);
});
process.on('unhandledRejection', (err) => {
  log('hook', err);
  process.exit(0);
});

function readStdin() {
  return new Promise((resolve) => {
    let d = '';
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      resolve(v);
    };
    // EOF hiç gelmezse boş string ile çöz → main() JSON.parse('') fail → native fallback.
    const watchdog = setTimeout(() => finish(''), STDIN_TIMEOUT_MS);
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => finish(d));
    // 'error'da kısmi veri taşımayı bırak — yarım payload yanlış parse'a yol açmasın.
    process.stdin.on('error', () => finish(''));
  });
}

// stdout'u flush ederek çık: process.exit() bekleyen pipe yazımını kesebilir (B5).
// Callback (err) imzasıyla gelir; EPIPE/EBADF'i yutmayıp loglayalım, yine de exit(0).
function writeAndExit(payload) {
  process.exitCode = 0;
  process.stdout.write(payload, (err) => {
    if (err) log('hook', err);
    process.exit(0);
  });
}

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  } // bozuk → native UI
  const toolInput = input.tool_input || {};
  if (!toolInput.questions) process.exit(0);

  // ASKUI_FORCE_MCP etkinse modeli mcp__askuserquestionspro__ask aracını kullanmaya yönlendir.
  // Varsayılan davranışı değiştirmez — yalnızca açıkça etkinleştirildiğinde çalışır.
  if (process.env.ASKUI_FORCE_MCP) {
    writeAndExit(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'Use the mcp__askuserquestionspro__ask tool instead — it can ask unlimited questions in one rich UI.',
        },
      })
    );
    return;
  }

  if (!(await ensureServer())) process.exit(0); // köprü yok → native fallback

  let answers;
  const roundController = new AbortController();
  try {
    const askPromise = askBridge(toolInput.questions, {
      timeoutMs: TIMEOUT_MS,
      signal: roundController.signal,
    });
    // L-8 race guard: tarayıcıyı yalnızca /ask sunucuda tur olarak kaydedildikten
    // sonra aç. Aksi halde tarayıcı /current'ı POST işlenmeden sorgulayıp boş
    // ("no pending question") sayfa gösterebilirdi.
    askPromise.catch(() => undefined);
    if (!(await waitForPending())) throw new Error('question round was not registered');
    openBrowser();
    answers = await askPromise;
  } catch {
    roundController.abort();
    process.exit(0); // timeout/hata → native fallback
  }

  // Cevap yok ya da hiçbir soru cevaplanmamış ({}) → native picker'a düş.
  if (answers == null || (typeof answers === 'object' && Object.keys(answers).length === 0)) {
    process.exit(0);
  }
  writeAndExit(JSON.stringify(buildHookOutput(toolInput, answers)));
}

main().catch((err) => {
  log('hook', err);
  process.exit(0); // her sapma → native fallback
});
