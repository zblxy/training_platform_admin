import { test, expect, type Page } from '@playwright/test';
const token = 'a'.repeat(43);
const item = (index: number) => ({ id: String(index), serialNumber: `CERT-${String(index).padStart(32, '0')}`, learnerName: `Learner ${index}`, courseTitle: 'Safety', issuedAt: '2026-01-01T01:00:00.000Z', issueDate: '2025-12-31', status: index === 0 ? 'revoked' : 'active' });
async function supplyToken(page: Page) {
  if (await page.locator('details').getAttribute('open') === null) await page.getByText('API token', { exact: true }).click();
  await page.getByLabel('Generated admin token').fill(token);
  await page.getByRole('button', { name: 'Use token' }).click();
}
test('search, sort, paging, token handling and date-only display', async ({ page }) => {
  await page.route('**/api/certificates?**', async route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    const query = new URL(route.request().url()).searchParams;
    const search = query.get('search') ?? '';
    const pageNumber = Number(query.get('page'));
    const size = Number(query.get('pageSize'));
    const items = search ? (search === 'nobody' ? [] : [item(0)]) : Array.from({ length: Math.min(size, Math.max(0, 25 - (pageNumber - 1) * size)) }, (_, i) => item((pageNumber - 1) * size + i));
    await route.fulfill({ json: { items, page: pageNumber, pageSize: Number(query.get('pageSize')), total: search ? items.length : 25 } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Certificates', exact: true })).toBeVisible();
  await supplyToken(page);
  await expect(page.getByText('25 certificates found.', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Revoked', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '2025-12-31', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  const sorted = page.waitForRequest(request => request.url().includes('sortBy=learnerName'));
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('learnerName'); await sorted;
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  const ascending = page.waitForRequest(request => request.url().includes('sortDirection=asc'));
  await page.getByLabel('Sort direction').selectOption('asc'); await ascending;
  await page.getByLabel('Learner name or certificate serial number').fill(item(0).serialNumber);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('1 certificates found.', { exact: true })).toBeVisible();
  await page.getByLabel('Learner name or certificate serial number').fill('nobody');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No certificates match your search.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByText('25 certificates found.', { exact: true })).toBeVisible();
  await page.getByLabel('Rows per page').selectOption('10');
  await expect(page.getByText('Page 1 of 3')).toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(11);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.reload();
  await expect(page.getByText('Supply a generated admin token to load certificates.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});
test('loading, unauthorized, malformed responses, failure and keyboard retry', async ({ page }) => {
  let state = 'unauthorized';
  await page.route('**/api/certificates?**', async route => {
    await new Promise(resolve => setTimeout(resolve, 200));
    await route.fulfill(state === 'unauthorized' ? { status: 401, json: {} } : state === 'failure' ? { status: 503, json: {} } : state === 'malformed' ? { json: {} } : { json: { items: [], total: 0, page: 1, pageSize: 20 } });
  });
  await page.goto('/'); await supplyToken(page);
  await expect(page.getByText('Loading certificates…')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('token is invalid');
  state = 'failure'; await supplyToken(page);
  await expect(page.getByRole('alert')).toContainText('Unable to load');
  state = 'malformed'; await page.getByRole('button', { name: 'Retry certificates' }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to load');
  state = 'ready'; await page.getByRole('button', { name: 'Retry certificates' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('No certificates match your search.')).toBeVisible();
  if (await page.locator('details').getAttribute('open') === null) await page.getByText('API token', { exact: true }).click();
  await page.getByRole('button', { name: 'Clear token' }).click();
  await expect(page.getByText('Supply a generated admin token to load certificates.')).toBeVisible();
});
test('a delayed response from a previous tenant cannot replace current results', async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route('**/api/certificates?**', async route => {
    const first = route.request().headers().authorization === `Bearer ${token}`;
    if (first) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { items: [{ ...item(0), learnerName: first ? 'Old tenant' : 'Current tenant' }], total: 1, page: 1, pageSize: 20 } });
  });
  await page.goto('/'); await supplyToken(page);
  await expect.poll(() => Boolean(release)).toBeTruthy();
  if (await page.locator('details').getAttribute('open') === null) await page.getByText('API token', { exact: true }).click();
  await page.getByLabel('Generated admin token').fill('b'.repeat(43));
  await page.getByRole('button', { name: 'Use token' }).click();
  await expect(page.getByRole('cell', { name: 'Current tenant' })).toBeVisible();
  release?.();
  await expect(page.getByRole('cell', { name: 'Old tenant' })).toHaveCount(0);
});
