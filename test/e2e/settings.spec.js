const { test, expect } = require('@playwright/test');

test.describe('browser settings', () => {
  test.beforeEach(async ({ request }) => {
    const response = await request.post('/settings', { data: { reduceMotion: false } });
    expect(response.ok()).toBeTruthy();
  });

  test.afterEach(async ({ request }) => {
    await request.post('/settings', { data: { reduceMotion: false } });
  });

  test('preserves focus, persistence, responsive layout, and schema safety', async ({
    browser,
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const settingsButton = page.getByRole('button', { name: 'Settings' });
    await settingsButton.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close settings' })).toBeFocused();

    await page.keyboard.press('Tab');
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(globalThis.document.activeElement)))
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(settingsButton).toBeFocused();

    await settingsButton.click();
    const reduceMotion = page.getByRole('switch', { name: 'Reduce motion' });
    await expect(reduceMotion).toHaveAttribute('aria-checked', 'false');
    await reduceMotion.click();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText('Settings saved.')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('switch', { name: 'Reduce motion' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await page.screenshot({ path: testInfo.outputPath('settings-desktop.png') });

    const narrow = await browser.newPage({
      viewport: { width: 320, height: 800 },
      reducedMotion: 'reduce',
    });
    try {
      await narrow.goto('/');
      await expect
        .poll(() =>
          narrow.evaluate(
            () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth
          )
        )
        .toBe(true);
      await narrow.screenshot({ path: testInfo.outputPath('settings-narrow.png') });
    } finally {
      await narrow.close();
    }

    const futureEnvelope = await page.evaluate(() =>
      globalThis.Settings_Schema.inspectEnvelope({ _v: 999 })
    );
    expect(futureEnvelope.valid).toBe(false);
  });
});

test('off-step scale displays, confirms, and submits the same valid value', async ({
  page,
  request,
}) => {
  const askResponse = request.post('/ask', {
    data: {
      questions: [
        {
          header: 'Scale regression',
          question: 'Choose an off-step value',
          type: 'scale',
          min: 1,
          max: 10,
          step: 2,
        },
      ],
    },
  });

  await expect
    .poll(async () => {
      const current = await request.get('/current');
      return (await current.json()).questions?.[0]?.question;
    })
    .toBe('Choose an off-step value');
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Choose an off-step value' })).toBeVisible();
  await expect(page.locator('.scale__value')).toHaveText('7');
  await expect(page.locator('.scale__value')).toHaveAttribute('data-empty', 'true');
  await expect(page.getByRole('slider', { name: 'Choose an off-step value' })).toHaveValue('7');
  await page.getByRole('button', { name: 'Continue to next question' }).click();
  await expect(page.getByRole('main').getByText('7 / 10')).toBeVisible();
  await page.getByRole('button', { name: /Submit answers/ }).click();

  const response = await askResponse;
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ answers: { 'Choose an off-step value': 7 } });
});
