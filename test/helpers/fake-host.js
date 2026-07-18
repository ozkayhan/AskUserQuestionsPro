'use strict';

const { spawn } = require('node:child_process');

function runProcess(entryPoint, input, env = {}, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entryPoint], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('fake host process timed out'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        stdout: redact(stdout),
        stderr: redact(stderr),
      });
    });
    child.stdin.end(input);
  });
}

function redact(value) {
  const allowed = new Set([
    'event',
    'adapter',
    'requestId',
    'roundId',
    'elapsedMs',
    'boundary',
    'deadlineOwner',
    'reason',
    'state',
    'status',
    'code',
    'signal',
    'permissionDecision',
    'permissionDecisionReason',
    'hookEventName',
    'suppressOutput',
  ]);
  const sanitize = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.has(key)));
  };
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const prefix = line.startsWith('[askuser:lifecycle] ') ? '[askuser:lifecycle] ' : '';
      const json = prefix ? line.slice(prefix.length) : line;
      try {
        const parsed = JSON.parse(json);
        const safe = sanitize(parsed);
        return safe && Object.keys(safe).length
          ? `${prefix}${JSON.stringify(safe)}`
          : '[redacted-output]';
      } catch {
        return '[redacted-output]';
      }
    })
    .join('\n');
}

module.exports = { runProcess, redact };
