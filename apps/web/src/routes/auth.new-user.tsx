import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient, useSession } from "@/lib/auth-client";

type AuthNewUserSearch = { expected?: string };

export const Route = createFileRoute("/auth/new-user")({
  validateSearch: (search: Record<string, unknown>): AuthNewUserSearch => ({
    expected:
      typeof search.expected === "string" ? search.expected : undefined,
  }),
  component: NewUserSetup,
});

function NewUserSetup() {
  const { t } = useTranslation("auth");
  const { expected } = Route.useSearch();
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      navigate({ to: "/login" });
      return;
    }

    // If the session is for a different account (stale cookie), send back to login.
    // Normalise expected before comparing: Better Auth's redirect encodes "+" as a
    // literal "+" in the redirect URL, which URL query-string parsing then decodes
    // as a space — so email addresses containing "+" arrive here with a space.
    // Email addresses never contain spaces, so replacing " " → "+" is safe.
    if (expected) {
      const normalised = expected.replace(/ /g, "+");
      if (normalised.toLowerCase() !== session.user.email.toLowerCase()) {
        navigate({ to: "/login" });
      }
    }
  }, [isPending, session, expected, navigate]);

  if (isPending || !session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      navigate({ to: "/" });
      return;
    }

    setLoading(true);
    setError("");

    const { error: updateError } = await authClient.updateUser({
      name: trimmedName,
    });

    setLoading(false);

    if (updateError) {
      setError(t("errors.generic"));
      return;
    }

    navigate({ to: "/" });
  }

  function handleSkip() {
    navigate({ to: "/" });
  }

  return (
    <AuthLayout>
      <Card className="p-6">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t("newUser.title")}
        </h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          {t("newUser.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label={t("newUser.nameLabel")}
            placeholder={t("newUser.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoFocus
          />

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? `${t("newUser.submit")}...` : t("newUser.submit")}
          </Button>

          <p className="text-center">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-neutral-500 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-50"
            >
              {t("newUser.skip")}
            </button>
          </p>
        </form>
      </Card>
    </AuthLayout>
  );
}
