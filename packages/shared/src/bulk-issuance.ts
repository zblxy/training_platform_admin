export interface CourseOption { id: string; title: string }
export interface CourseListResponse { items: CourseOption[] }
export type BulkIssuanceOutcome = {
  enrollmentId: string;
  learnerId: string;
  learnerName: string;
} & (
  | { status: 'issued'; certificateId: string; serialNumber: string }
  | { status: 'skipped'; reason: 'incomplete' | 'already_issued' | 'revoked' }
  | { status: 'failed'; reason: 'issuance_failed' }
);
export interface BulkIssuanceResponse {
  courseId: string;
  total: number;
  issued: number;
  skipped: number;
  failed: number;
  outcomes: BulkIssuanceOutcome[];
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
export function isCourseListResponse(value: unknown): value is CourseListResponse {
  return record(value) && Array.isArray(value.items) && value.items.every((item: unknown) =>
    record(item) && typeof item.id === 'string' && typeof item.title === 'string');
}
export function isBulkIssuanceResponse(value: unknown): value is BulkIssuanceResponse {
  if (!record(value) || typeof value.courseId !== 'string' || !Array.isArray(value.outcomes)) return false;
  for (const key of ['total', 'issued', 'skipped', 'failed']) {
    if (!Number.isSafeInteger(value[key]) || (value[key] as number) < 0) return false;
  }
  const outcomes: unknown[] = value.outcomes;
  if (!outcomes.every(item => record(item) && typeof item.enrollmentId === 'string' &&
    typeof item.learnerId === 'string' && typeof item.learnerName === 'string' && (
      (item.status === 'issued' && typeof item.certificateId === 'string' && typeof item.serialNumber === 'string') ||
      (item.status === 'skipped' && ['incomplete', 'already_issued', 'revoked'].includes(String(item.reason))) ||
      (item.status === 'failed' && item.reason === 'issuance_failed')))) return false;
  return value.total === outcomes.length && ['issued', 'skipped', 'failed'].every(status =>
    value[status] === outcomes.filter(item => record(item) && item.status === status).length);
}
