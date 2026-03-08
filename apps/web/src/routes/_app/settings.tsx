import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, Download, HardDrive, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { usePreferences, useUpdatePreferences } from "@/hooks/use-preferences";
import { authClient, useSession } from "@/lib/auth-client";
import type { BiologicalSex } from "@/lib/api";
import {
  clearAllData,
  exportDataAsCsv,
  exportDataAsJson,
  importDataFromJson,
} from "@/services/export";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const selectClassName =
  "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

interface StorageStats {
  healthRecords: number;
  dailySummaries: number;
  labResults: number;
  imports: number;
  estimatedSizeMB: string;
}

function useStorageStats() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRecords, dailySummaries, labResults, imports] = await Promise.all([
        db.healthRecords.count(),
        db.dailySummaries.count(),
        db.labResults.count(),
        db.imports.count(),
      ]);

      // Estimate storage usage via navigator.storage API
      let estimatedSizeMB = "—";
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          estimatedSizeMB = (estimate.usage / (1024 * 1024)).toFixed(1);
        }
      }

      setStats({
        healthRecords,
        dailySummaries,
        labResults,
        imports,
        estimatedSizeMB,
      });
    } catch {
      // silently fail — stats are informational
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useState(() => {
    refresh();
  });

  return { stats, loading, refresh };
}

