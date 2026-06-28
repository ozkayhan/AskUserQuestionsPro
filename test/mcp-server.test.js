'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const MCP_PATH = path.join(__dirname, '..', 'mcp-server', 'askuserquestionspro-mcp.mjs');

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
            // İki yanıt geldi mi?
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

  // (b) tools/list doğrulama
  assert.ok(listRes, 'tools/list yanıtı alınmalı');
  const tools = listRes.result.tools;
  assert.ok(Array.isArray(tools) && tools.length > 0, 'tools dizisi boş olmamalı');
  const askTool = tools.find((t) => t.name === 'ask');
  assert.ok(askTool, '"ask" adında araç olmalı');
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

  // (e) options $ref ile referans veriyor
  assert.ok(
    itemProps.options && itemProps.options.items && itemProps.options.items.$ref,
    'options.items.$ref olmalı'
  );

  // (f) scale alanları
  assert.ok(itemProps.min, 'min alanı olmalı');
  assert.ok(itemProps.max, 'max alanı olmalı');
  assert.ok(itemProps.step, 'step alanı olmalı');
  assert.ok(itemProps.leftLabel, 'leftLabel alanı olmalı');
  assert.ok(itemProps.rightLabel, 'rightLabel alanı olmalı');
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
