const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test('local app exposes its identity and an accessible waiting shell', async ({
  page,
  request,
}) => {
  const health = await request.get('/health');
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toEqual(
    expect.objectContaining({
      ok: true,
      app: 'askuserquestionspro',
      protocolVersion: expect.any(String),
      packageVersion: expect.any(String),
    })
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('Waiting for a question')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: 'test-results/waiting-mobile.png', fullPage: true });
});
