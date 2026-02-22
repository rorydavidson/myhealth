import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", {
    schema: {
      description: "Health check endpoint",
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string" },
          },
        },
      },
    },
    handler: async () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  });
};
