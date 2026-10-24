ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "saml_name_id" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "saml_idp" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "scim_external_id" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "scim_active" boolean DEFAULT true NOT NULL;
