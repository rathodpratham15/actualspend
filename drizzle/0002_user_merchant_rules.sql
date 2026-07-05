CREATE TABLE IF NOT EXISTS "user_merchant_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "raw_pattern" text NOT NULL,
  "destination" text NOT NULL,
  "channel" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "umr_user_pattern_uq"
  ON "user_merchant_rules" ("user_id", "raw_pattern");
