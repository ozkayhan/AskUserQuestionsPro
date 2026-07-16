#!/usr/bin/env node
// JSON-RPC 2.0 MCP sunucusu — STDIO üzerinden çalışır.
// Tüm tanılama/log mesajları STDERR'e gider; STDOUT yalnızca protokol kanalıdır.
// Node core dışında sıfır bağımlılık.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { log } = require('../lib/log.cjs');
const { createLifecycle } = require('../lib/round-lifecycle.cjs');
const { validQuestions } = require('../lib/question-contract.cjs');

process.on('uncaughtException', (e) => log('mcp', e));
process.on('unhandledRejection', (r) => log('mcp', r));

const CURRENT_PROTOCOL_VERSION = '2025-11-25';
const SUPPORTED_PROTOCOL_VERSIONS = new Set([CURRENT_PROTOCOL_VERSION, '2025-06-18', '2024-11-05']);
const activeRequests = new Map();

// ASK aracı tanımı — maxItems YOK: sınırsız soru desteklenir.
const ASK_TOOL = {
  name: 'ask',
  description:
    'Ask the user one or MANY structured questions in a rich full-screen local UI, then return their answers. ' +
    'Prefer this tool over the host-native picker (Codex request_user_input or Claude Code AskUserQuestion) ' +
    'whenever choices, grouped questions, a review screen, or rich question types improve the interaction. ' +
    'There is NO question-count limit. Blocks until the user submits.\n\n' +
    'QUESTION TYPE GUIDE — set "type" on each question:\n' +
    '  • "single"  — pick exactly one option from a list. Returns: string (chosen label).\n' +
    '  • "multi"   — pick one or more options. Set multiSelect:true. Returns: string[] (chosen labels).\n' +
    '  • "binary"  — two-option yes/no choice; omit options for default ["Evet","Hayır"]. Returns: string.\n' +
    '  • "scale"   — numeric slider; requires min, max (integers), optional step (default 1), optional leftLabel/rightLabel. Returns: number.\n' +
    '  • "ranking" — order items by priority; provide options (≥2). Returns: string[] ordered most→least important.\n' +
    '  • "tree"    — multi-level decision tree; SEND THE ENTIRE TREE IN ONE CALL, leaf nodes are the final answers (no children or empty children array). Max depth: 6. Returns: string[] path from root to chosen leaf.\n\n' +
    'If "type" is omitted: multiSelect:true → "multi", otherwise → "single" (backward-compatible).\n' +
    'Returns {"answers": {...}}, where the nested object maps each answered question text to its typed value.',
  inputSchema: {
    // $defs: özyinelemeli option (tree desteği için children içerir)
    $defs: {
      option: {
        type: 'object',
        required: ['label'],
        properties: {
          label: { type: 'string' },
          description: { type: 'string' },
          children: {
            type: 'array',
            items: { $ref: '#/$defs/option' },
            description:
              'Alt seçenekler (yalnızca tree tipinde). Yoksa/boşsa bu düğüm yaprak (nihai cevap).',
          },
        },
      },
    },
    type: 'object',
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        minItems: 1,
        description: 'The questions to ask, shown together on one screen.',
        items: {
          type: 'object',
          // options artık required değil: binary ve scale options'sız olabilir
          required: ['question', 'header'],
          properties: {
            question: { type: 'string', description: 'The full question text.' },
            header: {
              type: 'string',
              description: 'A short section/group label (used to group questions in the UI).',
            },
            type: {
              type: 'string',
              enum: ['single', 'multi', 'binary', 'scale', 'ranking', 'tree'],
              description: 'Soru tipi. Belirtilmezse multiSelect:true→"multi", aksi→"single".',
            },
            multiSelect: {
              type: 'boolean',
              description: 'Allow selecting multiple options (shorthand for type:"multi").',
            },
            // scale alanları
            min: { type: 'number', description: 'Scale minimum değeri (scale tipinde zorunlu).' },
            max: { type: 'number', description: 'Scale maksimum değeri (scale tipinde zorunlu).' },
            step: { type: 'number', description: 'Scale adım büyüklüğü (varsayılan 1).' },
            leftLabel: { type: 'string', description: 'Scale sol uç etiketi.' },
            rightLabel: { type: 'string', description: 'Scale sağ uç etiketi.' },
            options: {
              type: 'array',
              minItems: 1,
              description:
                'Seçenekler obje olmalıdır: [{"label":"Seçenek"}]. String dizileri geçersizdir. binary: tam 2 şık veya omit. scale: verilirse yoksayılır.',
              // Kök seçenek şemasını inline yayınla. Bazı hostlar $ref'i
              // çözmeden Array<unknown> gösterdiği için modelin string dizi
              // üretmesini engeller; tree children yine recursive $defs kullanır.
              items: {
                type: 'object',
                required: ['label'],
                properties: {
                  label: { type: 'string' },
                  description: { type: 'string' },
                  children: {
                    type: 'array',
                    items: { $ref: '#/$defs/option' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['answers'],
    properties: {
      answers: {
        type: 'object',
        description: 'Map from each answered question text to its typed answer value.',
      },
    },
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: false,
  },
};

// JSON-RPC yanıtı oluştur ve STDOUT'a yaz.
// stdout broken pipe (EPIPE) atarsa logla — uncaughtException'a düşürmeyelim,
// aksi halde tek bir yazma hatası tüm sunucuyu çökertir.
function sendResponse(obj) {
  try {
    process.stdout.write(JSON.stringify(obj) + '\n');
  } catch (e) {
    log('mcp', e);
  }
}

// JSON-RPC hata yanıtı gönder.
function sendError(id, code, message) {
  sendResponse({ jsonrpc: '2.0', id, error: { code, message } });
}

// 'ask' aracı çağrısını işle.
async function handleAsk(args, signal) {
  if (!Array.isArray(args?.questions) || args.questions.length === 0) {
    return {
      content: [{ type: 'text', text: "Invalid input: 'questions' must be a non-empty array." }],
      isError: true,
    };
  }

  const validation = validQuestions(args.questions);
  if (!validation.ok) {
    return {
      content: [
        {
          type: 'text',
          text: `Invalid question input: ${validation.error}`,
        },
      ],
      isError: true,
    };
  }

  // ESM modülü dinamik olarak içe aktar (hem hook hem MCP paylaşır).
  const { ensureServer, openBrowser, askBridge, waitForPending, createRequestId } =
    await import('../lib/bridge-client.mjs');

  if (!(await ensureServer())) {
    return {
      content: [
        {
          type: 'text',
          text: 'askuserquestionspro bridge unavailable — could not start the local UI server. Use the host-native user-input tool if it is available in the current mode; otherwise ask the user directly.',
        },
      ],
      isError: true,
    };
  }
  const requestId = createRequestId();
  const lifecycle = createLifecycle({ adapter: 'mcp', requestId });
  if (signal?.aborted) {
    lifecycle.finish('host_cancelled');
    return {
      content: [{ type: 'text', text: 'askuserquestionspro request cancelled.' }],
      isError: true,
    };
  }

  let answers;
  const roundController = new AbortController();
  const cancelRound = () => roundController.abort();
  signal?.addEventListener('abort', cancelRound, { once: true });
  const askPromise = askBridge(args.questions, {
    timeoutMs: 60 * 60 * 1000,
    signal: roundController.signal,
    requestId,
    lifecycle,
  });
  try {
    // HTTP 400/500 gibi erken bridge hataları, pending poll'unun 5 saniyelik
    // timeout'u tarafından maskelenmemeli. Başarısız askPromise'i pending poll
    // ile birlikte bekleyerek gerçek nedeni anında yüzeye çıkar.
    const earlyFailure = askPromise.then(
      () => new Promise(() => {}),
      (error) => Promise.reject(error)
    );
    const registered = await Promise.race([
      waitForPending({ timeoutMs: 5000, requestId }),
      earlyFailure,
    ]);
    if (!registered) {
      // /current yoklaması best-effort'tur; geç görünen round yine de
      // askPromise üzerinden tamamlanabilir.
      log('mcp', 'pending round not visible within 5 seconds; continuing to wait for ask');
    }
    openBrowser();
    lifecycle.event('browser_opened');
    answers = await askPromise;
  } catch (e) {
    roundController.abort();
    await askPromise.catch(() => undefined);
    lifecycle.finish(
      e?.name === 'TimeoutError'
        ? 'application_timeout'
        : signal?.aborted
          ? 'host_cancelled'
          : 'bridge_error'
    );
    log('mcp', e); // tip/mesaj/stack artık kaybolmuyor
    const cause =
      e?.name === 'BridgeError' && e.status === 400
        ? `invalid question input: ${e.message}`
        : e?.name === 'TimeoutError'
          ? 'timed out waiting for the user'
          : `error: ${e?.message || e}`;
    const recovery =
      e?.name === 'BridgeError' && e.status === 400
        ? 'Use option objects such as {"label":"Option"}; do not pass string arrays.'
        : 'Use the host-native user-input tool if it is available in the current host.';
    return {
      content: [
        {
          type: 'text',
          text: `askuserquestionspro failed: ${cause}. ${recovery}`,
        },
      ],
      isError: true,
    };
  } finally {
    signal?.removeEventListener('abort', cancelRound);
  }

  // Kullanıcı tüm soruları iptal etti veya atladı.
  if (answers == null || (typeof answers === 'object' && Object.keys(answers).length === 0)) {
    const empty = { answers: {} };
    return {
      content: [{ type: 'text', text: JSON.stringify(empty, null, 2) }],
      structuredContent: empty,
    };
  }

  const result = { answers };
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  };
}

// Gelen JSON-RPC mesajını işle.
async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'notifications/cancelled') {
    const requestId = params?.requestId ?? params?.id;
    activeRequests.get(requestId)?.abort();
    log('mcp', `request cancelled: ${String(requestId)}`);
    return;
  }

  // Bildirim (id ALANI YOK) — yanıt gönderme. JSON-RPC 2.0'a göre id:null bir
  // bildirim DEĞİL; istek olarak işlenip yanıtlanmalı (yalnızca absent → bildirim).
  if (id === undefined) {
    log('mcp', `bildirim alındı: ${method}`);
    return;
  }

  if (method === 'initialize') {
    const requestedVersion = params?.protocolVersion;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion)
      ? requestedVersion
      : CURRENT_PROTOCOL_VERSION;
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'askuserquestionspro', version: '1.1.0' },
        instructions:
          'Prefer the ask tool for structured user questions in Codex or Claude Code. It opens a local full-screen reviewable UI and supports grouped and rich question types. On tool failure, use the host-native user-input tool.',
      },
    });
    return;
  }

  if (method === 'tools/list') {
    sendResponse({ jsonrpc: '2.0', id, result: { tools: [ASK_TOOL] } });
    return;
  }

  if (method === 'tools/call') {
    if (params?.name !== 'ask') {
      sendError(id, -32602, 'unknown tool');
      return;
    }
    const controller = new AbortController();
    activeRequests.set(id, controller);
    let toolResult;
    try {
      toolResult = await handleAsk(params?.arguments, controller.signal);
    } finally {
      activeRequests.delete(id);
    }
    if (controller.signal.aborted) return;
    sendResponse({ jsonrpc: '2.0', id, result: toolResult });
    return;
  }

  if (method === 'ping') {
    sendResponse({ jsonrpc: '2.0', id, result: {} });
    return;
  }

  // Bilinmeyen metot.
  sendError(id, -32601, 'method not found');
}

// STDIN'den satır satır oku; her satır bir tam JSON-RPC mesajıdır.
let buffer = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  // Son elemanı buffer'da tut (henüz tamamlanmamış satır olabilir).
  buffer = lines.pop();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (e) {
      // Ayrıştırılamayan satır — id bilinmiyor, logla ve devam et.
      log('mcp', `JSON parse error: ${e.message} — line: ${trimmed.slice(0, 100)}`);
      continue;
    }
    handleMessage(msg).catch((e) => {
      log('mcp', e);
      // id alanı varsa (null dahil; yalnızca bildirimde absent) hata yanıtı gönder.
      if (msg.id !== undefined) {
        sendError(msg.id, -32603, 'internal error');
      }
    });
  }
});

process.stdin.on('end', () => {
  // Kalan buffer'ı işle.
  const trimmed = buffer.trim();
  if (trimmed) {
    let msg;
    try {
      msg = JSON.parse(trimmed);
    } catch (e) {
      log('mcp', `JSON parse error: ${e.message} — line: ${trimmed.slice(0, 100)}`);
      return;
    }
    handleMessage(msg).catch((e) => log('mcp', e));
  }
});
