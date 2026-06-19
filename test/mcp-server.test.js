'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const MCP_PATH = path.join(__dirname, '..', 'mcp-server', 'askuserquestionspro-mcp.mjs');

// MCP sunucusu spawn edilir; initialize + tools/list gönderilir, yanıtlar doğrulanır.
test('mcp-server: initialize ve tools/list', async (t) => {
  const child = spawn(process.execPath, [MCP_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const lines = [];
  let outBuf = '';

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('MCP sunucusu zaman aşımına uğradı')), 5000);

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

    child.on('error', (e) => { clearTimeout(timeout); reject(e); });

    // initialize isteği
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} },
    }) + '\n');

    // tools/list isteği
    child.stdin.write(JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/list',
    }) + '\n');
  });

  child.kill();

  // İki yanıtı id'ye göre bul.
  const responses = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const initRes = responses.find((r) => r.id === 1);
  const listRes = responses.find((r) => r.id === 2);

  // (a) initialize doğrulama
  assert.ok(initRes, 'initialize yanıtı alınmalı');
  assert.strictEqual(initRes.result.serverInfo.name, 'askuserquestionspro', 'serverInfo.name "askuserquestionspro" olmalı');
  assert.ok(
    typeof initRes.result.protocolVersion === 'string' && initRes.result.protocolVersion.length > 0,
    'protocolVersion boş olmayan string olmalı',
  );

  // (b) tools/list doğrulama
  assert.ok(listRes, 'tools/list yanıtı alınmalı');
  const tools = listRes.result.tools;
  assert.ok(Array.isArray(tools) && tools.length > 0, 'tools dizisi boş olmamalı');
  const askTool = tools.find((t) => t.name === 'ask');
  assert.ok(askTool, '"ask" adında araç olmalı');
  const qSchema = askTool.inputSchema.properties.questions;
  assert.ok(qSchema, 'questions özelliği olmalı');
  assert.strictEqual(qSchema.maxItems, undefined, 'questions.maxItems OLMAMALI (sınırsız)');
  const itemRequired = qSchema.items.required;
  assert.ok(Array.isArray(itemRequired) && itemRequired.includes('question'), 'items.required "question" içermeli');
  assert.ok(Array.isArray(itemRequired) && itemRequired.includes('options'), 'items.required "options" içermeli');
});
