/**
 * Whoop OAuth + API proxy.
 *
 * Whoop's API sends no CORS headers, so the browser cannot call its token or
 * data endpoints directly. These routes act as a thin passthrough: the server
 * performs the OAuth token exchange / refresh (which need the per-user client
 * secret) and relays data requests. Whoop health data transits server memory
 * but is never logged or persisted — it lands in the browser's IndexedDB.
 *
 * Only the user's own Whoop developer-app credentials are stored server-side
 * (client secret encrypted at rest), so token refresh works across sessions.
 */

import { createDb, whoopCredentials } from "@health-app/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { requireAuth } from "../middleware/auth.js";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://health:health@localhost:5432/health";
const db = createDb(DATABASE_URL);

const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";

/** Whoop data paths the proxy is allowed to forward. Keeps the proxy from
 *  being used as an open relay to arbitrary Whoop endpoints. */
const ALLOWED_PROXY_PATHS = new Set([
  "/recovery",
  "/sleep",
  "/workout",
  "/cycle",
  "/body_measurement",
]);

function getUserId(request: unknown): string {
  return (request as { session: { user: { id: string } } }).session.user.id;
}

interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

const credentialsSchema = z.object({
  clientId: z.string().min(1).max(200),
  clientSecret: z.string().min(1).max(400).optional(),
});

const tokenSchema = z.object({
  code: z.string().min(1).max(2000),
  codeVerifier: z.string().min(1).max(200),
  redirectUri: z.string().url().max(500),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(2000),
});

/** Per-user limiter for the auth endpoints (token exchange / refresh). */
const authRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: "1 minute",
      keyGenerator: (req: unknown) =>
        (req as { session?: { user?: { id?: string } }; ip: string }).session?.user?.id ??
        (req as { ip: string }).ip,
    },
  },
};

/** Higher limit for the data proxy — a full sync makes many paged calls. */
const proxyRateLimit = {
  config: {
    rateLimit: {
      max: 200,
      timeWindow: "1 minute",
      keyGenerator: (req: unknown) =>
        (req as { session?: { user?: { id?: string } }; ip: string }).session?.user?.id ??
        (req as { ip: string }).ip,
    },
  },
};

export async function whoopRoutes(app: FastifyInstance) {
  // Store (or update) the user's Whoop app credentials before the OAuth
  // redirect. The secret is encrypted at rest; it never goes back to the client.
  app.post("/whoop/credentials", {
    preHandler: [requireAuth],
    ...authRateLimit,
    handler: async (request, reply) => {
      const parsed = credentialsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Invalid credentials payload",
          status: 400,
          detail: parsed.error.message,
        });
      }
      const userId = getUserId(request);
      const { clientId, clientSecret } = parsed.data;
      const secretEnc = clientSecret ? encryptSecret(clientSecret) : null;

      await db
        .insert(whoopCredentials)
        .values({ userId, clientId, clientSecretEncrypted: secretEnc })
        .onConflictDoUpdate({
          target: whoopCredentials.userId,
          set: { clientId, clientSecretEncrypted: secretEnc, updatedAt: new Date() },
        });

      return reply.status(204).send();
    },
  });

  // Exchange the authorization code for tokens using the stored credentials.
  app.post("/whoop/token", {
    preHandler: [requireAuth],
    ...authRateLimit,
    handler: async (request, reply) => {
      const parsed = tokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Invalid token request",
          status: 400,
          detail: parsed.error.message,
        });
      }
      const userId = getUserId(request);
      const creds = await loadCredentials(userId);
      if (!creds) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Whoop not configured",
          status: 400,
          detail: "No stored Whoop credentials for this user",
        });
      }

      const { code, codeVerifier, redirectUri } = parsed.data;
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: creds.clientId,
        code_verifier: codeVerifier,
      });
      if (creds.clientSecret) body.set("client_secret", creds.clientSecret);

      const tokens = await exchangeWithWhoop(body);
      if (!tokens) {
        return reply.status(502).send({
          type: "https://httpstatuses.com/502",
          title: "Token exchange failed",
          status: 502,
          detail: "Whoop rejected the authorization code",
        });
      }
      return tokens;
    },
  });

  // Refresh an access token using the stored credentials.
  app.post("/whoop/refresh", {
    preHandler: [requireAuth],
    ...authRateLimit,
    handler: async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Invalid refresh request",
          status: 400,
          detail: parsed.error.message,
        });
      }
      const userId = getUserId(request);
      const creds = await loadCredentials(userId);
      if (!creds) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Whoop not configured",
          status: 400,
          detail: "No stored Whoop credentials for this user",
        });
      }

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: parsed.data.refreshToken,
        client_id: creds.clientId,
      });
      if (creds.clientSecret) body.set("client_secret", creds.clientSecret);

      const tokens = await exchangeWithWhoop(body);
      if (!tokens) {
        return reply.status(401).send({
          type: "https://httpstatuses.com/401",
          title: "Token refresh failed",
          status: 401,
          detail: "Whoop rejected the refresh token — reconnect required",
        });
      }
      return tokens;
    },
  });

  // Relay a GET to an allowlisted Whoop data endpoint. The Whoop access token
  // is supplied by the client per request via X-Whoop-Token and forwarded as a
  // Bearer token. The server does not store or log it.
  app.get("/whoop/proxy", {
    preHandler: [requireAuth],
    ...proxyRateLimit,
    handler: async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const path = query.path ?? "";
      if (!ALLOWED_PROXY_PATHS.has(path)) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Disallowed Whoop path",
          status: 400,
          detail: `Path not permitted: ${path}`,
        });
      }
      const whoopToken = request.headers["x-whoop-token"];
      if (typeof whoopToken !== "string" || whoopToken.length === 0) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Missing Whoop token",
          status: 400,
          detail: "X-Whoop-Token header is required",
        });
      }

      const url = new URL(`${WHOOP_API_BASE}${path}`);
      for (const [key, value] of Object.entries(query)) {
        if (key !== "path" && typeof value === "string") {
          url.searchParams.set(key, value);
        }
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${whoopToken}` },
      });
      const text = await res.text();
      reply
        .status(res.status)
        .header("content-type", res.headers.get("content-type") ?? "application/json")
        .send(text);
    },
  });

  // Forget the user's Whoop credentials (on disconnect).
  app.delete("/whoop/credentials", {
    preHandler: [requireAuth],
    ...authRateLimit,
    handler: async (request, reply) => {
      const userId = getUserId(request);
      await db.delete(whoopCredentials).where(eq(whoopCredentials.userId, userId));
      return reply.status(204).send();
    },
  });
}

async function loadCredentials(
  userId: string,
): Promise<{ clientId: string; clientSecret: string | null } | null> {
  const [row] = await db
    .select()
    .from(whoopCredentials)
    .where(eq(whoopCredentials.userId, userId))
    .limit(1);
  if (!row) return null;
  return {
    clientId: row.clientId,
    clientSecret: row.clientSecretEncrypted ? decryptSecret(row.clientSecretEncrypted) : null,
  };
}

async function exchangeWithWhoop(body: URLSearchParams): Promise<WhoopTokenResponse | null> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as WhoopTokenResponse;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
  };
}
