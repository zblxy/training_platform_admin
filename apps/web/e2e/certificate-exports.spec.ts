import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const token = 'a'.repeat(43);
const id = '00000000-0000-4000-8000-000000000001';
const job = { id, search: 'Alex', sortBy: 'courseTitle', sortDirection: 'asc', status: 'queued', processed: 0, total: 25, createdAt: '2026-10-31T00:00:00Z', expiresAt: '2026-11-01T00:00:00Z', error: null };
async function open(page: Page) {
  await page.route('**/api/certificates/courses', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/certificates?**', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { page: Number(params.get('page')), pageSize: Number(params.get('pageSize')), total: 25, items: [{ id: '1', learnerName: 'Alex', courseTitle: 'Safety', serialNumber: 'CERT-1', issuedAt: '2026-01-01T01:00:00Z', issueDate: '2025-12-31', status: 'active' }] } });
  });
  await page.goto('/');
  await page.getByLabel('Generated admin token').fill(token);
  await page.getByRole('button', { name: 'Use token' }).click();
  await expect(page.getByText('25 certificates found.', { exact: true })).toBeVisible();
}
test('exports applied search and sort across pages, displays progress, keeps list usable and downloads CSV', async ({ page }) => {
  let complete = false, starts = 0;
  await page.route('**/api/certificates/exports', async route => {
    starts++;
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    expect(route.request().postDataJSON()).toEqual({ search: 'Alex', sortBy: 'courseTitle', sortDirection: 'asc' });
    await route.fulfill({ status: 202, json: job });
  });
  await page.route(`**/api/certificates/exports/${id}`, route => route.fulfill({ json: { ...job, status: complete ? 'completed' : 'running', processed: complete ? 25 : 10 } }));
  const csv = '\uFEFFLearner name,Course title,Serial number,Issue date\r\n"Alex","Safety","CERT-1","2025-12-31"\r\n';
  await page.route(`**/api/certificates/exports/${id}/download`, route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    return route.fulfill({ contentType: 'text/csv; charset=utf-8', body: csv });
  });
  await open(page);
  await page.getByLabel('Learner name or certificate serial number').fill('Alex');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('courseTitle');
  await page.getByLabel('Sort direction').selectOption('asc');
  await expect(page.getByText('25 certificates found.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.getByLabel('Learner name or certificate serial number').fill('Unsubmitted draft');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('progressbar', { name: 'CSV export progress' })).toHaveAttribute('value', '40');
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.getByText('Page 1 of 2')).toBeVisible();
  complete = true;
  await expect(page.getByRole('button', { name: 'Download CSV', exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  const download = await downloadEvent;
  expect(await readFile((await download.path())!, 'utf8')).toBe(csv);
  expect(starts).toBe(1);
  await page.getByText('API token', { exact: true }).click();
  await page.getByRole('button', { name: 'Clear token' }).click();
  await expect(page.getByRole('button', { name: 'Download CSV', exact: true })).toHaveCount(0);
});
test('start, polling, job and download failures have recoverable states', async ({ page }) => {
  let startFails = true, pollFails = true, exportFails = true;
  await page.route('**/api/certificates/exports', route => route.fulfill(startFails ? { status: 429, json: {} } : { status: 202, json: job }));
  await page.route(`**/api/certificates/exports/${id}`, route => route.fulfill(pollFails ? { status: 503, json: {} } : { json: { ...job, status: exportFails ? 'failed' : 'completed', processed: exportFails ? 0 : 25, error: exportFails ? 'Export failed. Please retry.' : null } }));
  await page.route(`**/api/certificates/exports/${id}/download`, route => route.fulfill({ status: 404, json: {} }));
  await open(page);
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('queue is full');
  startFails = false;
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry export status' })).toBeVisible();
  pollFails = false;
  await page.getByRole('button', { name: 'Retry export status' }).click();
  await expect(page.getByRole('alert')).toContainText('Export failed');
  exportFails = false;
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await page.getByRole('button', { name: 'Download CSV', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('expired');
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeEnabled();
});

test('clearing credentials discards an in-flight export response', async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route('**/api/certificates/exports', route => route.fulfill({ status: 202, json: job }));
  await page.route(`**/api/certificates/exports/${id}`, async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { ...job, status: 'completed', processed: 25 } });
  });
  await open(page);
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await expect.poll(() => Boolean(release)).toBeTruthy();
  await page.getByText('API token', { exact: true }).click();
  await page.getByRole('button', { name: 'Clear token' }).click();
  release?.();
  await expect(page.getByRole('progressbar', { name: 'CSV export progress' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download CSV', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeDisabled();
});
