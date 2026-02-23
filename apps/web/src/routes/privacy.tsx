import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, Server, Shield, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t } = useTranslation("common");

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("actions.back")}
        </Link>

        <h1 className="mb-2 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
          {t("privacy.pageTitle")}
        </h1>
        <p className="mb-10 text-sm text-neutral-500 dark:text-neutral-400">
          {t("privacy.effectiveDate")}
        </p>

        <div className="space-y-10">
          {/* Core principle */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {t("privacy.corePrincipleTitle")}
              </h2>
            </div>
            <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
              {t("privacy.corePrincipleBody")}
            </p>
          </section>

          {/* What stays on your device */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {t("privacy.onDeviceTitle")}
              </h2>
            </div>
            <p className="mb-3 leading-relaxed text-neutral-700 dark:text-neutral-300">
              {t("privacy.onDeviceBody")}
            </p>
            <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              {(t("privacy.onDeviceList", { returnObjects: true }) as string[]).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* What the server sees */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <Server className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {t("privacy.serverTitle")}
              </h2>
            </div>
            <p className="mb-3 leading-relaxed text-neutral-700 dark:text-neutral-300">
              {t("privacy.serverBody")}
            </p>
            <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              {(t("privacy.serverList", { returnObjects: true }) as string[]).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* LLM / AI queries */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {t("privacy.aiTitle")}
              </h2>
            </div>
            <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
              {t("privacy.aiBody")}
            </p>
          </section>

          {/* Deleting your data */}
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <Trash2 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                {t("privacy.deletionTitle")}
              </h2>
            </div>
            <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">
              {t("privacy.deletionBody")}
            </p>
          </section>

          {/* Disclaimer */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/10">
            <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-300">
              {t("disclaimer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
