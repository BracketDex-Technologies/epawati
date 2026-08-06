-- Apply through the normal Prisma migration workflow after taking a database backup.
-- Trigram indexes keep contains-search responsive as receipt volume grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Idempotency is tenant-scoped: the same client-generated key may safely exist
-- in different mandals without returning or blocking another tenant's receipt.
DROP INDEX IF EXISTS "vargani_slips_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "vargani_slips_mandal_id_festival_id_idempotency_key_key"
  ON "vargani_slips" ("mandal_id", "festival_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "vargani_slips_slip_number_trgm_idx"
  ON "vargani_slips" USING gin ("slip_number" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "vargani_slips_contributor_name_trgm_idx"
  ON "vargani_slips" USING gin ("contributor_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "vargani_slips_shop_name_trgm_idx"
  ON "vargani_slips" USING gin ("shop_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "vargani_slips_area_name_trgm_idx"
  ON "vargani_slips" USING gin ("area_name" gin_trgm_ops);
