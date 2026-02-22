import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (resetError) {
      setError(t("errors.generic"));
    } else {
      setSent(true);
    }

    setLoading(false);
  }

  return (
    <AuthLayout>
      <Card className="p-6">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t("resetPassword.title")}
        </h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          {t("resetPassword.subtitle")}
        </p>

        {sent ? (
          <div className="text-center">
            <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">
              {t("resetPassword.success")}
            </p>
            <Link
              to="/login"
              className="text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-50"
            >
              {t("resetPassword.backToSignIn")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label={t("resetPassword.emailLabel")}
              placeholder={t("resetPassword.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? `${t("resetPassword.submit")}...` : t("resetPassword.submit")}
            </Button>

            <p className="text-center">
              <Link
                to="/login"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-50"
              >
                {t("resetPassword.backToSignIn")}
              </Link>
            </p>
          </form>
        )}
      </Card>
    </AuthLayout>
  );
}
