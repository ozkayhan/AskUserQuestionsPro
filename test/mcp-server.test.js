'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');

const MCP_PATH = path.join(__dirname, '..', 'mcp-server', 'askuserquestionspro-mcp.mjs');
const SERVER_PATH = path.join(__dirname, '..', 'server', 'server.js');

// MCP sunucusu spawn edilir; initialize + tools/list gönderilir, yanıtlar doğrulanır.
test('mcp-server: initialize ve tools/list', async (_t) => {
  const child = spawn(process.execPath, [MCP_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const lines = [];
  let outBuf = '';

  // try/finally: Promise reject olsa bile (timeout/error) child mutlaka öldürülür — zombie yok.
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('MCP sunucusu zaman aşımına uğradı')),
        5000
      );

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        outBuf += chunk;
        const parts = outBuf.split('\n');
        outBuf = parts.pop(); // son tamamlanmamış satır
        for (const line of parts) {
          const trimmed = line.trim();
          if (trimmed) {
            lines.push(trimmed);
            if (lines.length >= 2) {
              clearTimeout(timeout);
              resolve();
            }
          }
        }
      });

      child.on('error', (e) => {
        clearTimeout(timeout);
        reject(e);
      });

      // initialize isteği
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2024-11-05', capabilities: {} },
        }) + '\n'
      );

      // tools/list isteği
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        }) + '\n'
      );
    });
  } finally {
    child.kill();
  }

  // İki yanıtı id'ye göre bul.
  const responses = lines
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const initRes = responses.find((r) => r.id === 1);
  const listRes = responses.find((r) => r.id === 2);

  // (a) initialize doğrulama
  assert.ok(initRes, 'initialize yanıtı alınmalı');
  assert.strictEqual(
    initRes.result.serverInfo.name,
    'askuserquestionspro',
    'serverInfo.name "askuserquestionspro" olmalı'
  );
  assert.ok(
    typeof initRes.result.protocolVersion === 'string' && initRes.result.protocolVersion.length > 0,
    'protocolVersion boş olmayan string olmalı'
  );
  assert.match(initRes.result.instructions, /Codex|Claude Code/);

  // (b) tools/list doğrulama
  assert.ok(listRes, 'tools/list yanıtı alınmalı');
  const tools = listRes.result.tools;
  assert.ok(Array.isArray(tools) && tools.length > 0, 'tools dizisi boş olmamalı');
  const askTool = tools.find((t) => t.name === 'ask');
  assert.ok(askTool, '"ask" adında araç olmalı');
  assert.match(askTool.description, /request_user_input/);
  assert.deepStrictEqual(askTool.outputSchema.required, ['answers']);
  assert.strictEqual(askTool.annotations.readOnlyHint, true);
  assert.strictEqual(askTool.annotations.destructiveHint, false);
  const schema = askTool.inputSchema;
  const qSchema = schema.properties.questions;
  assert.ok(qSchema, 'questions özelliği olmalı');
  assert.strictEqual(qSchema.maxItems, undefined, 'questions.maxItems OLMAMALI (sınırsız)');
  const itemRequired = qSchema.items.required;
  assert.ok(
    Array.isArray(itemRequired) && itemRequired.includes('question'),
    'items.required "question" içermeli'
  );
  // options artık required listesinde OLMAMALI (binary/scale opsiyonel)
  assert.ok(
    !itemRequired.includes('options'),
    'items.required "options" içermemeli (binary/scale için opsiyonel)'
  );

  // (c) type enum kontrolü
  const itemProps = qSchema.items.properties;
  assert.ok(itemProps.type, 'items.properties.type olmalı');
  assert.ok(Array.isArray(itemProps.type.enum), 'type.enum dizi olmalı');
  const expectedTypes = ['single', 'multi', 'binary', 'scale', 'ranking', 'tree'];
  for (const tp of expectedTypes) {
    assert.ok(itemProps.type.enum.includes(tp), `type.enum "${tp}" içermeli`);
  }

  // (d) $defs kontrolü — özyinelemeli option tanımı
  assert.ok(schema.$defs, 'inputSchema.$defs olmalı');
  assert.ok(schema.$defs.option, '$defs.option tanımı olmalı');
  const optDef = schema.$defs.option;
  assert.ok(optDef.properties.label, '$defs.option label alanı olmalı');
  assert.ok(optDef.properties.children, '$defs.option children alanı olmalı');
  assert.ok(
    optDef.properties.children.items && optDef.properties.children.items.$ref,
    '$defs.option.children.items.$ref olmalı (özyinelemeli)'
  );

  // (e) root options şeması inline olmalı; recursive children $defs'e referans verebilir.
  assert.ok(
    itemProps.options && itemProps.options.items && itemProps.options.items.type === 'object',
    'options.items inline object olmalı'
  );
  assert.deepStrictEqual(itemProps.options.items.required, ['label']);
  assert.strictEqual(itemProps.options.items.properties.label.type, 'string');
  assert.ok(itemProps.options.items.properties.children.items.$ref);

  // (f) scale alanları
  assert.ok(itemProps.min, 'min alanı olmalı');
  assert.ok(itemProps.max, 'max alanı olmalı');
  assert.ok(itemProps.step, 'step alanı olmalı');
  assert.ok(itemProps.leftLabel, 'leftLabel alanı olmalı');
  assert.ok(itemProps.rightLabel, 'rightLabel alanı olmalı');

  // Runtime validator scale sorularında options'ı reddeder; şema da bunu
  // makine tarafından görünür kılmalı, aksi halde geçerli görünen payload
  // bridge açılmadan Invalid question input ile sonuçlanır.
  assert.ok(Array.isArray(qSchema.items.allOf), 'scale koşulu allOf içinde olmalı');
  const scaleRule = qSchema.items.allOf.find(
    (rule) => rule.if?.properties?.type?.const === 'scale'
  );
  assert.ok(scaleRule, 'scale için koşullu şema kuralı olmalı');
  assert.deepStrictEqual(scaleRule.then, { not: { required: ['options'] } });
});

