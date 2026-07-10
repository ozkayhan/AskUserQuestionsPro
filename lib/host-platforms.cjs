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

module.exports = {
  HOSTS,
  VALID_TARGETS,
  candidatesFor,
  manualMcpCommand,
  mcpArgs,
  parseTarget,
  resolveExecutable,
  selectedHosts,
  skillDestination,
};
