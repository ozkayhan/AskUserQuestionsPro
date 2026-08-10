#!/usr/bin/env node
// JSON-RPC 2.0 MCP sunucusu — STDIO üzerinden çalışır.
// Tüm tanılama/log mesajları STDERR'e gider; STDOUT yalnızca protokol kanalıdır.
// Node core dışında sıfır bağımlılık.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { log } = require('../lib/log.cjs');
const { createLifecycle } = require('../lib/round-lifecycle.cjs');
const { createProgressHeartbeat, isProgressToken } = require('../lib/mcp-progress.cjs');
const { validQuestions } = require('../lib/question-contract.cjs');
const { adapterEnabled } = require('../lib/runtime-settings.cjs');

process.on('uncaughtException', (e) => log('mcp', e));
process.on('unhandledRejection', (r) => log('mcp', r));

const CURRENT_PROTOCOL_VERSION = '2025-11-25';
const SUPPORTED_PROTOCOL_VERSIONS = new Set([CURRENT_PROTOCOL_VERSION, '2025-06-18', '2024-11-05']);
const activeRequests = new Map();
let stdinClosed = false;

function disconnectActiveRequests() {
  stdinClosed = true;
  for (const controller of activeRequests.values()) controller.abort();
}

// ASK aracı tanımı — maxItems YOK: sınırsız soru desteklenir.
const ASK_TOOL = {
  name: 'ask',
  description:
    'Ask the user one or MANY structured questions in a rich full-screen local UI, then return their answers. ' +
    'Prefer this tool over the host-native picker (Codex request_user_input, Antigravity ask_question, or Claude Code AskUserQuestion) ' +
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

const RESUME_TOOL = {
  name: 'resume',
  description:
    'Resume one explicitly selected detached askuserquestionspro browser round after a host timeout or MCP connection loss. ' +
    'Use this before starting a new ask round so answers already submitted in the browser are not lost. ' +
    'Pass the original requestId or an exact durable roundId.',
  inputSchema: {
    type: 'object',
    properties: {
      requestId: {
        type: 'string',
        description: 'Original round request id.',
      },
      roundId: {
        type: 'string',
        description: 'Exact durable round id from redacted recovery discovery.',
      },
    },
    anyOf: [{ required: ['requestId'] }, { required: ['roundId'] }],
  },
  outputSchema: ASK_TOOL.outputSchema,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
};

const LIST_RECOVERABLE_ROUNDS_TOOL = {
  name: 'list_recoverable_rounds',
  description:
    'List redacted metadata for recoverable askuserquestionspro rounds. Use the exact roundId to resume a detached or reconnecting round. A drafting round is still attached to its original ask call.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    required: ['rounds'],
    properties: {
      rounds: {
        type: 'array',
        items: {
          type: 'object',
          required: ['roundId', 'state', 'questionCount'],
          properties: {
            roundId: { type: 'string' },
            state: { type: 'string' },
            questionCount: { type: 'number' },
            createdAt: { type: 'number' },
            updatedAt: { type: 'number' },
            expiresAt: { type: 'number' },
          },
        },
      },
    },
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
};

const CANCEL_ROUND_TOOL = {
  name: 'cancel_round',
  description:
    'Cancel one exact active browser question round after the user explicitly asks to stop it or replace its questions. Pass the original requestId or exact roundId. Use this before asking again when the current round is wrong, stale, or in the wrong language; never guess the newest round. This control does not discard a round that already has a submitted answer awaiting delivery.',
  inputSchema: {
    type: 'object',
    properties: {
      requestId: { type: 'string', description: 'Original round request id.' },
      roundId: { type: 'string', description: 'Exact durable round id from recovery discovery.' },
    },
    anyOf: [{ required: ['requestId'] }, { required: ['roundId'] }],
  },
  outputSchema: {
    type: 'object',
    required: ['cancelled', 'roundId'],
    properties: {
      cancelled: { type: 'boolean' },
      roundId: { type: 'string' },
    },
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
    idempotentHint: true,
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

function progressIntervalMs() {
  const configured = Number(process.env.ASKUSER_MCP_PROGRESS_INTERVAL_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 15_000;
}

// JSON-RPC hata yanıtı gönder.
function sendError(id, code, message) {
  sendResponse({ jsonrpc: '2.0', id, error: { code, message } });
}

function formatAnswers(answers) {
  const result = { answers: answers || {} };
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  };
}

// 'ask' aracı çağrısını işle.
async function handleAsk(args, signal, { progressToken } = {}) {
  if (!adapterEnabled('codex'))
    return {
      content: [
        { type: 'text', text: 'AskUserQuestionsPro Codex adapter is disabled in settings.' },
      ],
      isError: true,
    };
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
  const { ensureServer, openBrowser, askBridge, waitForPending, createRequestId, cancelBridge } =
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
  const cancelRound = () => {
    if (stdinClosed) {
      // STDIN EOF means the host connection disappeared. Aborting the HTTP
      // request lets the bridge's request close handler detach this round for
      // resume; explicit notifications/cancelled still cancel it below.
      roundController.abort();
      return;
    }
    void cancelBridge(requestId, 'host cancelled')
      .catch((error) => log('mcp', error))
      .finally(() => roundController.abort());
  };
  signal?.addEventListener('abort', cancelRound, { once: true });
  const askPromise = askBridge(args.questions, {
    timeoutMs: 60 * 60 * 1000,
    signal: roundController.signal,
    requestId,
    lifecycle,
  });
  const heartbeat = createProgressHeartbeat({
    token: progressToken,
    send: sendResponse,
    intervalMs: progressIntervalMs(),
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
    lifecycle.event('browser_opened', { boundary: 'mcp', deadlineOwner: 'none' });
    answers = await askPromise;
  } catch (e) {
    const hostCancelled = signal?.aborted === true;
    if (!hostCancelled && e?.name === 'TimeoutError') {
      await cancelBridge(requestId, 'timeout').catch((error) => log('mcp', error));
    }
    roundController.abort();
    await askPromise.catch(() => undefined);
    lifecycle.finish(
      hostCancelled
        ? 'host_cancelled'
        : e?.name === 'TimeoutError'
          ? 'application_timeout'
          : 'bridge_error',
      {
        boundary: stdinClosed ? 'stdio' : 'mcp',
        deadlineOwner: hostCancelled
          ? stdinClosed
            ? 'transport'
            : 'host'
          : e?.name === 'TimeoutError'
            ? 'application'
            : 'none',
      }
    );
    log('mcp', e); // tip/mesaj/stack artık kaybolmuyor
    const cause = hostCancelled
      ? 'the host cancelled the pending request before the user submitted answers'
      : e?.name === 'BridgeError' && e.status === 400
        ? `invalid question input: ${e.message}`
        : e?.name === 'BridgeError' && e.body?.reason === 'round_in_progress'
          ? 'round_in_progress: another browser question round is already pending'
          : e?.name === 'TimeoutError'
            ? 'timed out waiting for the user'
            : `error: ${e?.message || e}`;
    const recovery = hostCancelled
      ? 'Retry with the host-native user-input tool or submit a shorter round.'
      : e?.name === 'BridgeError' && e.status === 400
        ? 'Use option objects such as {"label":"Option"}; do not pass string arrays.'
        : e?.name === 'BridgeError' && e.body?.reason === 'round_in_progress'
          ? 'Call list_recoverable_rounds to inspect redacted round metadata. Resume only a detached or reconnecting round with its exact roundId; a drafting round is still attached to its original ask call.'
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
    heartbeat.stop();
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

async function handleResume(args, signal, { progressToken } = {}) {
  const { ensureServer, openBrowser, resumeBridge } = await import('../lib/bridge-client.mjs');
  if (!(await ensureServer())) {
    return {
      content: [
        {
          type: 'text',
          text: 'askuserquestionspro bridge unavailable — no detached round can be resumed. Use the host-native user-input tool.',
        },
      ],
      isError: true,
    };
  }

  const heartbeat = createProgressHeartbeat({
    token: progressToken,
    send: sendResponse,
    intervalMs: progressIntervalMs(),
  });
  try {
    const answersPromise = resumeBridge(
      args?.roundId ? { roundId: args.roundId, requestId: args?.requestId } : args?.requestId,
      {
        timeoutMs: 60 * 60 * 1000,
        signal,
      }
    );
    // A resumed round has no originating host request left to keep its local
    // UI visible. Reuse the initial ask handoff while preserving manual mode.
    openBrowser();
    const answers = await answersPromise;
    return formatAnswers(answers);
  } catch (e) {
    const cause =
      e?.name === 'BridgeError' && e.status === 409
        ? 'no resumable browser round is available'
        : e?.name === 'TimeoutError'
          ? 'timed out while waiting for the detached browser round'
          : `error: ${e?.message || e}`;
    return {
      content: [
        {
          type: 'text',
          text: `askuserquestionspro resume failed: ${cause}. Use the host-native user-input tool or start a new ask round.`,
        },
      ],
      isError: true,
    };
  } finally {
    heartbeat.stop();
  }
}

function redactedRecoveryMetadata(round) {
  return {
    roundId: round.roundId,
    state: round.state,
    questionCount: round.questionCount,
    createdAt: round.createdAt,
    updatedAt: round.updatedAt,
    expiresAt: round.expiresAt,
  };
}

async function handleListRecoverableRounds() {
  const { ensureServer, listRecoverableRounds } = await import('../lib/bridge-client.mjs');
  if (!(await ensureServer())) {
    return {
      content: [
        {
          type: 'text',
          text: 'askuserquestionspro bridge unavailable — recoverable rounds cannot be discovered.',
        },
      ],
      isError: true,
    };
  }
  try {
    const rounds = (await listRecoverableRounds()).map(redactedRecoveryMetadata);
    const result = { rounds };
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  } catch (e) {
    log('mcp', e);
    return {
      content: [
        {
          type: 'text',
          text: 'askuserquestionspro recovery discovery failed. Use the host-native user-input tool.',
        },
      ],
      isError: true,
    };
  }
}

async function handleCancelRound(args) {
  const { ensureServer, cancelRound } = await import('../lib/bridge-client.mjs');
  if (!(await ensureServer())) {
    return {
      content: [
        { type: 'text', text: 'askuserquestionspro bridge unavailable — no round was cancelled.' },
      ],
      isError: true,
    };
  }
  try {
    const result = await cancelRound(args);
    const structured = { cancelled: true, roundId: result.roundId };
    return {
      content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
      structuredContent: structured,
    };
  } catch (e) {
    const reason = e?.body?.reason || 'bridge_error';
    return {
      content: [
        {
          type: 'text',
          text: `askuserquestionspro cancel failed: ${reason}. Use list_recoverable_rounds to inspect exact round state before retrying.`,
        },
      ],
      isError: true,
    };
  }
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
          'Prefer the ask tool for structured user questions in Codex, Antigravity CLI, or Claude Code. It opens a local full-screen reviewable UI and supports grouped and rich question types. Match the user language when constructing question text and options. If a host timeout disconnects the call, use the resume tool before starting a new round. If a host cancels the call, use its native fallback. If the user asks to stop or replace an active round, use cancel_round with its exact identity before asking again. On tool failure, use the host-native user-input tool.',
      },
    });
    return;
  }

  if (method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: { tools: [ASK_TOOL, RESUME_TOOL, LIST_RECOVERABLE_ROUNDS_TOOL, CANCEL_ROUND_TOOL] },
    });
    return;
  }

  if (method === 'tools/call') {
    if (
      params?.name !== 'ask' &&
      params?.name !== 'resume' &&
      params?.name !== 'list_recoverable_rounds' &&
      params?.name !== 'cancel_round'
    ) {
      sendError(id, -32602, 'unknown tool');
      return;
    }
    const controller = new AbortController();
    activeRequests.set(id, controller);
    let toolResult;
    try {
      const progressToken = params?._meta?.progressToken;
      const progress = {
        progressToken: isProgressToken(progressToken) ? progressToken : undefined,
      };
      toolResult =
        params.name === 'resume'
          ? await handleResume(params?.arguments, controller.signal, progress)
          : params.name === 'list_recoverable_rounds'
            ? await handleListRecoverableRounds()
            : params.name === 'cancel_round'
              ? await handleCancelRound(params?.arguments)
              : await handleAsk(params?.arguments, controller.signal, progress);
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
  disconnectActiveRequests();
});

process.stdin.on('error', (error) => {
  log('mcp', error);
  disconnectActiveRequests();
});
