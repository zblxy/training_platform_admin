import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localIssueDate, enrollmentDisplayStatus } from '../dist/modules/certificates/certificates.service.js';
test('tenant-local dates cross UTC midnight and daylight saving boundaries', () => {
  for (const [instant, zone, expected] of [
    ['2026-01-01T01:00:00Z', 'America/New_York', '2025-12-31'],
    ['2026-01-01T23:00:00Z', 'Asia/Shanghai', '2026-01-02'],
    ['2026-03-08T06:59:59Z', 'America/New_York', '2026-03-08'],
    ['2026-03-08T07:00:00Z', 'America/New_York', '2026-03-08'],
  ]) assert.equal(localIssueDate(new Date(instant), zone).toISOString().slice(0,10), expected);
  assert.equal(enrollmentDisplayStatus('COMPLETED', { revokedAt: null }), 'certified');
  assert.equal(enrollmentDisplayStatus('COMPLETED', { revokedAt: new Date() }), 'completed');
  assert.equal(enrollmentDisplayStatus('INCOMPLETE', null), 'incomplete');
});
