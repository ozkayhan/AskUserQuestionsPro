'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

// Required evidence uses the installed CLI, not a Playwright Node dependency.
const root = path.join(__dirname, 'artifacts', 'settings-v2-cli');
const shotDir = path.join(root, 'screenshots');
fs.mkdirSync(shotDir, { recursive: true });
const logPath = path.join(root, 'commands.log');
const port = 4700 + (process.pid % 200);
const config = fs.mkdtempSync(path.join(os.tmpdir(), 'aukp-browser-cli-'));
const session = `settings-${process.pid}`;
const commands = [];
function cli(...args) {
  const command = ['playwright-cli', `-s=${session}`, ...args].join(' ');
  commands.push(command);
  const result = spawnSync('playwright-cli', [`-s=${session}`, ...args], { encoding: 'utf8' });
  if (result.error?.code === 'ENOENT')
    throw new Error('playwright-cli is required; install it and ensure it is on PATH');
  if (result.status !== 0) throw new Error(`${command}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function evaluate(expression) {
  const output = cli('--raw', 'eval', expression).trim();
  assert.notEqual(output, '', `empty result for ${expression}`);
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}
async function main() {
  const server = spawn(process.execPath, ['server/server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, ASKUSER_PORT: String(port), XDG_CONFIG_HOME: config },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  server.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  try {
    for (let i = 0; i < 40; i += 1) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
      } catch (error) {
        /* server is still starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (i === 39) throw new Error(`server did not start: ${stderr}`);
    }
    cli('open', `http://127.0.0.1:${port}/`);
    cli('click', "button[aria-label='Settings']");
    assert.match(cli('snapshot'), /dialog/);
    assert.match(cli('snapshot'), /Data & recovery/);
    assert.deepEqual(
      evaluate(
        "fetch('/settings/doctor').then(async r => ({ ok: r.ok, hasEffective: !!(await r.json()).effective }))"
      ),
      { ok: true, hasEffective: true }
    );
    assert.equal(evaluate("document.activeElement.getAttribute('aria-label')"), 'Close settings');
    cli('press', 'Tab');
    assert.equal(
      evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"),
      true
    );
    cli('press', 'Escape');
    assert.equal(evaluate("document.activeElement.getAttribute('aria-label')"), 'Settings');
    cli('click', "button[aria-label='Settings']");
    cli('click', "button[role='switch'][aria-label='High contrast']");
    cli('click', "button[role='switch'][aria-label='Reduce motion']");
    cli('click', "button:has-text('Save settings')");
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(
      evaluate("document.querySelector('[role=dialog] button.btn--primary').textContent.trim()"),
      'Save settings'
    );
    assert.match(cli('snapshot'), /Settings saved\./);
    cli('reload');
    cli('click', "button[aria-label='Settings']");
    assert.equal(
      evaluate(
        "document.querySelector('[aria-label=\"High contrast\"]').getAttribute('aria-checked')"
      ),
      'true'
    );
    assert.equal(
      evaluate(
        "document.querySelector('[aria-label=\"Reduce motion\"]').getAttribute('aria-checked')"
      ),
      'true'
    );
    assert.equal(
      evaluate(
        "(() => { const i=document.querySelector('input[type=file]'); const d=new DataTransfer(); d.items.add(new File([JSON.stringify(window.__ASKUSER_SETTINGS_V2__)], 'backup.json', {type:'application/json'})); Object.defineProperty(i, 'files', {value:d.files, configurable:true}); i.dispatchEvent(new Event('change', {bubbles:true})); return true; })()"
      ),
      true
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.match(cli('snapshot'), /Import preview/);
    cli('click', "button:has-text('Apply import')");
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.match(cli('snapshot'), /backup\.json/);
    assert.equal(
      evaluate(
        "(() => { const s=getComputedStyle(document.querySelector('[role=dialog]')); return s.animationDuration === '0s' || s.transitionDuration === '0s'; })()"
      ),
      true
    );
    assert.equal(
      evaluate(
        '(() => { const before=JSON.stringify(Settings_Schema.defaults()); const r=Settings_Schema.inspectEnvelope({_v:999}); return !r.valid && JSON.stringify(Settings_Schema.defaults())===before; })()'
      ),
      true
    );
    cli('screenshot', path.join(shotDir, 'settings-cli.png'));
    cli('resize', '320', '480');
    assert.equal(
      evaluate(
        "(() => { const d=document.querySelector('.settings__body'); return d.scrollHeight > d.clientHeight; })()"
      ),
      true
    );
    cli('screenshot', path.join(shotDir, 'settings-cli-narrow.png'));
    cli('close');
    fs.writeFileSync(logPath, `${commands.join('\n')}\n\nASSERTIONS: PASS\n`);
  } catch (error) {
    try {
      cli('screenshot', path.join(shotDir, 'failure.png'));
    } catch (error) {
      /* preserve the original failure */
    }
    fs.writeFileSync(logPath, `${commands.join('\n')}\n\nASSERTIONS: FAIL\n${error.stack}\n`);
    throw error;
  } finally {
    try {
      cli('close');
    } catch (error) {
      /* session cleanup is best effort */
    }
    server.kill();
    fs.rmSync(config, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
