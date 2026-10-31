export const certificateSortFields = ['issuedAt', 'learnerName', 'serialNumber', 'courseTitle'] as const;
export type CertificateSortField = typeof certificateSortFields[number];
export interface CertificateListItem {
  id: string;
  serialNumber: string;
  learnerName: string;
  courseTitle: string;
  issuedAt: string;
  issueDate: string;
  status: 'active' | 'revoked';
}
export interface CertificateListResponse {
  items: CertificateListItem[];
  total: number;
  page: number;
  pageSize: number;
}
export function isCertificateListResponse(value: unknown): value is CertificateListResponse {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return Number.isSafeInteger(row.total) && (row.total as number) >= 0 &&
    Number.isSafeInteger(row.page) && (row.page as number) >= 1 &&
    Number.isSafeInteger(row.pageSize) && (row.pageSize as number) >= 1 && (row.pageSize as number) <= 100 &&
    Array.isArray(row.items) && row.items.length <= (row.pageSize as number) && row.items.every((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false;
      const entry = item as Record<string, unknown>;
      return typeof entry.id === 'string' && typeof entry.serialNumber === 'string' &&
        typeof entry.learnerName === 'string' && typeof entry.courseTitle === 'string' &&
        typeof entry.issuedAt === 'string' && typeof entry.issueDate === 'string' &&
        (entry.status === 'active' || entry.status === 'revoked');
    });
}
