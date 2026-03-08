import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./users.js";

export const userPreferences = pgTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  units: text("units").notNull().default("metric"), // "metric" | "imperial"
  timezone: text("timezone").notNull().default("UTC"),
  language: text("language").notNull().default("en"), // "en" | "fr"
  theme: text("theme").notNull().default("system"), // "light" | "dark" | "system"
  extra: jsonb("extra"), // Future extensibility
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
