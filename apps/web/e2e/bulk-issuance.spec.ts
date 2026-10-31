import { test, expect, type Page } from '@playwright/test';
const token = 'a'.repeat(43);
const courseId = 'course';
const result = { courseId, total: 3, issued: 1, skipped: 1, failed: 1, outcomes: [
  { enrollmentId: 'one', learnerId: 'one', learnerName: 'Alice', status: 'issued', certificateId: 'cert', serialNumber: 'CERT-123' },
  { enrollmentId: 'two', learnerId: 'two', learnerName: 'Bob', status: 'skipped', reason: 'incomplete' },
  { enrollmentId: 'three', learnerId: 'three', learnerName: 'Carol', status: 'failed', reason: 'issuance_failed' },
] };
async function setup(page: Page) {
  await page.route('**/api/certificates?**', route => route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } }));
  await page.route('**/api/certificates/courses', route => route.fulfill({ json: { items: [{ id: courseId, title: 'Safety' }] } }));
  await page.goto('/');
  await page.getByLabel('Generated admin token').fill(token);
  await page.getByRole('button', { name: 'Use token', exact: true }).click();
}
test('guards duplicate submissions, shows status and outcomes, and refreshes certificates', async ({ page }) => {
  let calls = 0;
  let release: (() => void) | undefined;
  await page.route('**/api/certificates/bulk-issuance', async route => {
    calls++;
    expect(route.request().headers().authorization).toBe(`Bearer ${token}`);
    expect(route.request().postDataJSON()).toEqual({ courseId });
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: result });
  });
  await setup(page);
  const button = page.getByRole('button', { name: 'Issue to eligible learners' });
  await expect(button).toBeDisabled();
  await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption(courseId);
  await button.focus(); await page.keyboard.press('Enter');
  await expect.poll(() => calls).toBe(1);
  await expect(button).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Course', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reload courses' })).toBeDisabled();
  await expect(page.getByText('Issuing certificates… Keep this page open for results.')).toBeVisible();
  // Exercise the handler guard as well as the disabled button.
  await page.locator('form[aria-busy]').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  expect(calls).toBe(1);
  const refreshed = page.waitForRequest(request => request.url().includes('/api/certificates?'));
  release?.(); await refreshed;
  await expect(page.getByText('Completed: 1 issued, 1 skipped, 1 failed.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Bulk issuance results' })).toBeVisible();
  for (const text of ['Alice', 'Bob', 'Carol', 'CERT-123', 'Course not completed', 'Issuance failed; retry this course']) await expect(page.getByRole('cell', { name: text, exact: true })).toBeVisible();
  await expect(button).toBeEnabled();
});
test('course loading, retry, empty and invalid-token states', async ({ page }) => {
  await setup(page);
  let status = 503;
  await page.route('**/api/certificates/courses', route => route.fulfill({ status, json: { items: [] } }));
  await page.getByRole('button', { name: 'Reload courses' }).click();
  await expect(page.getByText('Unable to load courses.')).toBeVisible();
  status = 200; await page.getByRole('button', { name: 'Reload courses' }).click();
  await expect(page.getByText('No courses available.')).toBeVisible();
  status = 401; await page.getByRole('button', { name: 'Reload courses' }).click();
  await expect(page.getByText('Supply a valid admin token to load courses.')).toBeVisible();
});
test('issuance failures permit deliberate retry and empty results are explicit', async ({ page }) => {
  let status = 503;
  let payload: unknown = {};
  await page.route('**/api/certificates/bulk-issuance', route => route.fulfill({ status, json: payload }));
  await setup(page); await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption(courseId);
  const button = page.getByRole('button', { name: 'Issue to eligible learners' });
  for (const code of [503, 401, 404, 200]) {
    status = code;
    await button.click();
    await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Bulk issuance' }) }).getByRole('alert')).toBeVisible();
    await expect(button).toBeEnabled();
  }
  payload = { courseId, total: 0, issued: 0, skipped: 0, failed: 0, outcomes: [] };
  await button.click(); await expect(page.getByText('No learners are enrolled in this course.')).toBeVisible();
});
test('a previous token response cannot reveal results after switching tenants', async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route('**/api/certificates/bulk-issuance', async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: result });
  });
  await setup(page); await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption(courseId);
  await page.getByRole('button', { name: 'Issue to eligible learners' }).click();
  await expect.poll(() => Boolean(release)).toBeTruthy();
  await page.getByText('API token', { exact: true }).click();
  await page.getByLabel('Generated admin token').fill('b'.repeat(43));
  await page.getByRole('button', { name: 'Use token', exact: true }).click();
  release?.();
  await expect(page.getByRole('combobox', { name: 'Course', exact: true })).toHaveValue('');
  await expect(page.getByRole('table', { name: 'Bulk issuance results' })).toHaveCount(0);
});
