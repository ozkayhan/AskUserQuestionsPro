'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const evidence = fs.readFileSync('test/tier1-acceptance-evidence.md', 'utf8');
const scenarios = ['idle', 'reconnect', 'restart', 'cancel', 'recovery', 'result', 'ack'];

function rows() {
  return evidence
    .split('\n')
    .filter(
      (line) => line.startsWith('| ') && !line.startsWith('| Host ') && !line.startsWith('|---')
    )
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
    )
    .map(([host, version, transport, scenario, command, result, limitation]) => ({
      host,
      version,
      transport,
      scenario,
      command,
      result,
      limitation,
    }));
}

test('Tier 1 matrix enumerates every scenario for both adapters', () => {
  const table = rows();
  for (const host of ['Claude Code', 'Codex']) {
    for (const scenario of scenarios) {
      const matches = table.filter((row) => row.host === host && row.scenario === scenario);
      assert.equal(matches.length, 1, `${host}/${scenario} local row missing or duplicated`);
      assert.match(matches[0].command, /node --test/);
      assert.equal(matches[0].result, 'Automated pass');
    }
    const live = table.find((row) => row.host === host && row.version === 'unavailable');
    assert.ok(live, `${host} live row missing`);
    assert.equal(live.result, 'Unavailable');
  }
});

test('local evidence links to executable tests and remains redacted', () => {
  assert.match(evidence, /node --test test\/fake-host-conformance\.test\.js/);
  assert.match(evidence, /node --test test\/mcp-long-round\.test\.js/);
  assert.doesNotMatch(evidence, /synthetic-question|synthetic-answer|password|token=/i);
});

test('authenticated live prerequisites are explicitly unavailable, never passed', () => {
  assert.match(evidence, /Authenticated live host unavailable/);
  assert.match(evidence, /\|\s+Unavailable\s+\|/);
  assert.match(evidence, /not passes/);
  assert.doesNotMatch(evidence, /live.*\| (Automated )?pass \|/i);
});

test('every unique local evidence command actually executes successfully', () => {
  const commands = new Set(
    rows()
      .filter((row) => row.result === 'Automated pass')
      .map((row) => row.command.replaceAll('`', ''))
  );
  for (const command of commands) {
    const parts = command.trim().split(/\s+/);
    assert.equal(parts.shift(), 'node');
    assert.equal(parts.shift(), '--test');
    const result = spawnSync(process.execPath, ['--test', ...parts], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.equal(result.status, 0, `${command}\n${result.stdout}\n${result.stderr}`);
  }
});
