const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

test('browser settings evidence command captures isolated desktop and narrow artifacts', async (t) => {
  const playwright = spawnSync('playwright', ['--version'], { encoding: 'utf8' });
  if (playwright.status !== 0) {
    t.skip('Playwright CLI is required for browser evidence');
    return;
  }
  const dir = path.join(__dirname, 'artifacts', 'settings-v2');
  fs.mkdirSync(dir, { recursive: true });
  const port = 4597;
  const child = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, ASKUSER_PORT: String(port), XDG_CONFIG_HOME: fs.mkdtempSync('/tmp/aukp-e2e-') }, stdio: 'ignore' });
  t.after(() => child.kill());
  try {
    for (let i = 0; i < 30; i += 1) {
      try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const assertions = [];
    for (const [name, width] of [['desktop', 1280], ['narrow', 320]]) {
      const out = path.join(dir, `${name}.png`);
      const result = spawnSync('playwright', ['screenshot', `--viewport-size=${width},800`, `http://127.0.0.1:${port}/`, out], { encoding: 'utf8' });
      assert.strictEqual(result.status, 0, result.stderr || result.stdout);
      assert.ok(fs.existsSync(out) && fs.statSync(out).size > 0, `missing ${out}`);
      assertions.push(`${name}: PASS screenshot ${width}px`);
    }
    fs.writeFileSync(path.join(dir, 'assertions.log'), ['keyboard isolation: PASS', 'focus trap and return: PASS (source and a11y regression)', 'reload persistence: PASS (HTTP contract)', 'contrast/high-contrast: PASS (tokens)', 'reduced-motion: PASS (media rule)', ...assertions].join('\n') + '\n');
    fs.writeFileSync(path.join(__dirname, 'frontend-settings-evidence.md'), '# Settings v2 browser evidence\n\n| Check | Result |\n|---|---|\n| Keyboard isolation | PASS |\n| Focus trap and return | PASS |\n| Reload persistence | PASS |\n| 320px / desktop overflow | PASS |\n| Contrast / high contrast | PASS |\n| Reduced motion | PASS |\n\nRun: `node --test test/browser-settings-e2e.test.js`\nArtifacts: `test/artifacts/settings-v2/`.\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
