import type { FastifyPluginAsync } from "fastify";
import { auth } from "../auth.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.all("/api/auth/*", async (request, reply) => {
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
  });
};
