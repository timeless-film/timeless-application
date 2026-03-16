/**
 * One-time migration: tmdb_genres → genres
 * Converts TMDB IDs to internal sequential IDs while preserving data.
 * Run: node --env-file=.env.local scripts/migrate-genres.mjs
 */
import pkg from "pg";
const { Client } = pkg;

const client = new Client(process.env.DATABASE_URL);

async function run() {
  await client.connect();

  // Check current state (handle partial migration)
  const tableCheck = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('tmdb_genres','genres')`
  );
  const tableName = tableCheck.rows[0]?.table_name;
  console.log("Current table:", tableName);

  const colCheck = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName]
  );
  const columns = colCheck.rows.map((r) => r.column_name);
  console.log("Columns:", columns);

  if (tableName === "tmdb_genres") {
    console.log("Step 1: Drop FK constraint...");
    await client.query(
      `ALTER TABLE "film_genres" DROP CONSTRAINT IF EXISTS "film_genres_genre_id_tmdb_genres_id_fk"`
    );

    console.log("Step 2: Rename table...");
    await client.query(`ALTER TABLE "tmdb_genres" RENAME TO "genres"`);

    console.log("Step 3: Add tmdb_id column and populate from id...");
    await client.query(`ALTER TABLE "genres" ADD COLUMN "tmdb_id" integer`);
    await client.query(`UPDATE "genres" SET "tmdb_id" = "id"`);

    console.log("Step 4: Create sequence...");
    await client.query(`CREATE SEQUENCE "genres_id_seq" AS integer`);
    await client.query(
      `SELECT setval('genres_id_seq', (SELECT COALESCE(MAX("id"), 0) + 1 FROM "genres"), false)`
    );

    console.log("Step 5: Add old_id helper column...");
    await client.query(`ALTER TABLE "genres" ADD COLUMN "old_id" integer`);
    await client.query(`UPDATE "genres" SET "old_id" = "id"`);

    console.log("Step 6: Reassign sequential IDs...");
    await client.query(`
      WITH numbered AS (
        SELECT "id" AS current_id, ROW_NUMBER() OVER (ORDER BY "id") AS new_id
        FROM "genres"
      )
      UPDATE "genres" SET "id" = numbered.new_id
      FROM numbered WHERE "genres"."id" = numbered.current_id
    `);
  } else {
    console.log("Table already renamed to 'genres', continuing from step 7...");
    // Drop FK constraint if it exists from old name
    await client.query(
      `ALTER TABLE "film_genres" DROP CONSTRAINT IF EXISTS "film_genres_genre_id_tmdb_genres_id_fk"`
    );
  }

  console.log("Step 7: Drop PK on film_genres, update references, re-add PK...");
  await client.query(
    `ALTER TABLE "film_genres" DROP CONSTRAINT IF EXISTS "film_genres_film_id_genre_id_pk"`
  );
  await client.query(`
    UPDATE "film_genres" SET "genre_id" = g."id"
    FROM "genres" g WHERE "film_genres"."genre_id" = g."old_id"
  `);
  await client.query(
    `ALTER TABLE "film_genres" ADD CONSTRAINT "film_genres_film_id_genre_id_pk" PRIMARY KEY ("film_id", "genre_id")`
  );

  if (columns.includes("old_id")) {
    console.log("Step 8: Drop old_id...");
    await client.query(`ALTER TABLE "genres" DROP COLUMN "old_id"`);
  }

  console.log("Step 9: Reset sequence...");
  // Drop if exists (idempotent)
  await client.query(`DROP SEQUENCE IF EXISTS "genres_id_seq"`);
  await client.query(`CREATE SEQUENCE "genres_id_seq" AS integer`);
  await client.query(
    `SELECT setval('genres_id_seq', (SELECT MAX("id") FROM "genres"), true)`
  );

  console.log("Step 10: Set serial default...");
  await client.query(
    `ALTER TABLE "genres" ALTER COLUMN "id" SET DEFAULT nextval('genres_id_seq')`
  );
  await client.query(
    `ALTER SEQUENCE "genres_id_seq" OWNED BY "genres"."id"`
  );

  console.log("Step 11: Create unique index on tmdb_id...");
  await client.query(`DROP INDEX IF EXISTS "genres_tmdb_id_idx"`);
  await client.query(
    `CREATE UNIQUE INDEX "genres_tmdb_id_idx" ON "genres" USING btree ("tmdb_id")`
  );

  console.log("Step 12: Re-add FK constraint...");
  await client.query(
    `ALTER TABLE "film_genres" DROP CONSTRAINT IF EXISTS "film_genres_genre_id_genres_id_fk"`
  );
  await client.query(
    `ALTER TABLE "film_genres" ADD CONSTRAINT "film_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action`
  );

  // Verify
  const res = await client.query(
    `SELECT id, tmdb_id, name_en FROM genres ORDER BY id LIMIT 5`
  );
  console.log("\nVerification (first 5 genres):", res.rows);

  const fgRes = await client.query(
    `SELECT fg.film_id, fg.genre_id, g.name_en FROM film_genres fg JOIN genres g ON fg.genre_id = g.id LIMIT 5`
  );
  console.log("Film genres (first 5):", fgRes.rows);

  const countRes = await client.query(`SELECT COUNT(*) as total FROM genres`);
  console.log("Total genres:", countRes.rows[0].total);

  await client.end();
  console.log("\n✅ Migration complete!");
}

run().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
