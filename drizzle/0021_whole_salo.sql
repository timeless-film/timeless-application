-- Step 1: Drop FK constraint from film_genres → tmdb_genres
ALTER TABLE "film_genres" DROP CONSTRAINT "film_genres_genre_id_tmdb_genres_id_fk";
--> statement-breakpoint

-- Step 2: Rename table tmdb_genres → genres
ALTER TABLE "tmdb_genres" RENAME TO "genres";
--> statement-breakpoint

-- Step 3: Add tmdb_id column, populate from current id (which holds TMDB IDs)
ALTER TABLE "genres" ADD COLUMN "tmdb_id" integer;
--> statement-breakpoint
UPDATE "genres" SET "tmdb_id" = "id";
--> statement-breakpoint

-- Step 4: Create new serial sequence for the id column
CREATE SEQUENCE "genres_id_seq" AS integer;
--> statement-breakpoint
SELECT setval('genres_id_seq', (SELECT COALESCE(MAX("id"), 0) + 1 FROM "genres"), false);
--> statement-breakpoint

-- Step 5: Create a temporary mapping column for the old→new ID conversion
ALTER TABLE "genres" ADD COLUMN "old_id" integer;
--> statement-breakpoint
UPDATE "genres" SET "old_id" = "id";
--> statement-breakpoint

-- Step 6: Reassign sequential IDs
WITH numbered AS (
  SELECT "id" AS current_id, ROW_NUMBER() OVER (ORDER BY "id") AS new_id
  FROM "genres"
)
UPDATE "genres" SET "id" = numbered.new_id
FROM numbered WHERE "genres"."id" = numbered.current_id;
--> statement-breakpoint

-- Step 7: Update film_genres references from old TMDB IDs to new sequential IDs
UPDATE "film_genres" SET "genre_id" = g."id"
FROM "genres" g WHERE "film_genres"."genre_id" = g."old_id";
--> statement-breakpoint

-- Step 8: Drop old_id helper column
ALTER TABLE "genres" DROP COLUMN "old_id";
--> statement-breakpoint

-- Step 9: Reset sequence to match new max id
SELECT setval('genres_id_seq', (SELECT MAX("id") FROM "genres"), true);
--> statement-breakpoint

-- Step 10: Change id column to use the serial sequence
ALTER TABLE "genres" ALTER COLUMN "id" SET DEFAULT nextval('genres_id_seq');
--> statement-breakpoint
ALTER SEQUENCE "genres_id_seq" OWNED BY "genres"."id";
--> statement-breakpoint

-- Step 11: Create unique index on tmdb_id
CREATE UNIQUE INDEX "genres_tmdb_id_idx" ON "genres" USING btree ("tmdb_id");
--> statement-breakpoint

-- Step 12: Re-add FK constraint film_genres → genres
ALTER TABLE "film_genres" ADD CONSTRAINT "film_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;