import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema/index.js";

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
 * there by the Dockerfile from src/migrations/). At runtime this file compiles
 * to packages/db/dist/index.js, so "../migrations" resolves correctly via
 * import.meta.url — no node:path or @types/node required.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);
  // new URL("../migrations", import.meta.url).pathname resolves to an absolute
  // path one level above this compiled file — packages/db/migrations/ in prod.
  const migrationsFolder = new URL("../migrations", import.meta.url).pathname;
  await migrate(db, { migrationsFolder });
  await client.end();
}

export type Database = ReturnType<typeof createDb>;

export * from "./schema/index.js";
