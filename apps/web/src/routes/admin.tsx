/**
 * Admin dashboard — /admin
 *
 * Standalone page (not under the _app authenticated layout). Handles its own
 * auth state:
 *   1. Not logged in → magic-link login form (sends link to whatever email is
 *      entered; access is enforced server-side by ADMIN_EMAIL check).
 *   2. Logged in but not admin → "Access denied" screen.
 *   3. Logged in as admin → stats + user table with delete actions.
 *
 * PII is masked server-side before it ever reaches this page.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { signIn, signOut, useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Stats {
  totalUsers: number;
  verifiedUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  activeSessions: number;
  usersWithPreferences: number;
}

interface AdminUser {
  id: string;
  shortId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  lastSeen: string;
  activeSessions: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchStats(): Promise<Stats> {
  const res = await fetch("/api/admin/stats", { credentials: "include" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<Stats>;
}

async function fetchUsers(): Promise<AdminUser[]> {
  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<AdminUser[]>;
}

async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(String(res.status));
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "blue",
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  accent?: "blue" | "emerald" | "amber" | "violet" | "rose";
}) {
  const colors = {
    blue: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
    emerald: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    amber: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    violet: "text-violet-500 bg-violet-50 dark:bg-violet-950/40",
    rose: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
  } as const;

  return (
    <div className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`rounded-lg p-2.5 ${colors[accent]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
          {value.toLocaleString()}
        </p>
        {sub && <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton UI only
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-3/4 rounded bg-neutral-100 dark:bg-neutral-800" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Login gate
// ---------------------------------------------------------------------------

function LoginGate() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"form" | "sent">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const origin = window.location.origin;
    const { error: err } = await signIn.magicLink({
      email,
      callbackURL: `${origin}/admin`,
      // @ts-ignore — Better Auth supports newUserCallbackURL; client types may lag
      newUserCallbackURL: `${origin}/admin`,
    });
    setLoading(false);
    if (err) {
      setError("Failed to send sign-in link. Please try again.");
      return;
    }
    setStep("sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-500" />
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Admin Access
          </span>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          {step === "form" ? (
            <>
              <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-400">
                Enter the admin email address to receive a sign-in link.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-email"
                    className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                  >
                    Email address
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    placeholder="admin@example.com"
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                  />
                </div>

                {error && (
                  <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Send sign-in link"}
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-3 text-center">
              <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Link sent
                </p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                  Check <span className="font-mono">{email}</span> for your sign-in link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="text-sm text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access denied
// ---------------------------------------------------------------------------

function AccessDenied({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-rose-50 p-4 dark:bg-rose-950/40">
            <ShieldAlert className="h-8 w-8 text-rose-500" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Access Denied
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          <span className="font-mono text-neutral-700 dark:text-neutral-300">{email}</span> is not
          configured as an admin account.
        </p>
        <button
          type="button"
          onClick={() => signOut().then(() => window.location.reload())}
          className="mt-6 flex items-center gap-2 rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 mx-auto"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

type SortKey = "email" | "createdAt" | "lastSeen" | "activeSessions";
type SortDir = "asc" | "desc";

function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, u] = await Promise.all([fetchStats(), fetchUsers()]);
      setStats(s);
      setUsers(u);
    } catch {
      setError("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    setDeleteError("");
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      // Update total count in stats
      setStats((prev) => (prev ? { ...prev, totalUsers: prev.totalUsers - 1 } : prev));
      setDeletingId(null);
    } catch {
      setDeleteError("Failed to delete user. Please try again.");
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedUsers = [...users].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "email") cmp = a.email.localeCompare(b.email);
    else if (sortKey === "createdAt")
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    else if (sortKey === "lastSeen")
      cmp = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime();
    else if (sortKey === "activeSessions") cmp = a.activeSessions - b.activeSessions;
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  }

  function SortHeader({
    k,
    children,
  }: {
    k: SortKey;
    children: React.ReactNode;
  }) {
    return (
      <th className="px-4 py-3 text-left">
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
        >
          {children}
          <SortIcon k={k} />
        </button>
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-blue-500" />
            <span className="font-semibold text-neutral-900 dark:text-neutral-50">
              Admin Dashboard
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              Signed in as{" "}
              <span className="font-mono text-neutral-600 dark:text-neutral-300">{adminEmail}</span>
            </span>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => signOut().then(() => window.location.reload())}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Stats grid */}
        <section>
          <h2 className="mb-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Overview
          </h2>
          {stats ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Total Users"
                value={stats.totalUsers}
                icon={Users}
                accent="blue"
              />
              <StatCard
                label="Verified Emails"
                value={stats.verifiedUsers}
                sub={
                  stats.totalUsers > 0
                    ? `${Math.round((stats.verifiedUsers / stats.totalUsers) * 100)}% of total`
                    : undefined
                }
                icon={CheckCircle2}
                accent="emerald"
              />
              <StatCard
                label="Unverified Emails"
                value={stats.totalUsers - stats.verifiedUsers}
                icon={XCircle}
                accent="amber"
              />
              <StatCard
                label="New Users (7 days)"
                value={stats.newUsersLast7Days}
                icon={Users}
                accent="violet"
              />
              <StatCard
                label="New Users (30 days)"
                value={stats.newUsersLast30Days}
                icon={Users}
                accent="violet"
              />
              <StatCard
                label="Active Sessions"
                value={stats.activeSessions}
                sub="Non-expired sessions"
                icon={ShieldCheck}
                accent="blue"
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton UI only
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                />
              ))}
            </div>
          )}
        </section>

        {/* Users table */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              User Accounts
            </h2>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {users.length} {users.length === 1 ? "user" : "users"} · PII masked server-side
            </span>
          </div>

          {deleteError && (
            <div className="mb-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
              {deleteError}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Name
                    </th>
                    <SortHeader k="email">Email</SortHeader>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      Verified
                    </th>
                    <SortHeader k="createdAt">Joined</SortHeader>
                    <SortHeader k="lastSeen">Last seen</SortHeader>
                    <SortHeader k="activeSessions">Sessions</SortHeader>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton UI only
                      <SkeletonRow key={i} />
                    ))
                  ) : sortedUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-10 text-center text-neutral-400 dark:text-neutral-500"
                      >
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    sortedUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-neutral-400 dark:text-neutral-500">
                          {u.shortId}
                        </td>
                        <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                          {u.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                          {u.email}
                        </td>
                        <td className="px-4 py-3">
                          {u.emailVerified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                              <XCircle className="h-3 w-3" />
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                          <span title={formatDateTime(u.createdAt)}>{formatDate(u.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                          <span title={formatDateTime(u.lastSeen)}>{formatDate(u.lastSeen)}</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-neutral-700 dark:text-neutral-300">
                          {u.activeSessions}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {deletingId === u.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-neutral-500">Delete?</span>
                              <button
                                type="button"
                                onClick={() => handleDelete(u.id)}
                                className="rounded bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingId(null);
                                  setDeleteError("");
                                }}
                                className="rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingId(u.id);
                                setDeleteError("");
                              }}
                              className="rounded p-1 text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component — auth state machine
// ---------------------------------------------------------------------------

function AdminPage() {
  const { data: session, isPending } = useSession();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setIsAdmin(null);
      return;
    }
    // Verify admin status against the server (the server is the source of truth)
    fetch("/api/admin/stats", { credentials: "include" })
      .then((res) => setIsAdmin(res.ok))
      .catch(() => setIsAdmin(false));
  }, [session]);

  // Loading — waiting for session or admin check
  if (isPending || (session && isAdmin === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  // Not logged in
  if (!session) return <LoginGate />;

  // Logged in but not admin
  if (!isAdmin) return <AccessDenied email={session.user.email} />;

  // Admin dashboard
  return <AdminDashboard adminEmail={session.user.email} />;
}
