/**
 * LLM proxy endpoint.
 *
 * Receives client-constructed prompts and forwards them to Claude API.
 * The server is a passthrough — it does NOT log, store, or inspect prompt contents.
 * It only adds the system prompt (health education constraints, disclaimers).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";

/** Read lazily so dotenv has time to load the .env file */
function getAnthropicApiKey() {
  return process.env.ANTHROPIC_API_KEY;
}

const HEALTH_SYSTEM_PROMPT = `You are a helpful health education assistant. You help users understand their health data, trends, and metrics.

IMPORTANT CONSTRAINTS:
- You provide health education and data interpretation only — never medical diagnosis
- Never suggest specific medications, treatments, or dosages
- Always encourage consulting a healthcare professional for medical concerns
- Only interpret the data provided to you — never ask for additional personal health information
- Present information in a clear, accessible way that empowers the user
- If asked about symptoms or conditions beyond the data provided, recommend professional consultation
- Be transparent about the limitations of AI health interpretation

DISCLAIMER: Always end your response with a brief reminder that this is educational information, not medical advice.`;

const querySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        // ~8 k tokens per message — prevents runaway Anthropic costs
        content: z.string().max(32_000),
      }),
    )
    // Keep conversation history bounded
    .max(50),
  // Client-computed health summary — cap at ~2 k tokens
  healthContext: z.string().max(8_000).optional(),
  enhanced: z.boolean().optional(),
});

export async function llmRoutes(app: FastifyInstance) {
  app.post<{ Body: z.infer<typeof querySchema> }>(
    "/llm/query",
    {
      preHandler: [requireAuth],
      // Rate-limit per authenticated user (not per IP) so that users behind
      // NAT or a shared IP don't interfere with each other, and so that a
      // single user can't circumvent the limit by rotating IPs.
      // requireAuth runs first so session is always populated here.
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
          keyGenerator: (req) => {
            const session = (req as unknown as { session?: { user?: { id?: string } } }).session;
            return session?.user?.id ?? req.ip;
          },
          errorResponseBuilder: (_req: unknown, context: { after: string }) => ({
            type: "https://httpstatuses.com/429",
            title: "Rate limit exceeded",
            status: 429,
            detail: `Too many requests. Please wait ${context.after} before trying again.`,
          }),
        },
      },
    },
    async (request, reply) => {
      const apiKey = getAnthropicApiKey();
      if (!apiKey) {
        return reply.status(503).send({
          type: "https://httpstatuses.com/503",
          title: "LLM service unavailable",
          status: 503,
          detail: "ANTHROPIC_API_KEY is not configured",
        });
      }

      // Parse and validate body
      const parseResult = querySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Invalid request",
          status: 400,
          detail: parseResult.error.message,
        });
      }

      const { messages, healthContext } = parseResult.data;

      // Build system prompt with optional health context
      let systemPrompt = HEALTH_SYSTEM_PROMPT;
      if (healthContext) {
        systemPrompt += `\n\nThe user's anonymized health data summary:\n${healthContext}`;
      }

      // Forward to Claude API with streaming
      const client = new Anthropic({ apiKey: apiKey });

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      try {
        const stream = client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            reply.raw.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
          }
        }

        reply.raw.write("data: [DONE]\n\n");
      } catch (error) {
        // Log the full error server-side; send a generic message to the client
        // so internal Anthropic SDK details (model name, request IDs, etc.) are not exposed.
        request.log.error(error, "LLM stream error");
        reply.raw.write(`data: ${JSON.stringify({ error: "An error occurred processing your request." })}\n\n`);
      }

      reply.raw.end();
    },
  );
}
