import { createFileRoute } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn, signOut } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type Step = "email" | "sent";
type ClearState = "idle" | "confirm" | "clearing" | "done";

async function clearAllLocalDatabases(): Promise<void> {
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs
      .filter((d) => d.name?.startsWith("hd-"))
      .map((d) => indexedDB.deleteDatabase(d.name!)),
  );
}

function LoginPage() {
  const { t } = useTranslation("auth");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearState, setClearState] = useState<ClearState>("idle");

  // Clear any existing session on mount to prevent stale-cookie issues
  useEffect(() => {
    signOut().catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signOut();
    } catch {
      /* not signed in — fine */
    }

    const { error: signInError } = await signIn.magicLink({
      email,
      callbackURL: `/auth/callback?expected=${encodeURIComponent(email)}`,
      // @ts-ignore — Better Auth supports this param; client types may lag
      newUserCallbackURL: `/auth/new-user?expected=${encodeURIComponent(email)}`,
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
    setError("");
  }

  async function handleClear() {
    setClearState("clearing");
    await clearAllLocalDatabases();
    setClearState("done");
    setTimeout(() => setClearState("idle"), 3000);
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

            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && (
                <p className="text-sm text-red-500 dark:text-red-400">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? `${t("magicLink.submit")}...`
                  : t("magicLink.submit")}
              </Button>
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

      {/* Clear local data — security wipe for shared/borrowed devices */}
      <div className="mt-4 text-center">
        {clearState === "idle" && (
          <button
            type="button"
            onClick={() => setClearState("confirm")}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 dark:text-neutral-600 dark:hover:text-neutral-400"
          >
            <ShieldX className="h-3 w-3" />
            {t("clearData.button")}
          </button>
        )}

        {clearState === "confirm" && (
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900">
            <p className="mb-3 text-neutral-600 dark:text-neutral-400">
              {t("clearData.confirm")}
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setClearState("idle")}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                {t("clearData.cancel")}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
              >
                {t("clearData.confirmButton")}
              </button>
            </div>
          </div>
        )}

        {clearState === "clearing" && (
          <span className="text-xs text-neutral-400 dark:text-neutral-600">
            {t("clearData.clearing")}
          </span>
        )}

        {clearState === "done" && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            {t("clearData.done")}
          </span>
        )}
      </div>
    </AuthLayout>
  );
}
