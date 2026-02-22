import { createDb, userPreferences } from "@health-app/db";
import { eq } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../middleware/auth.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://health:health@localhost:5432/health";
const db = createDb(DATABASE_URL);

interface PreferencesBody {
  units?: string;
  timezone?: string;
  language?: string;
  theme?: string;
}

export const preferencesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/preferences", {
    preHandler: requireAuth,
    schema: {
      description: "Get user preferences (requires auth)",
      response: {
        200: {
          type: "object",
          properties: {
            units: { type: "string" },
            timezone: { type: "string" },
            language: { type: "string" },
            theme: { type: "string" },
          },
        },
      },
    },
    handler: async (request) => {
      const session = (request as typeof request & { session: { user: { id: string } } }).session;
      const userId = session.user.id;

      const [prefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (!prefs) {
        return {
          units: "metric",
          timezone: "UTC",
          language: "en",
          theme: "system",
        };
      }

      return {
        units: prefs.units,
        timezone: prefs.timezone,
        language: prefs.language,
        theme: prefs.theme,
      };
    },
  });

  app.put("/preferences", {
    preHandler: requireAuth,
    schema: {
      description: "Update user preferences (requires auth)",
      body: {
        type: "object",
        properties: {
          units: { type: "string", enum: ["metric", "imperial"] },
          timezone: { type: "string" },
          language: { type: "string", enum: ["en", "fr"] },
          theme: { type: "string", enum: ["light", "dark", "system"] },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            units: { type: "string" },
            timezone: { type: "string" },
            language: { type: "string" },
            theme: { type: "string" },
          },
        },
      },
    },
    handler: async (request) => {
      const session = (request as typeof request & { session: { user: { id: string } } }).session;
      const userId = session.user.id;
      const body = request.body as PreferencesBody;

      const [existing] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(userPreferences)
          .set({
            ...(body.units && { units: body.units }),
            ...(body.timezone && { timezone: body.timezone }),
            ...(body.language && { language: body.language }),
            ...(body.theme && { theme: body.theme }),
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.userId, userId))
          .returning();

        return {
          units: updated.units,
          timezone: updated.timezone,
          language: updated.language,
          theme: updated.theme,
        };
      }

      const id = crypto.randomUUID();
      const [created] = await db
        .insert(userPreferences)
        .values({
          id,
          userId,
          units: body.units ?? "metric",
          timezone: body.timezone ?? "UTC",
          language: body.language ?? "en",
          theme: body.theme ?? "system",
        })
        .returning();

      return {
        units: created.units,
        timezone: created.timezone,
        language: created.language,
        theme: created.theme,
      };
    },
  });
};
