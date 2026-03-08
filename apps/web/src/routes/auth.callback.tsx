import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession, signOut } from "@/lib/auth-client";

type AuthCallbackSearch = { expected?: string };

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): AuthCallbackSearch => ({
    expected: typeof search.expected === "string" ? search.expected : undefined,
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const { expected } = Route.useSearch();
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      // Verification failed — no session was created
      navigate({ to: "/login" });
      return;
    }

    // Normalise expected before comparing: Better Auth encodes "+" as a literal "+"
    // in its redirect URLs, which URL query-string parsing then decodes as a space.
    // Email addresses never contain spaces, so replacing " " → "+" is safe.
    const normalisedExpected = expected?.replace(/ /g, "+");
    if (
      normalisedExpected &&
      session.user.email.toLowerCase() !== normalisedExpected.toLowerCase()
    ) {
      // The session is for the wrong account — this is the stale-cookie bug.
      // Force sign-out and send back to login so the user can try again cleanly.
      signOut().then(() => navigate({ to: "/login" }));
      return;
    }

    // Session email matches what was requested — safe to proceed
    navigate({ to: "/" });
  }, [session, isPending, expected, navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
    </div>
  );
}
