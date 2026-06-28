const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { buildHookOutput } = require('../hooks/hook-output.js');

const HOOK_PATH = path.join(__dirname, '..', 'hooks', 'askuserquestionspro-bridge.mjs');

// Hook'u stdin payload'u ile çalıştır, stdout/exit kodunu topla.
function runHook(stdin, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HOOK_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('close', (code) => resolve({ code, out, err }));
    child.stdin.end(stdin);
  });
}

test('allow kararı + updatedInput içinde answers üretir', () => {
  const toolInput = { questions: [{ question: 'Q?', options: [] }] };
  const out = buildHookOutput(toolInput, { 'Q?': 'A' });
  const hso = out.hookSpecificOutput;
  assert.strictEqual(hso.hookEventName, 'PreToolUse');
  assert.strictEqual(hso.permissionDecision, 'allow');
  assert.deepStrictEqual(hso.updatedInput.answers, { 'Q?': 'A' });
  assert.deepStrictEqual(hso.updatedInput.questions, toolInput.questions);
  assert.strictEqual(out.suppressOutput, true, 'JSON payload transcripte yansimasin');
  assert.strictEqual(hso.hookEventName, 'PreToolUse');
});

test('answers filtresi: questions ile eşleşmeyen ekstra anahtarları atar', () => {
  // toolInput'ta yalnızca A? var; B? cevabı strip edilmeli (filter dalı).
  const toolInput = { questions: [{ question: 'A?' }] };
  const out = buildHookOutput(toolInput, { 'A?': 'yes', 'B?': 'no' });
  assert.deepStrictEqual(
    out.hookSpecificOutput.updatedInput.answers,
    { 'A?': 'yes' },
    "eşleşmeyen 'B?' answers'ta olmamalı"
  );
});

test('answers filtresi: questions boş/eksikse tüm anahtarlar düşer', () => {
  // toolInput.questions undefined → (toolInput.questions || []) boş → hiçbir anahtar geçmez.
  const out = buildHookOutput({}, { 'A?': 'yes' });
  assert.deepStrictEqual(out.hookSpecificOutput.updatedInput.answers, {});
});

test('bridge hook: ASKUI_FORCE_MCP deny payload üretir (sunucuya gitmeden)', async () => {
  const stdin = JSON.stringify({ tool_input: { questions: [{ question: 'Q?' }] } });
  const { code, out } = await runHook(stdin, { ASKUI_FORCE_MCP: '1' });
  assert.strictEqual(code, 0, 'hook exit(0) olmalı');
  const payload = JSON.parse(out);
  assert.strictEqual(payload.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(
    payload.hookSpecificOutput.permissionDecisionReason,
    /mcp__askuserquestionspro__ask/
  );
});

test('bridge hook: bozuk JSON stdin → exit(0), stdout boş (native fallback)', async () => {
  const { code, out } = await runHook('not json at all', {});
  assert.strictEqual(code, 0, 'bozuk girdi sessizce exit(0)');
  assert.strictEqual(out.trim(), '', 'native picker için stdout boş kalmalı');
});

test('bridge hook: questions yoksa exit(0), stdout boş', async () => {
  const { code, out } = await runHook(JSON.stringify({ tool_input: {} }), {});
  assert.strictEqual(code, 0);
  assert.strictEqual(out.trim(), '');
});
