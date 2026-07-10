'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { validQuestions } = require('../lib/question-contract.cjs');

const skillPath = path.join(__dirname, '..', 'skill', 'askpro', 'SKILL.md');
const evalPath = path.join(__dirname, '..', 'evals', 'askpro-skill-cases.json');
const skill = fs.readFileSync(skillPath, 'utf8');
const cases = JSON.parse(fs.readFileSync(evalPath, 'utf8'));

test('askpro skill explicitly teaches the fragile options invariant', () => {
  assert.match(skill, /Critical payload invariant/);
  assert.match(skill, /must be an object with a non-empty string `label`/);
  assert.match(skill, /Never send this shape/);
  assert.match(skill, /Invalid question input/);
  assert.match(skill, /do not inspect the bridge/);
});

for (const scenario of cases) {
  test(`skill eval: ${scenario.id}`, () => {
    const result = validQuestions(scenario.payload.questions);
    assert.strictEqual(result.ok, scenario.expected === 'valid', result.error || scenario.id);
    if (scenario.errorPattern)
      assert.match(result.error || '', new RegExp(scenario.errorPattern, 'i'));
  });
}
