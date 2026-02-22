import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences, useUpdatePreferences } from "@/hooks/use-preferences";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const selectClassName =
  "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

function SettingsPage() {
  const { t } = useTranslation("settings");
  const { data: session } = useSession();
  const { data: prefs, isPending } = usePreferences();
  const { mutate: update, isPending: isSaving, isSuccess } = useUpdatePreferences();

  if (isPending) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>
        <Card className="mb-6">
          <Skeleton className="mb-4 h-6 w-32" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-48" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      {/* Profile */}
      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold">{t("profile.title")}</h2>
        <div className="space-y-3">
          <div>
            <span className="block text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t("profile.displayName")}
            </span>
            <span className="text-sm text-neutral-900 dark:text-neutral-50">
              {session?.user?.name ?? "—"}
            </span>
          </div>
          <div>
            <span className="block text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t("profile.email")}
            </span>
            <span className="text-sm text-neutral-900 dark:text-neutral-50">
              {session?.user?.email ?? "—"}
            </span>
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("preferences.title")}</h2>
          {isSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" />
              {t("saved")}
            </span>
          )}
        </div>

        {/* Language selector */}
        <div className="mb-4">
          <label
            htmlFor="language-select"
            className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {t("preferences.language")}
          </label>
          <select
            id="language-select"
            value={prefs?.language ?? "en"}
            onChange={(e) => update({ language: e.target.value as "en" | "fr" })}
            disabled={isSaving}
            className={selectClassName}
          >
            <option value="en">{t("preferences.languages.en")}</option>
            <option value="fr">{t("preferences.languages.fr")}</option>
          </select>
        </div>

        {/* Theme selector */}
        <div className="mb-4">
          <label
            htmlFor="theme-select"
            className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {t("preferences.theme")}
          </label>
          <select
            id="theme-select"
            value={prefs?.theme ?? "system"}
            onChange={(e) => update({ theme: e.target.value as "light" | "dark" | "system" })}
            disabled={isSaving}
            className={selectClassName}
          >
            <option value="system">{t("preferences.themeSystem")}</option>
            <option value="light">{t("preferences.themeLight")}</option>
            <option value="dark">{t("preferences.themeDark")}</option>
          </select>
        </div>

        {/* Units selector */}
        <div>
          <label
            htmlFor="units-select"
            className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {t("preferences.units")}
          </label>
          <select
            id="units-select"
            value={prefs?.units ?? "metric"}
            onChange={(e) => update({ units: e.target.value as "metric" | "imperial" })}
            disabled={isSaving}
            className={selectClassName}
          >
            <option value="metric">{t("preferences.unitsMetric")}</option>
            <option value="imperial">{t("preferences.unitsImperial")}</option>
          </select>
        </div>
      </Card>

      {/* Storage */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t("storage.title")}</h2>
        <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
          {t("storage.description")}
        </p>
        <p className="mb-4 text-xs text-amber-600 dark:text-amber-400">{t("storage.warning")}</p>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" size="sm">
            {t("storage.export")}
          </Button>
          <Button type="button" variant="secondary" size="sm">
            {t("storage.importBackup")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
