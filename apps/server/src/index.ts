import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { createDb, runMigrations, user } from "@health-app/db";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { llmRoutes } from "./routes/llm.js";
import { preferencesRoutes } from "./routes/preferences.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

/**
 * Idempotently ensures the admin user exists in the database.
 *
 * Better Auth treats emails it has never seen before as new users and
 * redirects them to the new-user onboarding flow after magic-link
 * verification. By pre-inserting the admin row with emailVerified=true
 * the admin always lands on their intended callbackURL (/admin) instead.
 *
 * The insert uses ON CONFLICT DO NOTHING so re-running on every startup is
 * safe — an existing account (with its real name, preferences, etc.) is
 * never overwritten.
 */
async function seedAdminUser(connectionString: string, email: string): Promise<void> {
  const db = createDb(connectionString);
  const rows = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: "Admin",
      email,
      emailVerified: true,
    })
    .onConflictDoNothing()
    .returning({ id: user.id });

  const inserted = rows.length > 0;
  console.log(
    inserted
      ? `Admin user created for ${email}.`
      : `Admin user already exists for ${email} — no changes made.`,
  );
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Run migrations before starting the server so the schema is always up to
  // date regardless of how the container was deployed. Drizzle's migrate()
  // is idempotent — already-applied migrations are skipped.
  console.log("Running database migrations…");
  await runMigrations(dbUrl);
  console.log("Migrations complete.");

  // Pre-seed the admin user so the ADMIN_EMAIL address is always a known
  // existing user. This prevents Better Auth from treating the admin as a
  // brand-new user and sending them through the new-user onboarding flow
  // instead of straight back to /admin after magic-link verification.
  // The insert is idempotent — if the row already exists it is left unchanged.
  if (process.env.ADMIN_EMAIL) {
    await seedAdminUser(dbUrl, process.env.ADMIN_EMAIL.trim().toLowerCase());
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
    // Trust X-Forwarded-* headers from the upstream reverse proxy (e.g. nginx-proxy-manager).
    // Enabled via TRUST_PROXY=true in docker-compose.npm.yml; keep false in local dev.
    trustProxy: process.env.TRUST_PROXY === "true",
  });

  // Plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Health Dashboard API",
        description: "Thin server for auth, preferences, and LLM proxy. No health data.",
        version: "0.1.0",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });

  // Routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(preferencesRoutes, { prefix: "/api" });
  await app.register(llmRoutes, { prefix: "/api" });
  await app.register(adminRoutes, { prefix: "/api" });

  // Error handler — RFC 9457 Problem Details
  app.setErrorHandler((error: { statusCode?: number; message: string }, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const isServerError = statusCode >= 500;

    // Never expose internal error details to the client for 5xx responses —
    // the full error is logged server-side by Fastify automatically.
    if (isServerError) {
      request.log.error(error);
    }

    reply.status(statusCode).send({
      type: `https://httpstatuses.com/${statusCode}`,
      title: isServerError ? "Internal Server Error" : error.message,
      status: statusCode,
      detail: isServerError ? "An unexpected error occurred." : error.message,
    });
  });

  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Server running at http://${HOST}:${PORT}`);
  app.log.info(`API docs at http://${HOST}:${PORT}/docs`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
