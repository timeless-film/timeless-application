import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Pour les migrations et les opérations one-shot
const migrationClient = postgres(connectionString, { max: 1 });

// Pour les requêtes applicatives (pool de connexions)
const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });
export const migrationDb = drizzle(migrationClient, { schema });
