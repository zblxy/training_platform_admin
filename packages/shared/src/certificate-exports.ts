import type { CertificateSortField } from './certificates.js';
export interface CertificateExportRequest {
  search: string;
  sortBy: CertificateSortField;
  sortDirection: 'asc' | 'desc';
}
export interface CertificateExportStatus extends CertificateExportRequest {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  processed: number;
  total: number;
  createdAt: string;
  expiresAt: string;
  error: string | null;
}
export function isCertificateExportStatus(value: unknown): value is CertificateExportStatus {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && /^[0-9a-f-]{36}$/i.test(row.id) &&
    ['queued', 'running', 'completed', 'failed'].includes(String(row.status)) &&
    Number.isSafeInteger(row.processed) && Number.isSafeInteger(row.total) &&
    (row.processed as number) >= 0 && (row.total as number) >= (row.processed as number) &&
    typeof row.search === 'string' && ['issuedAt', 'learnerName', 'serialNumber', 'courseTitle'].includes(String(row.sortBy)) &&
    ['asc', 'desc'].includes(String(row.sortDirection)) && typeof row.createdAt === 'string' &&
    typeof row.expiresAt === 'string' && (row.error === null || typeof row.error === 'string');
}
