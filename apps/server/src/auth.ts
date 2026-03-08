import { createDb } from "@health-app/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://health:health@localhost:5432/health";

const db = createDb(DATABASE_URL);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (resend) {
          await resend.emails.send({
            from: process.env.RESEND_FROM ?? "Health Dashboard <noreply@resend.dev>",
            to: email,
            subject: "Sign in to Health Dashboard",
            html: `<p>Click the link below to sign in to your Health Dashboard.</p><p><a href="${url}">Sign in</a></p><p>Or copy this link:<br>${url}</p><p>This link expires in 5 minutes.</p>`,
          });
        } else {
          // Dev mode: log to console so you can click without a real email service
          console.log(`\n🔗  Magic link for ${email}:\n    ${url}\n`);
        }
      },
      expiresIn: 300, // 5 minutes
    }),
  ],
  trustedOrigins: [
    process.env.CORS_ORIGIN ?? "http://localhost:5173",
    // Native iOS client — URLSession sends this custom scheme as the Origin header
    // so Better Auth's CSRF check passes for mobile requests.
    "healthdashboard://app",
  ],
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
});

export type Auth = typeof auth;
