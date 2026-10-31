import { test, expect } from '@playwright/test';
test('admin console connects to the real API through the web origin', async ({ page, request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ status: 'ok' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Training platform admin' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'API connection' })).toHaveText('API connection available.');
});
test('loading, failure and keyboard retry', async ({ page }) => {
  let fail = true;
  await page.route('**/api/health', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ status: fail ? 503 : 200, json: fail ? {} : { status: 'ok' } });
  });
  await page.goto('/');
  await expect(page.getByRole('status', { name: 'API connection' })).toHaveText('Checking API connection…');
  await expect(page.getByRole('status', { name: 'API connection' })).toHaveText('API connection unavailable.');
  fail = false;
  await page.getByRole('button', { name: 'Retry connection' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status', { name: 'API connection' })).toHaveText('API connection available.');
});
test('malformed health response is an error', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'unexpected' } }));
  await page.goto('/');
  await expect(page.getByRole('status', { name: 'API connection' })).toHaveText('API connection unavailable.');
});
