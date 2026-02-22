import { createDb } from "@health-app/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://health:health@localhost:5432/health";

const db = createDb(DATABASE_URL);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  trustedOrigins: [process.env.CORS_ORIGIN ?? "http://localhost:5173"],
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
});

export type Auth = typeof auth;