function SettingsPage() {
  const { t } = useTranslation("settings");
  const { data: session } = useSession();
  const { data: prefs, isPending } = usePreferences();
  const { mutate: update, isPending: isSaving, isSuccess } = useUpdatePreferences();

  const { stats, loading: statsLoading, refresh: refreshStats } = useStorageStats();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nameInput, setNameInput] = useState(session?.user?.name ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [dobInput, setDobInput] = useState(prefs?.dateOfBirth ?? "");
  const [sexInput, setSexInput] = useState(prefs?.biologicalSex ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Sync nameInput when session loads
  useEffect(() => {
    if (session?.user?.name && !nameInput) {
      setNameInput(session.user.name);
    }
  }, [session?.user?.name]);

  // Sync DOB and sex when prefs load
  useEffect(() => {
    if (prefs?.dateOfBirth && !dobInput) setDobInput(prefs.dateOfBirth);
    if (prefs?.biologicalSex && !sexInput) setSexInput(prefs.biologicalSex);
  }, [prefs?.dateOfBirth, prefs?.biologicalSex]);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === session?.user?.name) return;
    setNameSaving(true);
    setNameSaved(false);
    try {
      await authClient.updateUser({ name: trimmed });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 3000);
    } finally {
      setNameSaving(false);
    }
  }, [nameInput, session?.user?.name]);

  const profileDirty =
    dobInput !== (prefs?.dateOfBirth ?? "") || sexInput !== (prefs?.biologicalSex ?? "");

  const handleSaveProfile = useCallback(async () => {
    if (!profileDirty) return;
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await new Promise<void>((resolve, reject) => {
        update(
          {
            dateOfBirth: dobInput || undefined,
            biologicalSex: (sexInput as BiologicalSex) || undefined,
          },
          { onSuccess: () => resolve(), onError: reject },
        );
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } finally {
      setProfileSaving(false);
    }
  }, [dobInput, sexInput, profileDirty, update]);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleExportJson = useCallback(async () => {
    setExporting(true);
    try {
      await exportDataAsJson();
    } finally {
      setExporting(false);
    }
  }, []);

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    try {
      await exportDataAsCsv();
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImportBackup = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImporting(true);
      setImportResult(null);

      try {
        const result = await importDataFromJson(file);
        setImportResult({
          success: true,
          message: t("storage.importSuccess", { count: result.recordCount }),
        });
        refreshStats();
      } catch (err) {
        setImportResult({
          success: false,
          message: err instanceof Error ? err.message : t("storage.importError"),
        });
      } finally {
        setImporting(false);
        // Reset file input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [t, refreshStats],
  );

  const handleClearAll = useCallback(async () => {
    setClearing(true);
    try {
      await clearAllData();
      setShowClearConfirm(false);
      refreshStats();
    } finally {
      setClearing(false);
    }
  }, [refreshStats]);

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
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="profile-name"
              className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              {t("profile.yourName")}
            </label>
            <div className="flex gap-2">
              <input
                id="profile-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                placeholder={t("profile.namePlaceholder")}
                disabled={nameSaving}
                className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveName}
                disabled={nameSaving || !nameInput.trim() || nameInput.trim() === session?.user?.name}
              >
                {nameSaving ? t("profile.savingName") : t("profile.saveName")}
              </Button>
            </div>
            {nameSaved && (
              <span className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                {t("profile.nameSaved")}
              </span>
            )}
          </div>

          {/* Email */}
          <div>
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t("profile.email")}
            </span>
            <span className="text-sm text-neutral-900 dark:text-neutral-50">
              {session?.user?.email ?? "—"}
            </span>
          </div>

          {/* Date of birth + biological sex */}
          <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t("profile.profileHint")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="profile-dob"
                  className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  {t("profile.dateOfBirth")}
                </label>
                <input
                  id="profile-dob"
                  type="date"
                  value={dobInput}
                  onChange={(e) => setDobInput(e.target.value)}
                  disabled={profileSaving}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-sex"
                  className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  {t("profile.biologicalSex")}
                </label>
                <select
                  id="profile-sex"
                  value={sexInput}
                  onChange={(e) => setSexInput(e.target.value)}
                  disabled={profileSaving}
                  className={selectClassName}
                >
                  <option value="">{t("profile.sexOptions.placeholder")}</option>
                  <option value="male">{t("profile.sexOptions.male")}</option>
                  <option value="female">{t("profile.sexOptions.female")}</option>
                  <option value="intersex">{t("profile.sexOptions.intersex")}</option>
                  <option value="prefer_not_to_say">{t("profile.sexOptions.prefer_not_to_say")}</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSaveProfile}
                disabled={profileSaving || !profileDirty}
              >
                {profileSaving ? t("profile.savingProfile") : t("profile.saveProfile")}
              </Button>
              {profileSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" />
                  {t("profile.profileSaved")}
                </span>
              )}
            </div>
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
            onChange={(e) =>
              update({
                theme: e.target.value as "light" | "dark" | "system",
              })
            }
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

        {/* Storage stats */}
        <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="mb-2 flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t("storage.usage")}
            </span>
          </div>
          {statsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : stats ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-neutral-500 dark:text-neutral-400">
                {t("storage.statsRecords")}
              </div>
              <div className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                {stats.healthRecords.toLocaleString()}
              </div>
              <div className="text-neutral-500 dark:text-neutral-400">
                {t("storage.statsSummaries")}
              </div>
              <div className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                {stats.dailySummaries.toLocaleString()}
              </div>
              <div className="text-neutral-500 dark:text-neutral-400">
                {t("storage.statsLabResults")}
              </div>
              <div className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                {stats.labResults.toLocaleString()}
              </div>
              <div className="text-neutral-500 dark:text-neutral-400">
                {t("storage.statsImports")}
              </div>
              <div className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                {stats.imports.toLocaleString()}
              </div>
              <div className="text-neutral-500 dark:text-neutral-400">{t("storage.statsSize")}</div>
              <div className="tabular-nums font-medium text-neutral-900 dark:text-neutral-50">
                {stats.estimatedSizeMB} MB
              </div>
            </div>
          ) : null}
        </div>

        {/* Export buttons */}
        <div className="mb-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            disabled={exporting}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t("storage.export")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={exporting}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t("storage.exportCsv")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleImportBackup}
            disabled={importing}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {importing ? t("storage.importing") : t("storage.importBackup")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {/* Import result */}
        {importResult && (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              importResult.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400"
            }`}
          >
            {importResult.message}
          </div>
        )}

        {/* Clear data */}
        <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
          {!showClearConfirm ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950 dark:hover:text-rose-300"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("storage.clearAll")}
            </Button>
          ) : (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950">
              <div className="mb-3 flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  {t("storage.clearConfirm")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowClearConfirm(false)}
                  disabled={clearing}
                >
                  {t("storage.cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {clearing ? t("storage.clearing") : t("storage.confirmDelete")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
