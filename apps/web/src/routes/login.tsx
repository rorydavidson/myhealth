import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await signIn.email({
      email,
      password,
      rememberMe,
    });

    setLoading(false);

    if (signInError) {
      setError(t("errors.invalidCredentials"));
      return;
    }

    navigate({ to: "/" });
  }

  return (
    <AuthLayout>
      <Card className="p-6">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t("signIn.title")}
        </h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          {t("signIn.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label={t("signIn.emailLabel")}
            placeholder={t("signIn.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            id="password"
            type="password"
            label={t("signIn.passwordLabel")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <div className="flex items-center justify-between">
            <label
              htmlFor="remember-me"
              className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400"
            >
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-600"
              />
              {t("signIn.rememberMe")}
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-50"
            >
              {t("signIn.forgotPassword")}
            </Link>
          </div>

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? `${t("signIn.submit")}...` : t("signIn.submit")}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {t("signIn.noAccount")}{" "}
          <Link
            to="/sign-up"
            className="font-medium text-neutral-900 hover:underline dark:text-neutral-50"
          >
            {t("signIn.signUpLink")}
          </Link>
        </p>
      </Card>
    </AuthLayout>
  );
}
