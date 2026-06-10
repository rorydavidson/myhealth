/**
 * FHIR terminology proxy.
 *
 * The public SNOMED CT FHIR server (browser.ihtsdotools.org) sends no CORS
 * headers, so the browser cannot query it directly. This relays read-only
 * GET requests (ValueSet/$expand, CodeSystem/$lookup) to the configured
 * upstream. Only public terminology reference data passes through — no health
 * records, no PII. The upstream is fixed by env, so it can't be used as an
 * open proxy to arbitrary hosts.
 */

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";

// Default to CSIRO Ontoserver's public R4 endpoint. The SNOMED-hosted
// browser.ihtsdotools.org backend denies non-browser clients (302 →
// denied.html?reason=browser), so it cannot be proxied. Override with
// FHIR_TERMINOLOGY_URL to point at your own Snowstorm/Ontoserver.
const UPSTREAM = (
  process.env.FHIR_TERMINOLOGY_URL ?? "https://r4.ontoserver.csiro.au/fhir"
).replace(/\/+$/, "");

const ROUTE_PREFIX = "/api/fhir";

export async function fhirRoutes(app: FastifyInstance) {
  app.get("/fhir/*", {
    preHandler: [requireAuth],
    config: {
      rateLimit: {
        max: 120,
        timeWindow: "1 minute",
        keyGenerator: (req: unknown) =>
          (req as { session?: { user?: { id?: string } }; ip: string }).session?.user?.id ??
          (req as { ip: string }).ip,
      },
    },
    handler: async (request, reply) => {
      // request.url is the full original path+query, e.g.
      // "/api/fhir/ValueSet/$expand?url=...". Strip our prefix and append the
      // remainder (path + query, untouched) to the fixed upstream base.
      const subpath = request.url.slice(ROUTE_PREFIX.length);
      if (!subpath.startsWith("/")) {
        return reply.status(400).send({
          type: "https://httpstatuses.com/400",
          title: "Invalid FHIR path",
          status: 400,
          detail: "Malformed terminology request",
        });
      }

      const res = await fetch(`${UPSTREAM}${subpath}`, {
        headers: { Accept: "application/fhir+json" },
      });
      const body = await res.text();
      reply
        .status(res.status)
        .header("content-type", res.headers.get("content-type") ?? "application/fhir+json")
        .send(body);
    },
  });
}
