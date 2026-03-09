import type { FastifyPluginAsync } from "fastify";
import { auth } from "../auth.js";
import { verifyTurnstile } from "../middleware/turnstile.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.all(
    "/api/auth/*",
    {
      // Auth endpoints are the most sensitive targets for bots:
      // - magic-link send: spammers can enumerate users / burn email credits
      // - Tighter limit than the global 100/min — 10 requests per minute per IP
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
          errorResponseBuilder: (_req: unknown, context: { after: string }) => ({
            type: "https://httpstatuses.com/429",
            title: "Too Many Requests",
            status: 429,
            detail: `Too many auth attempts. Retry after ${context.after}.`,
          }),
        },
      },
      // Verify Cloudflare Turnstile challenge for bot-sensitive sub-paths.
      // No-ops when TURNSTILE_SECRET_KEY is unset (local dev).
      preHandler: [verifyTurnstile],
    },
    async (request, reply) => {
      const url = new URL(request.url, `http://${request.hostname}`);

      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            for (const v of value) {
              headers.append(key, v);
            }
          } else {
            headers.set(key, value);
          }
        }
      }

      const body =
        request.method !== "GET" && request.method !== "HEAD"
          ? JSON.stringify(request.body)
          : undefined;

      const fetchRequest = new Request(url.toString(), {
        method: request.method,
        headers,
        body,
      });

      const response = await auth.handler(fetchRequest);

      // Copy response status
      reply.status(response.status);

      // Copy response headers
      for (const [key, value] of response.headers.entries()) {
        reply.header(key, value);
      }

      // Send response body
      const text = await response.text();
      return reply.send(text);
    },
  );
};