test('mcp-server: string options bridge timeoutuna düşmeden açık giriş hatası döndürür', async () => {
  const child = spawn(process.execPath, [MCP_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('MCP doğrulama yanıtı zaman aşımına uğradı')),
        1000
      );
      child.stdout.setEncoding('utf8');
      child.stdout.once('data', (chunk) => {
        clearTimeout(timeout);
        resolve(JSON.parse(chunk.trim()));
      });
      child.on('error', reject);
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: 'ask',
            arguments: {
              questions: [
                {
                  question: 'Mevsim?',
                  header: 'Test',
                  options: ['İlkbahar', 'Yaz'],
                },
              ],
            },
          },
        }) + '\n'
      );
    });
    assert.strictEqual(response.result.isError, true);
    const text = response.result.content?.[0]?.text || '';
    assert.match(text, /Invalid question input/i);
    assert.match(text, /label/i);
    assert.doesNotMatch(text, /question round was not registered/i);
  } finally {
    child.kill();
  }
});

test('mcp-server: bilinmeyen protocolVersion fresh bağlantıda güncele müzakere edilir', async () => {
  const child = spawn(process.execPath, [MCP_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('zaman aşımı')), 5000);
      child.stdout.setEncoding('utf8');
      child.stdout.once('data', (chunk) => {
        clearTimeout(timeout);
        resolve(JSON.parse(chunk.trim()));
      });
      child.on('error', reject);
      child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2099-01-01', capabilities: {} },
        }) + '\n'
      );
    });
    assert.strictEqual(response.result.protocolVersion, '2025-11-25');
  } finally {
    child.kill();
  }
});

test('mcp-server: notifications/cancelled aktif tools/call isteğini bridge üzerinde bırakmaz', async () => {
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const xdg = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-mcp-cancel-'));
  const env = { ...process.env, ASKUSER_PORT: String(port), XDG_CONFIG_HOME: xdg };
  const server = spawn(process.execPath, [SERVER_PATH], { stdio: 'ignore', env });
  const mcp = spawn(process.execPath, [MCP_PATH], { stdio: ['pipe', 'pipe', 'pipe'], env });
  let stdout = '';
  mcp.stdout.setEncoding('utf8');
  mcp.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  try {
    const deadline = Date.now() + 3000;
    for (;;) {
      try {
        const health = await fetch(`http://127.0.0.1:${port}/health`);
        if (health.ok) break;
      } catch {
        // server henüz dinlemiyor
      }
      if (Date.now() >= deadline) throw new Error('test bridge başlamadı');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const call = {
      jsonrpc: '2.0',
      id: 42,
      method: 'tools/call',
      params: {
        name: 'ask',
        arguments: {
          questions: [{ question: 'İptal?', header: 'H', options: [{ label: 'Evet' }] }],
        },
      },
    };
    const cancel = {
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: { requestId: 42, reason: 'test' },
    };
    mcp.stdin.write(`${JSON.stringify(call)}\n${JSON.stringify(cancel)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    const current = await (await fetch(`http://127.0.0.1:${port}/current`)).json();
    assert.strictEqual(current.id, null, 'cancelled tools/call pending tur bırakmamalı');
    assert.ok(
      !stdout.includes('"id":42'),
      'cancelled request için kullanılmayacak sonuç dönmemeli'
    );
  } finally {
    const exits = [mcp, server].map((child) =>
      child.exitCode === null
        ? new Promise((resolve) => child.once('exit', resolve))
        : Promise.resolve()
    );
    mcp.kill();
    server.kill();
    await Promise.all(exits);
    fs.rmSync(xdg, { recursive: true, force: true });
  }
});

// Regression: id:null bir istek olarak işlenmeli (JSON-RPC 2.0); bildirim sayılıp yutulMAmalı.
test('mcp-server: id:null ping yanıtlanır (bildirim değil)', async () => {
  const child = spawn(process.execPath, [MCP_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
  let outBuf = '';
  const lines = [];
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('zaman aşımı')), 5000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        outBuf += chunk;
        const parts = outBuf.split('\n');
        outBuf = parts.pop();
        for (const line of parts) {
          if (line.trim()) {
            lines.push(line.trim());
            clearTimeout(timeout);
            resolve();
          }
        }
      });
      child.on('error', (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: null, method: 'ping' }) + '\n');
    });
  } finally {
    child.kill();
  }
  const res = lines.map((l) => JSON.parse(l)).find((r) => r.id === null);
  assert.ok(res, 'id:null isteğe yanıt gelmeli');
  assert.deepStrictEqual(res.result, {}, 'ping result boş nesne olmalı');
});
