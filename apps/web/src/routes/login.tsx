import { createFileRoute } from "@tanstack/react-router";
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

type Step = "email" | "profile" | "sent";

function LoginPage() {
  const { t } = useTranslation("auth");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStep("profile");
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await signIn.magicLink({
      email,
      name: name.trim() || undefined,
      callbackURL: "/",
    });

    setLoading(false);

    if (signInError) {
      setError(t("errors.generic"));
      return;
    }

    setStep("sent");
  }

  function reset() {
    setStep("email");
    setEmail("");
    setName("");
    setError("");
  }

  return (
    <AuthLayout>
      <Card className="p-6">
        {step === "email" && (
          <>
            <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
              {t("magicLink.title")}
            </h1>
            <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
              {t("magicLink.subtitle")}
            </p>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <Input
                id="email"
                type="email"
                label={t("magicLink.emailLabel")}
                placeholder={t("magicLink.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />

              <Button type="submit" className="w-full">
                {t("magicLink.continueButton")}
              </Button>
            </form>
          </>
        )}

        {step === "profile" && (
          <>
            <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">
              {t("magicLink.profileTitle")}
            </h1>
            <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
              {t("magicLink.profileSubtitle")}
            </p>

            <div className="mb-4 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {t("magicLink.emailLabel")}:
              </span>
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                {email}
              </span>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <Input
                id="name"
                label={t("magicLink.nameLabel")}
                placeholder={t("magicLink.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
              />

              {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? `${t("magicLink.submit")}...` : t("magicLink.submit")}
              </Button>

              <p className="text-center">
                <button
                  type="button"
                  onClick={reset}
                  className="text-sm text-neutral-500 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-50"
                >
                  {t("magicLink.backToEmail")}
                </button>
              </p>
            </form>
          </>
        )}

        {step === "sent" && (
          <div className="space-y-4 text-center">
            <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                {t("magicLink.sentTitle")}
              </p>
              <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
                {t("magicLink.sentDescription", { email })}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-neutral-500 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-50"
            >
              {t("magicLink.backToSignIn")}
            </button>
          </div>
        )}
      </Card>
    </AuthLayout>
  );
}
