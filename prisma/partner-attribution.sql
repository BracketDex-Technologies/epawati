CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  phone text UNIQUE,
  address text,
  status "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partners_status_created_at_idx
  ON partners (status, created_at);

ALTER TABLE mandals
  ADD COLUMN IF NOT EXISTS partner_id uuid;

CREATE INDEX IF NOT EXISTS mandals_partner_id_idx
  ON mandals (partner_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'mandals_partner_id_fkey'
  ) THEN
    ALTER TABLE mandals
      ADD CONSTRAINT mandals_partner_id_fkey
      FOREIGN KEY (partner_id)
      REFERENCES partners(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
