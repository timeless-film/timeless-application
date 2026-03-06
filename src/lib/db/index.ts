import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// For migrations and one-shot operations
const migrationClient = postgres(connectionString, { max: 1 });

// For application queries (connection pool)
const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });
export const migrationDb = drizzle(migrationClient, { schema });
