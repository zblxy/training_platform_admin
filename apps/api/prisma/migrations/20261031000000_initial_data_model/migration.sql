-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('INCOMPLETE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('ISSUED', 'REVOKED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Learner" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Learner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "learnerId" UUID NOT NULL,
    "status" "CompletionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "issuedById" UUID NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueDate" DATE NOT NULL,
    "issueTimeZone" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedById" UUID,
    "revocationReason" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "certificateId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_tokenHash_key" ON "Admin"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_tenantId_id_key" ON "Admin"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Course_tenantId_id_key" ON "Course"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Learner_tenantId_id_key" ON "Learner"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Learner_tenantId_email_key" ON "Learner"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Enrollment_tenantId_status_idx" ON "Enrollment"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_tenantId_id_key" ON "Enrollment"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_tenantId_courseId_learnerId_key" ON "Enrollment"("tenantId", "courseId", "learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_enrollmentId_key" ON "Certificate"("enrollmentId");

-- CreateIndex
CREATE INDEX "Certificate_tenantId_issuedAt_idx" ON "Certificate"("tenantId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_tenantId_id_key" ON "Certificate"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_tenantId_enrollmentId_key" ON "Certificate"("tenantId", "enrollmentId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_occurredAt_idx" ON "AuditEvent"("tenantId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_certificateId_action_key" ON "AuditEvent"("certificateId", "action");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Learner" ADD CONSTRAINT "Learner_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_tenantId_courseId_fkey" FOREIGN KEY ("tenantId", "courseId") REFERENCES "Course"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_tenantId_learnerId_fkey" FOREIGN KEY ("tenantId", "learnerId") REFERENCES "Learner"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_tenantId_enrollmentId_fkey" FOREIGN KEY ("tenantId", "enrollmentId") REFERENCES "Enrollment"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_tenantId_issuedById_fkey" FOREIGN KEY ("tenantId", "issuedById") REFERENCES "Admin"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_tenantId_revokedById_fkey" FOREIGN KEY ("tenantId", "revokedById") REFERENCES "Admin"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_certificateId_fkey" FOREIGN KEY ("tenantId", "certificateId") REFERENCES "Certificate"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_actorId_fkey" FOREIGN KEY ("tenantId", "actorId") REFERENCES "Admin"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma does not represent these checks/triggers. Preserve them in future migrations.
ALTER TABLE "Enrollment" ADD CONSTRAINT enrollment_completion CHECK (
  (status = 'COMPLETED' AND "completedAt" IS NOT NULL) OR
  (status = 'INCOMPLETE' AND "completedAt" IS NULL));
ALTER TABLE "Certificate" ADD CONSTRAINT certificate_revocation CHECK (
  ("revokedAt" IS NULL AND "revokedById" IS NULL AND "revocationReason" IS NULL) OR
  ("revokedAt" IS NOT NULL AND "revokedAt" >= "issuedAt" AND "revokedById" IS NOT NULL AND "revocationReason" IS NOT NULL AND length(btrim("revocationReason")) BETWEEN 1 AND 1000));
ALTER TABLE "Admin" ADD CONSTRAINT token_hash_format CHECK ("tokenHash" ~ '^[a-f0-9]{64}$');

CREATE FUNCTION validate_tenant_timezone() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW."timeZone") THEN
    RAISE EXCEPTION 'Invalid tenant time zone' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tenant_timezone BEFORE INSERT OR UPDATE ON "Tenant" FOR EACH ROW EXECUTE FUNCTION validate_tenant_timezone();

-- Serialize membership mutations through the parent row, including concurrent removals.
CREATE FUNCTION lock_admin_tenant() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."tenantId" <> OLD."tenantId" THEN
    RAISE EXCEPTION 'Admin tenant cannot change' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM 1 FROM "Tenant" WHERE id = OLD."tenantId" FOR UPDATE;
    RETURN OLD;
  END IF;
  PERFORM 1 FROM "Tenant" WHERE id = NEW."tenantId" FOR UPDATE;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_tenant_lock BEFORE INSERT OR UPDATE OR DELETE ON "Admin" FOR EACH ROW EXECUTE FUNCTION lock_admin_tenant();
CREATE FUNCTION require_tenant_admin() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE tenant_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'Tenant' THEN tenant_id := NEW.id;
  ELSE tenant_id := OLD."tenantId"; END IF;
  IF EXISTS (SELECT 1 FROM "Tenant" WHERE id = tenant_id) AND
     NOT EXISTS (SELECT 1 FROM "Admin" WHERE "tenantId" = tenant_id) THEN
    RAISE EXCEPTION 'Tenant must have at least one admin' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER tenant_requires_admin AFTER INSERT OR UPDATE ON "Tenant" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_tenant_admin();
CREATE CONSTRAINT TRIGGER retain_last_admin AFTER DELETE OR UPDATE ON "Admin" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_tenant_admin();

CREATE FUNCTION protect_enrollment() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (NEW.id, NEW."tenantId", NEW."learnerId", NEW."courseId") IS DISTINCT FROM
     (OLD.id, OLD."tenantId", OLD."learnerId", OLD."courseId") THEN
    RAISE EXCEPTION 'Enrollment identity cannot change' USING ERRCODE = '23514';
  END IF;
  IF NEW.status <> 'COMPLETED' AND EXISTS (SELECT 1 FROM "Certificate" WHERE "enrollmentId" = OLD.id) THEN
    RAISE EXCEPTION 'Certified enrollment must remain completed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_enrollment BEFORE UPDATE ON "Enrollment" FOR EACH ROW EXECUTE FUNCTION protect_enrollment();

CREATE FUNCTION validate_certificate() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE completion "CompletionStatus"; zone text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Certificates cannot be deleted or reissued' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.id, NEW."tenantId", NEW."enrollmentId", NEW."issuedById", NEW."issuedAt", NEW."issueDate", NEW."issueTimeZone") IS DISTINCT FROM
       (OLD.id, OLD."tenantId", OLD."enrollmentId", OLD."issuedById", OLD."issuedAt", OLD."issueDate", OLD."issueTimeZone") THEN
      RAISE EXCEPTION 'Issuance fields are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."revokedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'Revocation is final' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT status INTO completion FROM "Enrollment" WHERE id = NEW."enrollmentId" AND "tenantId" = NEW."tenantId" FOR UPDATE;
  IF completion IS DISTINCT FROM 'COMPLETED'::"CompletionStatus" THEN
    RAISE EXCEPTION 'Only completed enrollments are eligible' USING ERRCODE = '23514';
  END IF;
  SELECT "timeZone" INTO zone FROM "Tenant" WHERE id = NEW."tenantId" FOR SHARE;
  IF NEW."revokedAt" IS NOT NULL OR NEW."issueTimeZone" IS DISTINCT FROM zone OR
     NEW."issueDate" IS DISTINCT FROM (NEW."issuedAt" AT TIME ZONE zone)::date THEN
    RAISE EXCEPTION 'Invalid issuance date or initial revocation state' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_certificate BEFORE INSERT OR UPDATE OR DELETE ON "Certificate" FOR EACH ROW EXECUTE FUNCTION validate_certificate();

-- Audit rows can only be created by the certificate trigger and can never be edited.
CREATE FUNCTION protect_audit() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF TG_OP <> 'INSERT' OR pg_trigger_depth() <> 2 THEN
    RAISE EXCEPTION 'Audit events are generated by certificate transitions and are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_audit BEFORE INSERT OR UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION protect_audit();
CREATE FUNCTION audit_certificate() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "AuditEvent" (id, "tenantId", "certificateId", "actorId", action, "occurredAt")
    VALUES (gen_random_uuid(), NEW."tenantId", NEW.id, NEW."issuedById", 'ISSUED', NEW."issuedAt");
  ELSIF OLD."revokedAt" IS NULL AND NEW."revokedAt" IS NOT NULL THEN
    INSERT INTO "AuditEvent" (id, "tenantId", "certificateId", "actorId", action, "occurredAt")
    VALUES (gen_random_uuid(), NEW."tenantId", NEW.id, NEW."revokedById", 'REVOKED', NEW."revokedAt");
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_certificate AFTER INSERT OR UPDATE ON "Certificate" FOR EACH ROW EXECUTE FUNCTION audit_certificate();

CREATE FUNCTION prevent_history_truncate() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  RAISE EXCEPTION 'Certificate and audit history cannot be truncated' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER prevent_certificate_truncate BEFORE TRUNCATE ON "Certificate" FOR EACH STATEMENT EXECUTE FUNCTION prevent_history_truncate();
CREATE TRIGGER prevent_audit_truncate BEFORE TRUNCATE ON "AuditEvent" FOR EACH STATEMENT EXECUTE FUNCTION prevent_history_truncate();
