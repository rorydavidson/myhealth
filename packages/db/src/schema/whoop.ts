import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./users.js";

/**
 * Per-user Whoop developer-app credentials.
 *
 * Each user registers their own Whoop developer app and brings their own
 * clientId/clientSecret. The secret is stored encrypted (AES-256-GCM) so the
 * server can perform the OAuth token exchange and token refreshes that Whoop's
 * API requires server-side (no CORS for browsers).
 *
 * This holds OAuth app credentials only — never Whoop health records, which
 * remain client-side in IndexedDB per the app's privacy architecture.
 */
export const whoopCredentials = pgTable("whoop_credentials", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  // Null for public PKCE apps that have no secret. Format: iv:tag:ciphertext (base64).
  clientSecretEncrypted: text("client_secret_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
