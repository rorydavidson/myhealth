import { count, desc, eq, gt } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createDb, session as sessionTable, user, userPreferences } from "@health-app/db";
import { auth } from "../auth.js";

// ---------------------------------------------------------------------------
// Admin middleware — checks session validity + ADMIN_EMAIL match
// ---------------------------------------------------------------------------

type AdminRequest = FastifyRequest & {
  adminUser: { id: string; email: string; name: string };
};

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    return reply.status(503).send({
      type: "https://httpstatuses.com/503",
      title: "Service Unavailable",
      status: 503,
      detail: "Admin access is not configured on this server.",
    });
  }

  const authSession = await auth.api.getSession({
    headers: request.headers as unknown as Headers,
  });

  if (!authSession) {
    return reply.status(401).send({
      type: "https://httpstatuses.com/401",
      title: "Unauthorized",
      status: 401,
      detail: "Authentication required.",
    });
  }

  if (authSession.user.email.toLowerCase() !== adminEmail.trim().toLowerCase()) {
    return reply.status(403).send({
      type: "https://httpstatuses.com/403",
      title: "Forbidden",
      status: 403,
      detail: "Admin access required.",
    });
  }

  (request as AdminRequest).adminUser = authSession.user;
}

// ---------------------------------------------------------------------------
// Masking helpers — enough context to verify, not enough to reconstruct
// ---------------------------------------------------------------------------

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function maskName(name: string): string {
  if (!name) return "***";
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => (p.length <= 1 ? p : `${p[0]}${"*".repeat(Math.min(3, p.length - 1))}`))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function adminRoutes(app: FastifyInstance) {
  const db = createDb(process.env.DATABASE_URL!);

  /**
   * GET /api/admin/stats
   * Aggregate metrics: user counts, session counts, verification state.
   */
  app.get("/admin/stats", { preHandler: requireAdmin }, async () => {
    const now = new Date();
    const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [[total], [verified], [new7d], [new30d], [activeSessions], [withPrefs]] =
      await Promise.all([
        db.select({ v: count() }).from(user),
        db.select({ v: count() }).from(user).where(eq(user.emailVerified, true)),
        db.select({ v: count() }).from(user).where(gt(user.createdAt, ago7d)),
        db.select({ v: count() }).from(user).where(gt(user.createdAt, ago30d)),
        db.select({ v: count() }).from(sessionTable).where(gt(sessionTable.expiresAt, now)),
        db.select({ v: count() }).from(userPreferences),
      ]);

    return {
      totalUsers: Number(total.v),
      verifiedUsers: Number(verified.v),
      newUsersLast7Days: Number(new7d.v),
      newUsersLast30Days: Number(new30d.v),
      activeSessions: Number(activeSessions.v),
      usersWithPreferences: Number(withPrefs.v),
    };
  });

  /**
   * GET /api/admin/users
   * All users with masked PII, newest first.
   */
  app.get("/admin/users", { preHandler: requireAdmin }, async () => {
    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt));

    // Active session counts per user
    const sessionCounts = await db
      .select({ userId: sessionTable.userId, n: count() })
      .from(sessionTable)
      .where(gt(sessionTable.expiresAt, new Date()))
      .groupBy(sessionTable.userId);

    const sessionMap = new Map(sessionCounts.map((s) => [s.userId, Number(s.n)]));

    return users.map((u) => ({
      // Short ID safe to display (first 8 hex chars of the internal UUID)
      shortId: u.id.replace(/-/g, "").slice(0, 8),
      // Full ID needed for delete — never displayed in the UI
      id: u.id,
      name: maskName(u.name),
      email: maskEmail(u.email),
      emailVerified: u.emailVerified,
      createdAt: u.createdAt,
      lastSeen: u.updatedAt,
      activeSessions: sessionMap.get(u.id) ?? 0,
    }));
  });

  /**
   * DELETE /api/admin/users/:id
   * Hard-deletes the user. Cascades to sessions, accounts, preferences,
   * and verification records via FK constraints.
   */
  app.delete("/admin/users/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(user).where(eq(user.id, id));
    return reply.status(204).send();
  });
}
