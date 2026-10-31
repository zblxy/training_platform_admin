import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBulkIssuanceResponse, isCourseListResponse } from '@training/shared';
test('bulk contracts reject malformed outcomes and inconsistent totals', () => {
  const valid = { courseId: 'course', total: 1, issued: 1, skipped: 0, failed: 0, outcomes: [{ enrollmentId: 'enrollment', learnerId: 'learner', learnerName: 'Learner', status: 'issued', certificateId: 'certificate', serialNumber: 'CERT-123' }] };
  assert.equal(isBulkIssuanceResponse(valid), true);
  for (const value of [null, {}, { ...valid, total: 2 }, { ...valid, issued: 0 }, { ...valid, failed: -1 }, { ...valid, outcomes: [null] }, { ...valid, outcomes: [{ ...valid.outcomes[0], serialNumber: null }] }, { ...valid, issued: 0, skipped: 1, outcomes: [{ ...valid.outcomes[0], status: 'skipped', reason: 'unknown' }] }]) assert.equal(isBulkIssuanceResponse(value), false);
  assert.equal(isCourseListResponse({ items: [{ id: 'course', title: 'Safety' }] }), true);
  for (const value of [null, {}, { items: [null] }, { items: [{ id: 1, title: 'Safety' }] }]) assert.equal(isCourseListResponse(value), false);
});
