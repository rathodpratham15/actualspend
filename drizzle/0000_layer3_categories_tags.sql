CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"code" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"is_inflow" boolean DEFAULT false NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "plaid_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"access_token" text NOT NULL,
	"institution_id" text,
	"institution_name" text,
	"cursor" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plaid_item_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "reconciliation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"splitwise_expense_id" text,
	"actual_amount" numeric(12, 2) NOT NULL,
	"match_type" text NOT NULL,
	"confidence" numeric(3, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reconciliation_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "splitwise_credential" (
	"user_id" text PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"splitwise_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "splitwise_expense" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"splitwise_expense_id" text NOT NULL,
	"description" text,
	"cost" numeric(12, 2) NOT NULL,
	"currency_code" text DEFAULT 'USD',
	"user_share" numeric(12, 2) NOT NULL,
	"paid_by_user" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"group_id" integer,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "splitwise_expense_splitwise_expense_id_unique" UNIQUE("splitwise_expense_id")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"transaction_id" text,
	"splitwise_expense_id" text,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"confidence" numeric(3, 2),
	"source" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tag_subject_xor" CHECK (("tag"."transaction_id" IS NOT NULL)::int + ("tag"."splitwise_expense_id" IS NOT NULL)::int = 1)
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plaid_item_id" text NOT NULL,
	"plaid_transaction_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"iso_currency_code" text DEFAULT 'USD',
	"date" date NOT NULL,
	"name" text NOT NULL,
	"merchant_name" text,
	"plaid_category" jsonb,
	"canonical_category" text,
	"pending" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_plaid_transaction_id_unique" UNIQUE("plaid_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_item" ADD CONSTRAINT "plaid_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation" ADD CONSTRAINT "reconciliation_splitwise_expense_id_splitwise_expense_id_fk" FOREIGN KEY ("splitwise_expense_id") REFERENCES "public"."splitwise_expense"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splitwise_credential" ADD CONSTRAINT "splitwise_credential_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "splitwise_expense" ADD CONSTRAINT "splitwise_expense_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_splitwise_expense_id_splitwise_expense_id_fk" FOREIGN KEY ("splitwise_expense_id") REFERENCES "public"."splitwise_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_plaid_item_id_plaid_item_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_canonical_category_category_code_fk" FOREIGN KEY ("canonical_category") REFERENCES "public"."category"("code") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rec_user_txn_uq" ON "reconciliation" USING btree ("user_id","transaction_id");--> statement-breakpoint
CREATE INDEX "sw_user_date_idx" ON "splitwise_expense" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "sw_user_cost_idx" ON "splitwise_expense" USING btree ("user_id","cost");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_txn_uq" ON "tag" USING btree ("transaction_id","kind","value") WHERE "tag"."transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tag_swe_uq" ON "tag" USING btree ("splitwise_expense_id","kind","value") WHERE "tag"."splitwise_expense_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tag_user_kind_idx" ON "tag" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "txn_user_date_idx" ON "transaction" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "txn_user_amount_idx" ON "transaction" USING btree ("user_id","amount");