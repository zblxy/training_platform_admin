BEGIN;
CREATE TABLE "BulkIssuanceOperation" (
  id UUID PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  key VARCHAR(128) NOT NULL CHECK (key ~ '^[A-Za-z0-9._:-]{1,128}$'),
  "courseId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BulkIssuanceOperation_requester_fkey" FOREIGN KEY ("tenantId", "requestedById") REFERENCES "Admin" ("tenantId", id) ON DELETE RESTRICT,
  CONSTRAINT "BulkIssuanceOperation_course_fkey" FOREIGN KEY ("tenantId", "courseId") REFERENCES "Course" ("tenantId", id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "BulkIssuanceOperation_tenantId_requestedById_key_key"
  ON "BulkIssuanceOperation" ("tenantId", "requestedById", key);
CREATE TABLE "BulkIssuanceItem" (
  "operationId" UUID NOT NULL REFERENCES "BulkIssuanceOperation" (id) ON DELETE RESTRICT,
  "enrollmentId" UUID NOT NULL,
  "learnerId" UUID NOT NULL,
  "learnerName" TEXT NOT NULL,
  outcome JSONB,
  PRIMARY KEY ("operationId", "enrollmentId")
);
CREATE INDEX "Certificate_tenantId_issueDate_id_idx" ON "Certificate" ("tenantId", "issueDate", id);
COMMIT;
