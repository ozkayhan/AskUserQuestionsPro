'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');

function isolated() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-cli-'));
  const codex = path.join(home, 'codex');
  fs.mkdirSync(codex);
  return { home, codex, env: { ...process.env, HOME: home, CODEX_HOME: codex, PATH: '/usr/bin:/bin' } };
}

function run(args, env) {
  return spawnSync(process.execPath, [CLI, ...args], { env, encoding: 'utf8' });
}

test('Claude-only lifecycle mutates Claude scope and preserves Codex config', () => {
  const ctx = isolated();
  try {
    fs.writeFileSync(path.join(ctx.codex, 'config.toml'), '# unrelated\n');
    const install = run(['install', '--target', 'claude'], ctx.env);
    assert.equal(install.status, 1, 'missing Claude binary must not report live registration');
    assert.ok(fs.existsSync(path.join(ctx.home, '.claude', 'settings.json')));
    assert.ok(fs.existsSync(path.join(ctx.home, '.claude', 'skills', 'askpro', 'SKILL.md')));
    assert.equal(fs.readFileSync(path.join(ctx.codex, 'config.toml'), 'utf8'), '# unrelated\n');
    const repeat = run(['install', '--target', 'claude'], ctx.env);
    assert.equal(repeat.status, 1, 'repeat still reports unavailable host');
    const remove = run(['uninstall', '--target', 'claude'], ctx.env);
    assert.equal(remove.status, 0, remove.stderr);
    assert.equal(fs.readFileSync(path.join(ctx.codex, 'config.toml'), 'utf8'), '# unrelated\n');
  } finally {
    fs.rmSync(ctx.home, { recursive: true, force: true });
  }
});

test('Codex-only lifecycle does not create Claude hook and reports unavailable binary honestly', () => {
  const ctx = isolated();
  try {
    const install = run(['install', '--target', 'codex'], {
      ...ctx.env,
      ASKUI_CODEX_BIN: path.join(ctx.home, 'missing-codex'),
    });
    assert.equal(install.status, 1, 'missing Codex binary must not report live registration');
    assert.equal(fs.existsSync(path.join(ctx.home, '.claude', 'settings.json')), false);
    assert.ok(fs.existsSync(path.join(ctx.home, '.agents', 'skills', 'askpro', 'SKILL.md')));
    assert.match(`${install.stdout}${install.stderr}`, /komutu bulunamadı|elle kaydedin|MCP/);
    const remove = run(['uninstall', '--target', 'codex'], ctx.env);
    assert.equal(remove.status, 0, remove.stderr);
    assert.equal(fs.existsSync(path.join(ctx.home, '.claude')), false);
  } finally {
    fs.rmSync(ctx.home, { recursive: true, force: true });
  }
});
