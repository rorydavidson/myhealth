import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

/**
 * Runs all pending Drizzle migrations against the given database.
 *
 * Uses a dedicated single-connection client so migrations execute sequentially
 * and the connection is cleanly closed afterwards. Call this once at server
 * startup before registering routes or accepting traffic.
 *
 * In the Docker image the SQL files live at packages/db/migrations/ (copied
 * there by the Dockerfile from src/migrations/). In compiled local builds they
 * resolve to the same sibling path relative to dist/.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  // __dirname is packages/db/dist/ at runtime; migrations/ is the sibling dir.
  const migrationsFolder = resolve(__dirname, "../migrations");
  await migrate(db, { migrationsFolder });
  await client.end();
}

export type Database = ReturnType<typeof createDb>;

export * from "./schema/index.js";
