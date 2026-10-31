import { test, expect, type Page } from '@playwright/test';
const token = 'a'.repeat(43);
const id = '00000000-0000-0000-0000-000000000001';
const initial = { id, serialNumber: `CERT-${'1'.repeat(32)}`, learnerName: 'Alex', courseTitle: 'Safety',
  issuedAt: '2026-01-01T01:00:00.000Z', issueDate: '2025-12-31', issueTimeZone: 'America/New_York', status: 'active',
  revokedAt: null, revocationReason: null, auditEvents: [{ action: 'ISSUED', actorName: 'Admin', occurredAt: '2026-01-01T01:00:00.000Z' }] };
async function setup(page: Page) {
  await page.route('**/api/certificates/courses', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/certificates?**', route => route.fulfill({ json: { items: [initial], total: 1, page: 1, pageSize: 20 } }));
  await page.goto('/');
  await page.getByLabel('Generated admin token').fill(token); await page.getByRole('button', { name: 'Use token' }).click();
}
async function open(page: Page) { await page.getByRole('button', { name: initial.serialNumber, exact: true }).click(); }
const region = (page: Page) => page.getByRole('region', { name: 'Certificate detail', exact: true });
test('detail, keyboard cancellation, confirmation, audit history and list refresh', async ({ page }) => {
  let revoked = false, calls = 0;
  const changed = { ...initial, status: 'revoked', revokedAt: '2026-02-01T00:00:00.000Z', revocationReason: 'Correction',
    auditEvents: [...initial.auditEvents, { action: 'REVOKED', actorName: 'Admin', occurredAt: '2026-02-01T00:00:00.000Z' }] };
  await page.route(`**/api/certificates/${id}`, route => route.fulfill({ json: revoked ? changed : initial }));
  await page.route(`**/api/certificates/${id}/revoke`, async route => {
    calls++; expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    expect(route.request().postDataJSON()).toEqual({ reason: 'Correction' });
    await new Promise(resolve => setTimeout(resolve, 250)); revoked = true;
    await route.fulfill({ json: changed });
  });
  await setup(page);
  await page.route('**/api/certificates?**', route => route.fulfill({ json: { items: [revoked ? changed : initial], total: 1, page: 1, pageSize: 20 } }));
  await open(page);
  await expect(region(page)).toContainText('2025-12-31 20:00 (America/New_York)');
  await expect(region(page)).toContainText('Issued by Admin');
  await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible(); expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm revocation', exact: true })).toBeDisabled();
  await page.getByLabel('Revocation reason', { exact: true }).fill('   ');
  await expect(page.getByRole('button', { name: 'Confirm revocation', exact: true })).toBeDisabled();
  await page.getByLabel('Revocation reason', { exact: true }).fill('  Correction  ');
  await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm revocation', exact: true })).toBeDisabled();
  await expect(page.getByText('Certificate revoked successfully.', { exact: true })).toBeVisible();
  expect(calls).toBe(1);
  await expect(region(page)).toContainText('Revoked by Admin'); await expect(region(page)).toContainText('Correction');
  await expect(page.getByRole('cell', { name: 'Revoked', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revoke certificate', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close certificate detail' }).click(); await expect(region(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Certificates', exact: true })).toBeFocused();
});
test('loading, missing, unauthorized, invalid response and retry', async ({ page }) => {
  let state = 'missing';
  await page.route(`**/api/certificates/${id}`, async route => {
    await new Promise(resolve => setTimeout(resolve, 150));
    await route.fulfill(state === 'missing' ? { status: 404, json: {} } : state === 'unauthorized' ? { status: 401, json: {} } : state === 'failure' ? { status: 503, json: {} } : state === 'invalid' ? { json: {} } : { json: initial });
  });
  await setup(page); await open(page);
  await expect(region(page).getByRole('status')).toContainText('Loading');
  await expect(region(page).getByRole('alert')).toContainText('Certificate not found');
  for (const next of ['unauthorized', 'failure', 'invalid', 'ready']) {
    state = next; await page.getByRole('button', { name: 'Reload certificate detail' }).click();
    if (next === 'ready') await expect(region(page)).toContainText('Issued by Admin');
    else await expect(region(page).getByRole('alert')).toContainText(next === 'unauthorized' ? 'no longer authorized' : 'Unable to load');
  }
});
test('failed revocation retains reason and allows safe retry', async ({ page }) => {
  let calls = 0;
  await page.route(`**/api/certificates/${id}`, route => route.fulfill({ json: initial }));
  await page.route(`**/api/certificates/${id}/revoke`, route => { calls++; return route.fulfill({ status: calls === 1 ? 503 : 401, json: {} }); });
  await setup(page); await open(page); await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
  await page.getByLabel('Revocation reason', { exact: true }).fill('Correction');
  await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Unable to revoke');
  await expect(page.getByLabel('Revocation reason', { exact: true })).toHaveValue('Correction');
  await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('no longer authorized');
  expect(calls).toBe(2);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(region(page)).toContainText('Active');
});
test('clearing or changing the token closes detail and removes previous tenant data', async ({ page }) => {
  await page.route(`**/api/certificates/${id}`, route => route.fulfill({ json: initial }));
  await setup(page); await open(page); await expect(region(page)).toContainText('Issued by Admin');
  await page.getByText('API token', { exact: true }).click();
  await page.getByLabel('Generated admin token').fill('b'.repeat(43)); await page.getByRole('button', { name: 'Use token' }).click();
  await expect(region(page)).toHaveCount(0);
  await open(page); await expect(region(page)).toContainText('Issued by Admin');
  await page.getByRole('button', { name: 'Clear token' }).click(); await expect(region(page)).toHaveCount(0);
});

test('network failure explains an uncertain outcome and reload reconciles server state', async ({ page }) => {
  let revoked = false;
  const changed = { ...initial, status: 'revoked', revokedAt: '2026-02-01T00:00:00.000Z', revocationReason: 'Correction',
    auditEvents: [...initial.auditEvents, { action: 'REVOKED', actorName: 'Admin', occurredAt: '2026-02-01T00:00:00.000Z' }] };
  await page.route(`**/api/certificates/${id}`, route => route.fulfill({ json: revoked ? changed : initial }));
  await page.route(`**/api/certificates/${id}/revoke`, route => { revoked = true; return route.abort('failed'); });
  await setup(page); await open(page); await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
  await page.getByLabel('Revocation reason', { exact: true }).fill('Correction');
  await page.getByRole('button', { name: 'Confirm revocation', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('result could not be confirmed');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Reload certificate detail' }).click();
  await expect(region(page)).toContainText('Revoked by Admin');
  await expect(page.getByRole('button', { name: 'Revoke certificate', exact: true })).toHaveCount(0);
});
test('a late detail response is discarded after switching tenant tokens', async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route(`**/api/certificates/${id}`, async route => {
    if (route.request().headers().authorization === `Bearer ${token}`) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { ...initial, learnerName: 'Old tenant private learner' } });
  });
  await setup(page); await open(page); await expect.poll(() => Boolean(release)).toBeTruthy();
  await page.getByText('API token', { exact: true }).click();
  await page.getByLabel('Generated admin token').fill('b'.repeat(43)); await page.getByRole('button', { name: 'Use token' }).click();
  release?.();
  await expect(region(page)).toHaveCount(0);
  await expect(page.getByText('Old tenant private learner', { exact: true })).toHaveCount(0);
});
