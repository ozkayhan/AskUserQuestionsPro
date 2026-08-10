'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeFileAtomic } = require('./atomic-write.cjs');

const SERVER_NAME = 'askuserquestionspro';
const PLUGIN_NAME = 'askuserquestionspro';

function pathsFor(home = os.homedir()) {
  const configDir = path.join(home, '.gemini', 'config');
  const pluginDir = path.join(home, '.gemini', 'antigravity-cli', 'plugins', PLUGIN_NAME);
  return Object.freeze({
    configDir,
    mcpConfig: path.join(configDir, 'mcp_config.json'),
    pluginDir,
    pluginManifest: path.join(pluginDir, 'plugin.json'),
    pluginSkill: path.join(pluginDir, 'skills', 'askpro', 'SKILL.md'),
  });
}

function readConfig(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (raw.trim() === '') return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('JSON kökü bir nesne olmalı');
    }
    if (
      parsed.mcpServers !== undefined &&
      (!parsed.mcpServers ||
        typeof parsed.mcpServers !== 'object' ||
        Array.isArray(parsed.mcpServers))
    ) {
      throw new Error('mcpServers bir nesne olmalı');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`Antigravity MCP ayarı okunamadı (${file}): ${error.message}`);
  }
}

function writeConfig(file, config) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileAtomic(file, JSON.stringify(config, null, 2) + '\n');
}

function mcpEntry(mcpPath, nodePath = process.execPath) {
  return { command: nodePath, args: [mcpPath] };
}

function installMcp({ home = os.homedir(), mcpPath, nodePath = process.execPath } = {}) {
  if (!mcpPath) throw new Error('Antigravity MCP path eksik');
  const paths = pathsFor(home);
  const config = readConfig(paths.mcpConfig);
  config.mcpServers = { ...(config.mcpServers || {}), [SERVER_NAME]: mcpEntry(mcpPath, nodePath) };
  writeConfig(paths.mcpConfig, config);
  return paths;
}

function hasMcp(file, mcpPath, nodePath = process.execPath) {
  try {
    const entry = readConfig(file).mcpServers?.[SERVER_NAME];
    return (
      entry &&
      entry.command === nodePath &&
      Array.isArray(entry.args) &&
      entry.args.length === 1 &&
      path.resolve(entry.args[0]) === path.resolve(mcpPath)
    );
  } catch {
    return false;
  }
}

function removeMcp({ home = os.homedir() } = {}) {
  const paths = pathsFor(home);
  if (!fs.existsSync(paths.mcpConfig)) return { removed: false, paths };
  const config = readConfig(paths.mcpConfig);
  if (!config.mcpServers || !Object.prototype.hasOwnProperty.call(config.mcpServers, SERVER_NAME)) {
    return { removed: false, paths };
  }
  const remaining = { ...config.mcpServers };
  delete remaining[SERVER_NAME];
  if (Object.keys(remaining).length === 0) delete config.mcpServers;
  else config.mcpServers = remaining;
  writeConfig(paths.mcpConfig, config);
  return { removed: true, paths };
}

function deploySkill({ home = os.homedir(), source } = {}) {
  if (!source || !fs.existsSync(path.join(source, 'SKILL.md'))) {
    throw new Error(`Antigravity skill kaynağı bulunamadı: ${source}`);
  }
  const paths = pathsFor(home);
  fs.mkdirSync(path.dirname(paths.pluginDir), { recursive: true, mode: 0o700 });
  const temp = `${paths.pluginDir}.tmp.${process.pid}`;
  const backup = `${paths.pluginDir}.bak.${process.pid}`;
  fs.rmSync(temp, { recursive: true, force: true });
  fs.rmSync(backup, { recursive: true, force: true });
  fs.mkdirSync(temp, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(temp, 'plugin.json'),
    JSON.stringify(
      {
        $schema: 'https://antigravity.google/schemas/v1/plugin.json',
        name: PLUGIN_NAME,
        description: 'AskUserQuestionsPro structured local question UI for Antigravity CLI',
      },
      null,
      2
    ) + '\n',
    { mode: 0o600 }
  );
  fs.mkdirSync(path.join(temp, 'skills'), { recursive: true, mode: 0o700 });
  fs.cpSync(source, path.join(temp, 'skills', 'askpro'), { recursive: true });
  let movedOld = false;
  try {
    if (fs.existsSync(paths.pluginDir)) {
      fs.renameSync(paths.pluginDir, backup);
      movedOld = true;
    }
    fs.renameSync(temp, paths.pluginDir);
    fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    if (movedOld && !fs.existsSync(paths.pluginDir)) fs.renameSync(backup, paths.pluginDir);
    throw error;
  }
  return paths;
}

function hasPlugin(home = os.homedir()) {
  const paths = pathsFor(home);
  return fs.existsSync(paths.pluginManifest) && fs.existsSync(paths.pluginSkill);
}

function removePlugin(home = os.homedir()) {
  const paths = pathsFor(home);
  fs.rmSync(paths.pluginDir, { recursive: true, force: true });
  return paths;
}

module.exports = {
  PLUGIN_NAME,
  SERVER_NAME,
  deploySkill,
  hasMcp,
  hasPlugin,
  installMcp,
  mcpEntry,
  pathsFor,
  readConfig,
  removeMcp,
  removePlugin,
};
