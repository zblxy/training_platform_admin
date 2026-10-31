export * from './certificates.js';
export * from './bulk-issuance.js';
export interface HealthResponse { status: 'ok' }
export function isHealthResponse(value: unknown): value is HealthResponse {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'ok';
}
