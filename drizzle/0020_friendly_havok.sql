CREATE TYPE "public"."film_person_role" AS ENUM('director', 'actor', 'producer', 'executive_producer', 'composer', 'cinematographer', 'screenplay');--> statement-breakpoint
CREATE TABLE "film_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" uuid NOT NULL,
	"tmdb_company_id" integer,
	"name" text NOT NULL,
	"logo_url" text,
	"origin_country" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "film_genres" (
	"film_id" uuid NOT NULL,
	"genre_id" integer NOT NULL,
	CONSTRAINT "film_genres_film_id_genre_id_pk" PRIMARY KEY("film_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "film_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"film_id" uuid NOT NULL,
	"tmdb_person_id" integer,
	"name" text NOT NULL,
	"role" "film_person_role" NOT NULL,
	"character" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"profile_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tmdb_genres" (
	"id" integer PRIMARY KEY NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "films" ADD COLUMN "tagline_en" text;--> statement-breakpoint
ALTER TABLE "film_companies" ADD CONSTRAINT "film_companies_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_genres" ADD CONSTRAINT "film_genres_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_genres" ADD CONSTRAINT "film_genres_genre_id_tmdb_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."tmdb_genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "film_people" ADD CONSTRAINT "film_people_film_id_films_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."films"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "film_companies_film_id_idx" ON "film_companies" USING btree ("film_id");--> statement-breakpoint
CREATE INDEX "film_companies_name_idx" ON "film_companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "film_genres_film_id_idx" ON "film_genres" USING btree ("film_id");--> statement-breakpoint
CREATE INDEX "film_genres_genre_id_idx" ON "film_genres" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "film_people_film_id_idx" ON "film_people" USING btree ("film_id");--> statement-breakpoint
CREATE INDEX "film_people_role_idx" ON "film_people" USING btree ("film_id","role");--> statement-breakpoint
CREATE INDEX "film_people_name_idx" ON "film_people" USING btree ("name");