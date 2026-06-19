#!/usr/bin/env node
// JSON-RPC 2.0 MCP sunucusu — STDIO üzerinden çalışır.
// Tüm tanılama/log mesajları STDERR'e gider; STDOUT yalnızca protokol kanalıdır.
// Node core dışında sıfır bağımlılık.

process.on('uncaughtException', (e) => process.stderr.write(`[askuserquestionspro-mcp] uncaughtException: ${e}\n`));
process.on('unhandledRejection', (r) => process.stderr.write(`[askuserquestionspro-mcp] unhandledRejection: ${r}\n`));

// ASK aracı tanımı — maxItems YOK: sınırsız soru desteklenir.
const ASK_TOOL = {
  name: 'ask',
  description:
    'Ask the user one or MANY multiple-choice questions in a rich full-screen local UI, then return their answers. ' +
    'Use this INSTEAD of the built-in AskUserQuestion tool whenever you need to ask MORE THAN 4 questions at once, ' +
    'or to present a large questionnaire (dozens to hundreds of questions) on a single review-and-submit screen. ' +
    'There is NO limit on the number of questions. Blocks until the user submits. ' +
    'Returns a JSON object mapping each question to the chosen option label(s).',
  inputSchema: {
    type: 'object',
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        minItems: 1,
        description: 'The questions to ask, shown together on one screen.',
        items: {
          type: 'object',
          required: ['question', 'header', 'options'],
          properties: {
            question: { type: 'string', description: 'The full question text.' },
            header: { type: 'string', description: 'A short section/group label (used to group questions in the UI).' },
            multiSelect: { type: 'boolean', description: 'Allow selecting multiple options.' },
            options: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['label'],
                properties: {
                  label: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  },
};

// JSON-RPC yanıtı oluştur ve STDOUT'a yaz.
function sendResponse(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// JSON-RPC hata yanıtı gönder.
function sendError(id, code, message) {
  sendResponse({ jsonrpc: '2.0', id, error: { code, message } });
}

// 'ask' aracı çağrısını işle.
async function handleAsk(args) {
  if (!Array.isArray(args?.questions) || args.questions.length === 0) {
    return {
      content: [{ type: 'text', text: "Invalid input: 'questions' must be a non-empty array." }],
      isError: true,
    };
  }

  // ESM modülü dinamik olarak içe aktar (hem hook hem MCP paylaşır).
  const { ensureServer, openBrowser, askBridge } =
    await import('../lib/bridge-client.mjs');

  if (!(await ensureServer())) {
    return {
      content: [{
        type: 'text',
        text: 'askuserquestionspro bridge unavailable — could not start the local UI server. Fall back to the built-in AskUserQuestion tool (max 4 questions per call).',
      }],
      isError: true,
    };
  }

  openBrowser();

  let answers;
  try {
    answers = await askBridge(args.questions, { timeoutMs: 30 * 60 * 1000 });
  } catch {
    return {
      content: [{
        type: 'text',
        text: 'askuserquestionspro UI did not return answers (timeout, cancellation, or another set was pending). Fall back to the built-in AskUserQuestion tool.',
      }],
      isError: true,
    };
  }

  // Kullanıcı tüm soruları iptal etti veya atladı.
  if (answers == null || (typeof answers === 'object' && Object.keys(answers).length === 0)) {
    return {
      content: [{ type: 'text', text: 'The user submitted no answers (cancelled or skipped all).' }],
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ answers }, null, 2) }],
  };
}

// Gelen JSON-RPC mesajını işle.
async function handleMessage(msg) {
  const { jsonrpc, id, method, params } = msg;

  // Bildirim (id yok) — yanıt gönderme.
  if (id === undefined || id === null) {
    process.stderr.write(`[askuserquestionspro-mcp] bildirim alındı: ${method}\n`);
    return;
  }

  if (method === 'initialize') {
    const protocolVersion =
      typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2024-11-05';
    sendResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'askuserquestionspro', version: '1.0.0' },
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
    const toolResult = await handleAsk(params?.arguments);
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

process.stdin.on('data', async (chunk) => {
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
      // Ayrıştırılamayan satır — id bilinmiyor, stderr'e logla ve devam et.
      process.stderr.write(`[askuserquestionspro-mcp] JSON ayrıştırma hatası: ${e.message} — satır: ${trimmed.slice(0, 100)}\n`);
      continue;
    }
    try {
      await handleMessage(msg);
    } catch (e) {
      process.stderr.write(`[askuserquestionspro-mcp] mesaj işleme hatası: ${e}\n`);
      // id varsa hata yanıtı gönder.
      if (msg.id !== undefined && msg.id !== null) {
        sendError(msg.id, -32603, 'internal error');
      }
    }
  }
});

process.stdin.on('end', () => {
  // Kalan buffer'ı işle.
  const trimmed = buffer.trim();
  if (trimmed) {
    let msg;
    try { msg = JSON.parse(trimmed); } catch { return; }
    handleMessage(msg).catch((e) => process.stderr.write(`[askuserquestionspro-mcp] son satır hatası: ${e}\n`));
  }
});
