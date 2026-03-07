CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('exhibitor', 'rights_holder', 'admin');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."film_status" AS ENUM('active', 'inactive', 'retired');--> statement-breakpoint
CREATE TYPE "public"."film_type" AS ENUM('direct', 'validation');--> statement-breakpoint
CREATE TYPE "public"."tmdb_match_status" AS ENUM('matched', 'pending', 'no_match', 'manual');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('pending', 'in_progress', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('paid', 'processing', 'delivered', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'validated', 'refused', 'expired', 'paid');--> statement-breakpoint
CREATE TABLE "better_auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "better_auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "better_auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "better_auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"two_factor_enabled" boolean,
	"two_factor_secret" text,
	"two_factor_backup_codes" text,
	CONSTRAINT "better_auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "better_auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "account_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "account_type" NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"company_name" text NOT NULL,
	"country" text NOT NULL,
	"address" text,
	"city" text,
	"postal_code" text,
	"vat_number" text,
	"vat_validated" boolean DEFAULT false,
	"stripe_customer_id" text,
	"stripe_connect_account_id" text,
	"stripe_connect_onboarding_complete" boolean DEFAULT false,
	"preferred_currency" text DEFAULT 'EUR',
	"commission_rate" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"invited_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "cinemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"postal_code" text,
	"country" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cinema_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "film_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" uuid NOT NULL,
	"countries" text[] NOT NULL,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "films" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"status" "film_status" DEFAULT 'active' NOT NULL,
	"type" "film_type" DEFAULT 'direct' NOT NULL,
	"tmdb_id" integer,
	"tmdb_match_status" "tmdb_match_status" DEFAULT 'pending',
	"tmdb_data" jsonb,
	"synopsis" text,
	"synopsis_en" text,
	"duration" integer,
	"release_year" integer,
	"genres" text[],
	"directors" text[],
	"cast" text[],
	"countries" text[],
	"poster_url" text,
	"backdrop_url" text,
	"tmdb_rating" text,
	"import_source" text DEFAULT 'manual',
	"import_batch_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exhibitor_account_id" uuid NOT NULL,
	"film_id" uuid NOT NULL,
	"cinema_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"screening_count" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"film_id" uuid NOT NULL,
	"cinema_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"rights_holder_account_id" uuid NOT NULL,
	"screening_count" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"catalog_price" integer NOT NULL,
	"platform_margin_rate" text NOT NULL,
	"delivery_fees" integer NOT NULL,
	"commission_rate" text NOT NULL,
	"displayed_price" integer NOT NULL,
	"rights_holder_amount" integer NOT NULL,
	"timeless_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"stripe_transfer_id" text,
	"delivery_status" "delivery_status" DEFAULT 'pending' NOT NULL,
	"delivery_notes" text,
	"delivered_at" timestamp,
	"request_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exhibitor_account_id" uuid NOT NULL,
	"status" "order_status" DEFAULT 'paid' NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"stripe_invoice_id" text,
	"subtotal" integer NOT NULL,
	"tax_amount" integer NOT NULL,
	"total" integer NOT NULL,
	"currency" text NOT NULL,
	"tax_rate" text,
	"vat_number" text,
	"reverse_charge" text,
	"paid_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exhibitor_account_id" uuid NOT NULL,
	"rights_holder_account_id" uuid NOT NULL,
	"film_id" uuid NOT NULL,
	"cinema_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"screening_count" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"catalog_price" integer NOT NULL,
	"currency" text NOT NULL,
	"platform_margin_rate" text NOT NULL,
	"delivery_fees" integer NOT NULL,
	"commission_rate" text NOT NULL,
	"displayed_price" integer NOT NULL,
	"rights_holder_amount" integer NOT NULL,
	"timeless_amount" integer NOT NULL,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"validation_token" text,
	"refusal_reason" text,
	"validated_at" timestamp,
	"refused_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"stripe_payment_link_id" text,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"performed_by_id" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"platform_margin_rate" text DEFAULT '0.20' NOT NULL,
	"delivery_fees" integer DEFAULT 5000 NOT NULL,
	"default_commission_rate" text DEFAULT '0.10' NOT NULL,
	"ops_email" text DEFAULT 'ops@timeless.film' NOT NULL,
	"request_expiration_days" integer DEFAULT 30 NOT NULL,
	"request_urgency_days_before_start" integer DEFAULT 7 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_id" text
);
--> statement-breakpoint
CREATE TABLE "platform_settings_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text NOT NULL,
	"changed_by_id" text NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "better_auth_accounts" ADD CONSTRAINT "better_auth_accounts_user_id_better_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "better_auth_sessions" ADD CONSTRAINT "better_auth_sessions_user_id_better_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_user_id_better_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."better_auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_better_auth_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."better_auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinemas" ADD CONSTRAINT "cinemas_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_cinema_id_cinemas_id_fk" FOREIGN KEY ("cinema_id") REFERENCES "public"."cinemas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_prices" ADD CONSTRAINT "film_prices_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "films" ADD CONSTRAINT "films_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_exhibitor_account_id_accounts_id_fk" FOREIGN KEY ("exhibitor_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cinema_id_cinemas_id_fk" FOREIGN KEY ("cinema_id") REFERENCES "public"."cinemas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_cinema_id_cinemas_id_fk" FOREIGN KEY ("cinema_id") REFERENCES "public"."cinemas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_rights_holder_account_id_accounts_id_fk" FOREIGN KEY ("rights_holder_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_exhibitor_account_id_accounts_id_fk" FOREIGN KEY ("exhibitor_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_exhibitor_account_id_accounts_id_fk" FOREIGN KEY ("exhibitor_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_rights_holder_account_id_accounts_id_fk" FOREIGN KEY ("rights_holder_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_cinema_id_cinemas_id_fk" FOREIGN KEY ("cinema_id") REFERENCES "public"."cinemas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;