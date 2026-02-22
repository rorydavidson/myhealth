import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/auth-client";

export const Route = createFileRoute("/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    if (password.length < 8) {
      setError(t("errors.weakPassword"));
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUp.email({
      name,
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      if (signUpError.message?.includes("already exists") || signUpError.status === 422) {
        setError(t("errors.emailTaken"));
      } else {
        setError(t("errors.generic"));
      }
      return;
    }

    navigate({ to: "/" });
  }

  return (
    <AuthLayout>
      <Card className="p-6">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          {t("signUp.title")}
        </h1>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          {t("signUp.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="name"
            label={t("signUp.nameLabel")}
            placeholder={t("signUp.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />

          <Input
            id="email"
            type="email"
            label={t("signUp.emailLabel")}
            placeholder={t("signUp.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            id="password"
            type="password"
            label={t("signUp.passwordLabel")}
            placeholder={t("signUp.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />

          <Input
            id="confirm-password"
            type="password"
            label={t("signUp.confirmPasswordLabel")}
            placeholder={t("signUp.confirmPasswordPlaceholder")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? `${t("signUp.submit")}...` : t("signUp.submit")}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {t("signUp.hasAccount")}{" "}
          <Link
            to="/login"
            className="font-medium text-neutral-900 hover:underline dark:text-neutral-50"
          >
            {t("signUp.signInLink")}
          </Link>
        </p>
      </Card>
    </AuthLayout>
  );
}
