import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, csvHeader, csvRow } from '../dist/modules/certificate-exports/csv.js';
import { isCertificateExportStatus } from '@training/shared';
test('CSV preserves Unicode, delimiters, quotes and line breaks while neutralizing formulas', () => {
  assert.equal(csvCell('李, "Alex"\r\nLee'), '"李, ""Alex""\r\nLee"');
  for (const text of ['=1+1', '+1', '-1', '@SUM(A1)', '  =1', '\tname', '\nname', '\uFEFF=1']) assert.equal(csvCell(text), `"'${text}"`);
  assert.equal(csvRow({ learnerName: 'Alex', courseTitle: '安全', serialNumber: 'CERT-1', issueDate: '2025-12-31' }), '"Alex","安全","CERT-1","2025-12-31"\r\n');
  assert.ok(csvHeader.startsWith('\uFEFF'));
});
test('export contract rejects malformed or impossible progress', () => {
  const valid = { id: '00000000-0000-4000-8000-000000000000', status: 'running', processed: 2, total: 3, search: '', sortBy: 'issuedAt', sortDirection: 'desc', createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), error: null };
  assert.equal(isCertificateExportStatus(valid), true);
  for (const patch of [{ id: '../secret' }, { processed: -1 }, { total: 1 }, { total: 1.5 }, { sortBy: 'tenantId' }, { status: 'unknown' }]) assert.equal(isCertificateExportStatus({ ...valid, ...patch }), false);
});
