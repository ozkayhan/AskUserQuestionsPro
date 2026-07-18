const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

test('browser settings behavior is verified with Playwright and artifacts are preserved', async (t) => {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (error) {
    t.skip('install the Playwright Node package to run browser evidence');
    return;
  }
  const dir = path.join(__dirname, 'artifacts', 'settings-v2');
  fs.mkdirSync(dir, { recursive: true });
  const config = fs.mkdtempSync('/tmp/aukp-e2e-');
  const port = 4597;
  const child = spawn(process.execPath, ['server/server.js'], {
    env: { ...process.env, ASKUSER_PORT: String(port), XDG_CONFIG_HOME: config },
    stdio: 'ignore',
  });
  t.after(() => child.kill());
  for (let i = 0; i < 30; i += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
    } catch (error) {
      /* server is still starting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const browser = await chromium.launch({ headless: true });
  const log = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    await page.goto(`http://127.0.0.1:${port}/`);
    const fab = page.getByRole('button', { name: 'Settings' });
    await fab.click();
    const dialog = page.getByRole('dialog');
    await assert.doesNotReject(() => dialog.waitFor({ state: 'visible' }));
    assert.equal(
      await page
        .getByRole('button', { name: 'Close settings' })
        .evaluate((e) => globalThis.document.activeElement === e),
      true
    );
    await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate((e) => e.contains(globalThis.document.activeElement)), true);
    await page.keyboard.press('Escape');
    await fab.evaluate((e) => globalThis.document.activeElement === e);
    assert.equal(await fab.evaluate((e) => globalThis.document.activeElement === e), true);
    await fab.click();
    await page.getByRole('switch', { name: 'Reduce motion' }).click();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await page.getByText('Settings saved.').waitFor();
    await page.reload();
    await fab.click();
    assert.equal(
      await page.getByRole('switch', { name: 'Reduce motion' }).getAttribute('aria-checked'),
      'true'
    );
    await page.screenshot({ path: path.join(dir, 'desktop.png') });
    const narrow = await browser.newPage({
      viewport: { width: 320, height: 800 },
      reducedMotion: 'reduce',
    });
    await narrow.goto(`http://127.0.0.1:${port}/`);
    assert.equal(
      await narrow.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth
      ),
      true
    );
    await narrow.screenshot({ path: path.join(dir, 'narrow.png') });
    const future = await page.evaluate(() =>
      globalThis.Settings_Schema.inspectEnvelope({ _v: 999 })
    );
    assert.equal(future.valid, false);
    log.push(
      'dialog open/close, focus containment/return, persistence, future-version rejection, narrow viewport, reduced motion: PASS'
    );
    fs.writeFileSync(path.join(dir, 'assertions.log'), log.join('\n') + '\n');
  } finally {
    await browser.close();
  }
});
