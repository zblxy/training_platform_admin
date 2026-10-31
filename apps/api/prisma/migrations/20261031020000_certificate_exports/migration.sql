BEGIN;
CREATE TABLE "CertificateExport" (
  id UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  search TEXT NOT NULL,
  "sortBy" TEXT NOT NULL CHECK ("sortBy" IN ('issuedAt','learnerName','serialNumber','courseTitle')),
  "sortDirection" TEXT NOT NULL CHECK ("sortDirection" IN ('asc','desc')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  processed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3),
  "leaseId" UUID,
  "leaseUntil" TIMESTAMPTZ(3),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  CONSTRAINT export_requester FOREIGN KEY ("tenantId","requestedById") REFERENCES "Admin"("tenantId",id) ON DELETE RESTRICT,
  CONSTRAINT export_progress CHECK (processed >= 0 AND total >= processed)
);
CREATE INDEX "CertificateExport_status_createdAt_idx" ON "CertificateExport"(status,"createdAt");
CREATE INDEX "CertificateExport_expiresAt_idx" ON "CertificateExport"("expiresAt");
-- Double clicks and concurrent submissions cannot queue duplicate active work.
CREATE UNIQUE INDEX export_one_active_per_admin ON "CertificateExport"("tenantId","requestedById") WHERE status IN ('queued','running');
CREATE TABLE "CertificateExportChunk" (
  "exportId" UUID NOT NULL REFERENCES "CertificateExport"(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  content BYTEA NOT NULL,
  PRIMARY KEY ("exportId",sequence)
);
COMMIT;
