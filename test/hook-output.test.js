const test = require('node:test');
const assert = require('node:assert');
const { buildHookOutput } = require('../hooks/hook-output.js');

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
