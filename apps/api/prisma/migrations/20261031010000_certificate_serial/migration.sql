BEGIN;
-- A volatile database default assigns each existing row a distinct serial without
-- updating certificate history or triggering final-revocation protection.
ALTER TABLE "Certificate" ADD COLUMN "serialNumber" TEXT NOT NULL
  DEFAULT ('CERT-' || upper(replace(gen_random_uuid()::text, '-', '')));
ALTER TABLE "Certificate" ADD CONSTRAINT certificate_serial_format
  CHECK ("serialNumber" ~ '^CERT-[0-9A-F]{32}$');
CREATE UNIQUE INDEX "Certificate_serialNumber_key" ON "Certificate"("serialNumber");
CREATE FUNCTION protect_certificate_serial() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW."serialNumber" IS DISTINCT FROM OLD."serialNumber" THEN
    RAISE EXCEPTION 'Certificate serial number is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_certificate_serial BEFORE UPDATE ON "Certificate"
  FOR EACH ROW EXECUTE FUNCTION protect_certificate_serial();
COMMIT;
