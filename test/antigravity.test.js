'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'bin', 'cli.js');
const MCP = path.join(__dirname, '..', 'mcp-server', 'askuserquestionspro-mcp.mjs');
const {
  deploySkill,
  hasMcp,
  hasPlugin,
  installMcp,
  pathsFor,
  removeMcp,
  removePlugin,
} = require('../lib/antigravity.cjs');

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-antigravity-'));
}

test('Antigravity MCP registration merges safely and replaces stale AskPro paths', () => {
  const home = tempHome();
  try {
    const paths = pathsFor(home);
    fs.mkdirSync(path.dirname(paths.mcpConfig), { recursive: true });
    fs.writeFileSync(
      paths.mcpConfig,
      JSON.stringify({
        mcpServers: {
          unrelated: { command: 'node', args: ['other.mjs'] },
          askuserquestionspro: { command: 'node', args: ['/old/path.mjs'] },
        },
      })
    );
    installMcp({ home, mcpPath: MCP, nodePath: process.execPath });
    const config = JSON.parse(fs.readFileSync(paths.mcpConfig, 'utf8'));
    assert.deepEqual(config.mcpServers.unrelated, { command: 'node', args: ['other.mjs'] });
    assert.deepEqual(config.mcpServers.askuserquestionspro, {
      command: process.execPath,
      args: [MCP],
    });
    assert.equal(hasMcp(paths.mcpConfig, MCP, process.execPath), true);
    assert.deepEqual(removeMcp({ home }).removed, true);
    const after = JSON.parse(fs.readFileSync(paths.mcpConfig, 'utf8'));
    assert.deepEqual(after, {
      mcpServers: { unrelated: { command: 'node', args: ['other.mjs'] } },
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('Antigravity treats a zero-byte interrupted config as recoverable', () => {
  const home = tempHome();
  try {
    const paths = pathsFor(home);
    fs.mkdirSync(path.dirname(paths.mcpConfig), { recursive: true });
    fs.writeFileSync(paths.mcpConfig, '');
    installMcp({ home, mcpPath: MCP, nodePath: process.execPath });
    assert.equal(hasMcp(paths.mcpConfig, MCP, process.execPath), true);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('Antigravity plugin deploy is atomic and removes only the AskPro plugin', () => {
  const home = tempHome();
  try {
    const paths = deploySkill({
      home,
      source: path.join(__dirname, '..', 'skill', 'askpro'),
    });
    assert.equal(hasPlugin(home), true);
    assert.equal(fs.existsSync(paths.pluginManifest), true);
    assert.equal(fs.existsSync(paths.pluginSkill), true);
    removePlugin(home);
    assert.equal(fs.existsSync(paths.pluginDir), false);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('CLI target antigravity installs, diagnoses, and removes the complete integration', () => {
  const home = tempHome();
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-agy-bin-'));
  const agy = path.join(binDir, 'agy');
  fs.writeFileSync(
    agy,
    '#!/bin/sh\nif [ "$1 $2" = "plugin list" ]; then\n' +
      '  printf \'{"imports":[{"name":"askuserquestionspro"}]}\\n\'\n' +
      'fi\nexit 0\n',
    { mode: 0o755 }
  );
  try {
    const env = {
      ...process.env,
      HOME: home,
      PATH: '/usr/bin:/bin',
      ASKUI_ANTIGRAVITY_BIN: agy,
    };
    const install = spawnSync(process.execPath, [CLI, 'install', '--target', 'antigravity'], {
      env,
      encoding: 'utf8',
    });
    assert.equal(install.status, 0, install.stdout + install.stderr);
    assert.equal(hasPlugin(home), true);
    assert.equal(
      hasMcp(pathsFor(home).mcpConfig, MCP, process.execPath),
      true,
      install.stdout + install.stderr
    );
    const doctor = spawnSync(process.execPath, [CLI, 'doctor', '--target', 'antigravity'], {
      env,
      encoding: 'utf8',
    });
    assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
    const uninstall = spawnSync(process.execPath, [CLI, 'uninstall', '--target', 'antigravity'], {
      env,
      encoding: 'utf8',
    });
    assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
    assert.equal(hasPlugin(home), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(pathsFor(home).mcpConfig, 'utf8')), {});
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(binDir, { recursive: true, force: true });
  }
});
