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
  return value
    .replace(/synthetic-question[^\s"']*/gi, '[redacted-question]')
    .replace(/synthetic-answer[^\s"']*/gi, '[redacted-answer]');
}

module.exports = { runProcess, redact };
