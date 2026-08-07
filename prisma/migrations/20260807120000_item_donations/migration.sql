CREATE TYPE "ItemDonationCategory" AS ENUM ('GOLD', 'SILVER', 'JEWELLERY', 'OTHER');

CREATE TYPE "ItemDonationWeightUnit" AS ENUM ('GRAM', 'TOLA', 'KG');

CREATE TABLE "item_donations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mandal_id" UUID NOT NULL,
    "festival_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "donor_name" TEXT NOT NULL,
    "donor_phone" TEXT,
    "donor_address" TEXT,
    "donation_date" DATE NOT NULL,
    "category" "ItemDonationCategory" NOT NULL,
    "item_name" TEXT NOT NULL,
    "weight" DECIMAL(14,3),
    "weight_unit" "ItemDonationWeightUnit",
    "purity" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "storage_location" TEXT,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "item_donations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_donations_mandal_id_festival_id_receipt_number_key" ON "item_donations"("mandal_id", "festival_id", "receipt_number");
CREATE INDEX "item_donations_mandal_id_festival_id_donation_date_idx" ON "item_donations"("mandal_id", "festival_id", "donation_date");
CREATE INDEX "item_donations_mandal_id_festival_id_category_donation_date_idx" ON "item_donations"("mandal_id", "festival_id", "category", "donation_date");
CREATE INDEX "item_donations_mandal_id_festival_id_created_at_idx" ON "item_donations"("mandal_id", "festival_id", "created_at");

ALTER TABLE "item_donations" ADD CONSTRAINT "item_donations_mandal_id_fkey" FOREIGN KEY ("mandal_id") REFERENCES "mandals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "item_donations" ADD CONSTRAINT "item_donations_festival_id_fkey" FOREIGN KEY ("festival_id") REFERENCES "festivals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_donations" ADD CONSTRAINT "item_donations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "item_donations" ADD CONSTRAINT "item_donations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
