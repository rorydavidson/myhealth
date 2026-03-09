/**
 * Cloudflare Turnstile verification middleware.
 *
 * When TURNSTILE_SECRET_KEY is set, this preHandler verifies that the
 * X-Turnstile-Token header contains a valid Turnstile challenge response
 * before allowing the request to proceed.  It is only enforced on the
 * magic-link send endpoint — other auth paths (callback, session, etc.)
 * are left untouched.
 *
 * When TURNSTILE_SECRET_KEY is *not* set (local dev), the check is skipped
 * entirely so development is unaffected.
 */

import type { FastifyReply, FastifyRequest } from "fastify";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface TurnstileOutcome {
  success: boolean;
  "error-codes"?: string[];
}

/** Paths that require a valid Turnstile token. */
const PROTECTED_PATHS = new Set([
  "/api/auth/sign-in/magic-link",
]);

export async function verifyTurnstile(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Feature is opt-in — if the env var is absent (e.g. local dev), skip.
  if (!secretKey) return;

  // Only gate the specific paths that are bot-sensitive.
  const path = new URL(request.url, "http://localhost").pathname;
  if (!PROTECTED_PATHS.has(path)) return;
  if (request.method !== "POST") return;

  const token = request.headers["x-turnstile-token"];

  if (!token || typeof token !== "string") {
    return reply.status(403).send({
      type: "https://httpstatuses.com/403",
      title: "Forbidden",
      status: 403,
      detail: "Missing Turnstile challenge response.",
    });
  }

  let outcome: TurnstileOutcome;

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
        // Forward the client IP when available so Cloudflare can do
        // additional risk scoring.
        remoteip: request.ip,
      }),
    });
    outcome = (await res.json()) as TurnstileOutcome;
  } catch (err) {
    request.log.error(err, "Turnstile verification request failed");
    // Fail open only in the narrow case where our own fetch to Cloudflare
    // errors — don't block legitimate users due to a transient network
    // issue between us and Cloudflare.
    return;
  }

  if (!outcome.success) {
    request.log.warn(
      { errorCodes: outcome["error-codes"], ip: request.ip },
      "Turnstile challenge failed",
    );
    return reply.status(403).send({
      type: "https://httpstatuses.com/403",
      title: "Forbidden",
      status: 403,
      detail: "Turnstile challenge failed. Please try again.",
    });
  }
}
