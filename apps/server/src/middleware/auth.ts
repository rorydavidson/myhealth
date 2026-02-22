import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../auth.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: request.headers as unknown as Headers,
  });

  if (!session) {
    reply.status(401).send({
      type: "https://httpstatuses.com/401",
      title: "Unauthorized",
      status: 401,
      detail: "Authentication required",
    });
    return;
  }

  // Attach session to request for downstream handlers
  (request as FastifyRequest & { session: typeof session }).session = session;
}
