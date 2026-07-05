CREATE TABLE "ai_category_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"canonical_category" text NOT NULL,
	"provider" text DEFAULT 'anthropic' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
