'use strict';

const path = require('node:path');

const HOSTS = Object.freeze({
  claude: Object.freeze({
    label: 'Claude Code',
    binEnv: 'ASKUI_CLAUDE_BIN',
    defaultBins: ['claude'],
  }),
  codex: Object.freeze({
    label: 'Codex App/CLI',
    binEnv: 'ASKUI_CODEX_BIN',
    defaultBins: [
      'codex',
      '/Applications/ChatGPT.app/Contents/Resources/codex',
      '/Applications/Codex.app/Contents/Resources/codex',
    ],
  }),
});

const VALID_TARGETS = Object.freeze(['auto', 'all', 'claude', 'codex']);
const DEFAULT_CODEX_TOOL_TIMEOUT_SEC = 3600;

function parseTarget(argv, fallback = 'auto') {
  let value = fallback;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      value = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--target=')) {
      value = arg.slice('--target='.length);
    } else {
      throw new Error(`Bilinmeyen seçenek: ${arg}`);
    }
  }
  if (!VALID_TARGETS.includes(value)) {
    throw new Error(`Geçersiz target "${value}". Beklenen: ${VALID_TARGETS.join('|')}`);
  }
  return value;
}

function candidatesFor(host, env = process.env) {
  const def = HOSTS[host];
  if (!def) throw new Error(`Unknown host: ${host}`);
  const override = env[def.binEnv];
  if (override) return [override];
  const candidates = [...def.defaultBins];
  if (host === 'codex' && env.HOME) {
    candidates.push(
      path.join(env.HOME, 'Applications', 'ChatGPT.app', 'Contents', 'Resources', 'codex'),
      path.join(env.HOME, 'Applications', 'Codex.app', 'Contents', 'Resources', 'codex')
    );
  }
  return candidates;
}

function resolveExecutable(host, spawnSync, env = process.env) {
  for (const candidate of candidatesFor(host, env)) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore', env });
    if (!result.error) return candidate;
  }
  return null;
}

function selectedHosts(target, availability) {
  if (target === 'all') return ['claude', 'codex'];
  if (target === 'claude' || target === 'codex') return [target];
  return ['claude', 'codex'].filter((host) => Boolean(availability[host]));
}

function skillDestination(host, home) {
  if (host === 'claude') return path.join(home, '.claude', 'skills', 'askpro');
  if (host === 'codex') return path.join(home, '.agents', 'skills', 'askpro');
  throw new Error(`Unknown host: ${host}`);
}

function mcpArgs(host, action, mcpPath, nodePath = process.execPath) {
  if (host === 'claude') {
    if (action === 'add') {
      return ['mcp', 'add', '--scope', 'user', 'askuserquestionspro', '--', nodePath, mcpPath];
    }
    if (action === 'remove') return ['mcp', 'remove', '--scope', 'user', 'askuserquestionspro'];
    if (action === 'check') return ['mcp', 'list'];
    if (action === 'inspect') return ['mcp', 'get', 'askuserquestionspro'];
  }
  if (host === 'codex') {
    if (action === 'add') return ['mcp', 'add', 'askuserquestionspro', '--', nodePath, mcpPath];
    if (action === 'remove') return ['mcp', 'remove', 'askuserquestionspro'];
    if (action === 'check') return ['mcp', 'get', 'askuserquestionspro', '--json'];
  }
  throw new Error(`Unsupported MCP action: ${host}/${action}`);
}

function manualMcpCommand(host, mcpPath, nodePath = process.execPath) {
  const bin = host === 'claude' ? 'claude' : 'codex';
  return `${bin} ${mcpArgs(host, 'add', mcpPath, nodePath)
    .map((arg) => (arg.includes(' ') ? JSON.stringify(arg) : arg))
    .join(' ')}`;
}

function mcpSectionBounds(config, name) {
  const header = `[mcp_servers.${name}]`;
  const start = config.indexOf(header);
  if (start < 0) return null;
  const next = config.indexOf('\n[', start + header.length);
  return { start, end: next < 0 ? config.length : next + 1, header };
}

function mcpToolTimeoutSec(config, name = 'askuserquestionspro') {
  const section = mcpSectionBounds(config, name);
  if (!section) return null;
  const body = config.slice(section.start + section.header.length, section.end);
  const match = body.match(/^tool_timeout_sec\s*=\s*([^\s#]+)/m);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function setMcpToolTimeoutSec(
  config,
  seconds = DEFAULT_CODEX_TOOL_TIMEOUT_SEC,
  name = 'askuserquestionspro'
) {
  const section = mcpSectionBounds(config, name);
  if (!section) throw new Error(`[mcp_servers.${name}] section not found`);
  const bodyStart = section.start + section.header.length;
  const body = config.slice(bodyStart, section.end);
  const line = `tool_timeout_sec = ${Math.max(1, Math.floor(seconds))}`;
  const nextBody = /^tool_timeout_sec\s*=.*$/m.test(body)
    ? body.replace(/^tool_timeout_sec\s*=.*$/m, line)
    : `${body.replace(/\n+$/, '')}\n${line}\n`;
  return config.slice(0, bodyStart) + nextBody + config.slice(section.end);
}

module.exports = {
  DEFAULT_CODEX_TOOL_TIMEOUT_SEC,
  HOSTS,
  VALID_TARGETS,
  candidatesFor,
  manualMcpCommand,
  mcpArgs,
  parseTarget,
  resolveExecutable,
  selectedHosts,
  mcpToolTimeoutSec,
  setMcpToolTimeoutSec,
  skillDestination,
};
