CREATE TABLE "society_registrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "society_name" text NOT NULL,
  "society_address" text NOT NULL,
  "chairman_name" text,
  "secretary_name" text,
  "chairman_mobile" text NOT NULL,
  "secretary_mobile" text,
  "number_of_flats" integer NOT NULL,
  "email" text,
  "template_available" boolean NOT NULL DEFAULT false,
  "template_file_name" text,
  "template_mime_type" text,
  "template_data_url" text,
  "registration_source" text NOT NULL DEFAULT 'public_society_registration',
  "created_at" timestamptz(6) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(6) NOT NULL DEFAULT now()
);

CREATE INDEX "society_registrations_created_at_idx" ON "society_registrations" ("created_at");
CREATE INDEX "society_registrations_society_name_idx" ON "society_registrations" ("society_name");
CREATE INDEX "society_registrations_chairman_mobile_idx" ON "society_registrations" ("chairman_mobile");
