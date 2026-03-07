import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// ssl: "require" tells the postgres driver to encrypt the connection but skip
// certificate verification — needed for Scaleway Managed PostgreSQL which uses
// a self-signed certificate.
const sslOptions = process.env.NODE_ENV === "production" ? { ssl: "require" as const } : {};

// For migrations and one-shot operations
const migrationClient = postgres(connectionString, { max: 1, ...sslOptions });

// For application queries (connection pool)
const queryClient = postgres(connectionString, sslOptions);

export const db = drizzle(queryClient, { schema });
export const migrationDb = drizzle(migrationClient, { schema });
