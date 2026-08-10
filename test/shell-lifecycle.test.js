'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const net = require('node:net');

const UNINSTALL = path.join(__dirname, '..', 'uninstall.sh');
const INSTALL = path.join(__dirname, '..', 'install.sh');

test(
  'uninstall --target codex preserves shared runtime while Claude remains installed',
  { skip: process.platform === 'win32' },
  async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-shell-home-'));
    const runtime = path.join(home, '.local', 'share', 'askuserquestionspro');
    const claudeSkill = path.join(home, '.claude', 'skills', 'askpro');
    const codexSkill = path.join(home, '.agents', 'skills', 'askpro');
    const fakeCodex = path.join(home, 'fake-codex');
    const listener = net.createServer();
    try {
      await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
      fs.mkdirSync(runtime, { recursive: true });
      fs.writeFileSync(path.join(runtime, 'keep.txt'), 'shared runtime');
      fs.mkdirSync(claudeSkill, { recursive: true });
      fs.writeFileSync(path.join(claudeSkill, 'SKILL.md'), 'claude');
      fs.mkdirSync(codexSkill, { recursive: true });
      fs.writeFileSync(path.join(codexSkill, 'SKILL.md'), 'codex');
      fs.writeFileSync(fakeCodex, '#!/bin/sh\nexit 0\n', { mode: 0o755 });

      const result = spawnSync('bash', [UNINSTALL, '--target', 'codex'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          XDG_CONFIG_HOME: path.join(home, '.config'),
          ASKUI_CODEX_BIN: fakeCodex,
          ASKUSER_PORT: String(listener.address().port),
        },
      });
      assert.strictEqual(result.status, 0, result.stdout + result.stderr);
      assert.ok(fs.existsSync(path.join(runtime, 'keep.txt')), 'shared runtime korunmalı');
      assert.ok(fs.existsSync(path.join(claudeSkill, 'SKILL.md')), 'Claude skill korunmalı');
      assert.ok(!fs.existsSync(codexSkill), 'Codex skill kaldırılmalı');
      assert.ok(listener.listening, 'diğer hostun kullanabileceği bridge süreci öldürülmemeli');
    } finally {
      await new Promise((resolve) => listener.close(resolve));
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
);

test(
  'install/uninstall --target antigravity completes the shell lifecycle in an isolated home',
  { skip: process.platform === 'win32' },
  () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-antigravity-shell-home-'));
    const fakeAgy = path.join(home, 'fake-agy');
    try {
      fs.writeFileSync(
        fakeAgy,
        '#!/bin/sh\nif [ "$1 $2" = "plugin list" ]; then\n' +
          '  printf \'{"imports":[{"name":"askuserquestionspro"}]}\\n\'\n' +
          'fi\nexit 0\n',
        { mode: 0o755 }
      );
      const env = {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: path.join(home, '.config'),
        ASKUI_ANTIGRAVITY_BIN: fakeAgy,
        ASKUSER_SOURCE_DIR: path.join(__dirname, '..'),
        ASKUSER_PORT: '0',
      };
      const install = spawnSync('bash', [INSTALL, '--target', 'antigravity'], {
        encoding: 'utf8',
        env,
      });
      assert.equal(install.status, 0, install.stdout + install.stderr);
      const plugin = path.join(
        home,
        '.gemini',
        'antigravity-cli',
        'plugins',
        'askuserquestionspro'
      );
      const mcpConfig = path.join(home, '.gemini', 'config', 'mcp_config.json');
      assert.ok(fs.existsSync(path.join(plugin, 'plugin.json')));
      assert.ok(fs.existsSync(path.join(plugin, 'skills', 'askpro', 'SKILL.md')));
      assert.match(fs.readFileSync(mcpConfig, 'utf8'), /askuserquestionspro/);

      const uninstall = spawnSync('bash', [UNINSTALL, '--target', 'antigravity'], {
        encoding: 'utf8',
        env,
      });
      assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
      assert.equal(fs.existsSync(plugin), false);
      assert.equal(fs.existsSync(path.join(home, '.local', 'share', 'askuserquestionspro')), false);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  }
);
