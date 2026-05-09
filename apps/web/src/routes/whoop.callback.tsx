import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { handleWhoopCallback } from "@/services/whoop-sync";

type WhoopCallbackSearch = { code?: string; state?: string; error?: string };

export const Route = createFileRoute("/whoop/callback")({
  validateSearch: (search: Record<string, unknown>): WhoopCallbackSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: WhoopCallback,
});

function WhoopCallback() {
  const { code, state, error } = Route.useSearch();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    if (error || !code || !state) {
      navigate({ to: "/import", search: { whoopError: error ?? "missing_params" } });
      return;
    }

    handleWhoopCallback(code, state)
      .then(() => navigate({ to: "/import", search: { whoopConnected: "1" } }))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "oauth_failed";
        navigate({ to: "/import", search: { whoopError: msg } });
      });
  }, [code, state, error, navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
    </div>
  );
}
