import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { llmRoutes } from "./routes/llm.js";
import { preferencesRoutes } from "./routes/preferences.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
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

  // Error handler — RFC 9457 Problem Details
  app.setErrorHandler((error: { statusCode?: number; message: string }, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      type: `https://httpstatuses.com/${statusCode}`,
      title: error.message,
      status: statusCode,
      detail: error.message,
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
