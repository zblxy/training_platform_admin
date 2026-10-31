import { test, expect, type Page } from '@playwright/test';
const token = 'a'.repeat(43);
const courseId = 'd48f7859-9209-ed21-51fe-efd2bfc5708d';
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
  for (const code of [400, 503, 401, 404, 200]) {
    status = code;
    await button.click();
    await expect(page.locator('section', { has: page.getByRole('heading', { name: 'Bulk issuance' }) }).getByRole('alert')).toBeVisible();
    if (code === 400) {
      await expect(page.getByText('The issuance request is invalid. Reload courses and select a course again. No certificates were issued.')).toBeVisible();
      await expect(page.getByText(/Some certificates may have been issued/)).toHaveCount(0);
    }
    await expect(button).toBeEnabled();
  }
  payload = { courseId, total: 0, issued: 0, skipped: 0, failed: 0, outcomes: [] };
  await button.click(); await expect(page.getByText('No learners are enrolled in this course.')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Bulk issuance result pagination' })).toHaveCount(0);
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
test('paginates 100,000 outcomes, supports keyboard navigation and resets for new results', async ({ page }) => {
  const outcomes = Array.from({ length: 100000 }, (_, index) => ({
    enrollmentId: String(index), learnerId: String(index), learnerName: `Learner ${index + 1}`,
    status: 'skipped', reason: 'already_issued',
  }));
  let calls = 0;
  await page.route('**/api/certificates/bulk-issuance', route => {
    calls++;
    const items = calls === 1 ? outcomes : outcomes.slice(0, 25);
    return route.fulfill({ json: { courseId, total: items.length, issued: 0, skipped: items.length, failed: 0, outcomes: items } });
  });
  await setup(page);
  await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption(courseId);
  const submit = page.getByRole('button', { name: 'Issue to eligible learners' });
  await submit.click();
  const table = page.getByRole('table', { name: 'Bulk issuance results' });
  const nav = page.getByRole('navigation', { name: 'Bulk issuance result pagination' });
  const size = page.getByRole('combobox', { name: 'Results per page', exact: true });
  await expect(size).toHaveValue('20');
  await expect(table.getByRole('row')).toHaveCount(21);
  await expect(nav).toContainText('Page 1 of 5000. Showing 1–20 of 100000 results.');
  await expect(nav.getByRole('button', { name: 'First page', exact: true })).toBeDisabled();
  await expect(nav.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
  await nav.getByRole('button', { name: 'Next page', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(nav).toContainText('Page 2 of 5000. Showing 21–40 of 100000 results.');
  await expect(table.getByRole('cell', { name: 'Learner 21', exact: true })).toBeVisible();
  await expect(table.getByRole('cell', { name: 'Learner 1', exact: true })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Previous page', exact: true }).click();
  await expect(nav).toContainText('Page 1 of 5000.');
  await nav.getByRole('button', { name: 'Last page', exact: true }).click();
  await expect(nav).toContainText('Page 5000 of 5000. Showing 99981–100000 of 100000 results.');
  await expect(table.getByRole('cell', { name: 'Learner 100000', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
  await expect(nav.getByRole('button', { name: 'Last page', exact: true })).toBeDisabled();
  for (const count of [50, 100, 10]) {
    await size.selectOption(String(count));
    await expect(nav).toContainText(`Page 1 of ${100000 / count}. Showing 1–${count} of 100000 results.`);
    await expect(table.getByRole('row')).toHaveCount(count + 1);
    await nav.getByRole('button', { name: 'Next page', exact: true }).click();
  }
  await expect(page.getByText('Completed: 0 issued, 100000 skipped, 0 failed.')).toBeVisible();
  expect(calls).toBe(1);
  await submit.click();
  await expect(nav).toContainText('Page 1 of 3. Showing 1–10 of 25 results.');
  await nav.getByRole('button', { name: 'Last page', exact: true }).click();
  await expect(nav).toContainText('Page 3 of 3. Showing 21–25 of 25 results.');
  await expect(table.getByRole('row')).toHaveCount(6);
  await nav.getByRole('button', { name: 'First page', exact: true }).click();
  await expect(nav).toContainText('Page 1 of 3.');
  expect(calls).toBe(2);
  await page.getByRole('combobox', { name: 'Course', exact: true }).selectOption('');
  await expect(table).toHaveCount(0);
  await expect(nav).toHaveCount(0);
});
