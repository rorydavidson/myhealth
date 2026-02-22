import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileArchive,
  Loader2,
  Shield,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { type ImportState, useImport, useImportHistory } from "@/hooks/use-import";
import { deleteImport } from "@/services/import";

export const Route = createFileRoute("/_app/import")({
  component: ImportPage,
});

function ImportPage() {
  const { t } = useTranslation("import");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      {/* Privacy message */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
        <Shield className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {t("privacy.message")}
          </p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("privacy.detail")}</p>
        </div>
      </div>

      {/* Apple Health upload */}
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">{t("appleHealth.title")}</h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          {t("appleHealth.description")}
        </p>
        <p className="mb-4 text-xs text-neutral-400 dark:text-neutral-500">
          {t("appleHealth.instructions")}
        </p>

        <AppleHealthDropzone />
      </Card>

      {/* Google Health Connect */}
      <Card className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">{t("googleHealth.title")}</h2>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          {t("googleHealth.description")}
        </p>
        <p className="mb-4 text-xs text-neutral-400 dark:text-neutral-500">
          {t("googleHealth.instructions")}
        </p>

        <HealthConnectDropzone />
      </Card>

      {/* Import history */}
      <ImportHistory />
    </div>
  );
}

// --- Dropzone with progress ---

function AppleHealthDropzone() {
  const { t } = useTranslation("import");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const importHook = useImport();
  const { isImporting, phase, startImport, reset } = importHook;

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        alert(t("errors.invalidFile"));
        return;
      }
      startImport(file);
    },
    [startImport, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [handleFile],
  );

  // Show progress UI when importing or after completion/failure
  if (isImporting || phase === "complete" || phase === "failed") {
    return <ImportProgressCard state={importHook} onReset={reset} />;
  }

  return (
    <div>
      {/* biome-ignore lint/a11y/useSemanticElements: dropzone needs div for drag-and-drop events */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-all ${
          isDragging
            ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950"
            : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={t("appleHealth.dropzone")}
      >
        <Upload
          className={`mb-3 h-8 w-8 transition-colors ${
            isDragging ? "text-blue-500" : "text-neutral-400"
          }`}
        />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          {t("appleHealth.dropzone")}
        </p>
        <p className="mt-1 text-xs text-neutral-400">{t("appleHealth.dropzoneOr")}</p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          {t("appleHealth.browseFiles")}
        </button>
        <p className="mt-3 text-xs text-neutral-400">{t("appleHealth.acceptedFormat")}</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleInputChange}
      />

      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        {t("warnings.clearData")}
      </p>
    </div>
  );
}

function HealthConnectDropzone() {
  const { t } = useTranslation("import");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const importHook = useImport();
  const { isImporting, phase, startHealthConnectImport, reset } = importHook;

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith(".json")) {
        alert(t("errors.invalidJsonFile"));
        return;
      }
      startHealthConnectImport(file);
    },
    [startHealthConnectImport, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  if (isImporting || phase === "complete" || phase === "failed") {
    return <ImportProgressCard state={importHook} onReset={reset} />;
  }

  return (
    <div>
      {/* biome-ignore lint/a11y/useSemanticElements: dropzone needs div for drag-and-drop events */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-all ${
          isDragging
            ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950"
            : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={t("googleHealth.dropzone")}
      >
        <Upload
          className={`mb-3 h-8 w-8 transition-colors ${
            isDragging ? "text-emerald-500" : "text-neutral-400"
          }`}
        />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          {t("googleHealth.dropzone")}
        </p>
        <p className="mt-1 text-xs text-neutral-400">{t("googleHealth.dropzoneOr")}</p>
        <button
          type="button"
          className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          {t("googleHealth.browseFiles")}
        </button>
        <p className="mt-3 text-xs text-neutral-400">{t("googleHealth.acceptedFormat")}</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleInputChange}
      />

      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        {t("warnings.clearData")}
      </p>
    </div>
  );
}

// --- Progress display ---

function ImportProgressCard({ state, onReset }: { state: ImportState; onReset: () => void }) {
  const { t } = useTranslation("import");
  const { phase, recordsParsed, recordsStored, summariesComputed, error, fileName } = state;

  const phaseLabel: Record<string, string> = {
    reading_zip: t("progress.readingZip"),
    parsing: t("progress.parsingXml"),
    storing: t("progress.storingRecords"),
    computing_summaries: t("progress.computingSummaries"),
    complete: t("progress.complete"),
    failed: t("progress.failed"),
  };

  const isActive = phase !== "complete" && phase !== "failed";

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
      {/* File info */}
      <div className="mb-4 flex items-center gap-3">
        <FileArchive className="h-5 w-5 text-neutral-500" />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {fileName}
        </span>
      </div>

      {/* Phase indicator */}
      <div className="mb-4 flex items-center gap-3">
        {phase === "complete" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : phase === "failed" ? (
          <XCircle className="h-5 w-5 text-rose-500" />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        )}
        <span
          className={`text-sm font-medium ${
            phase === "complete"
              ? "text-emerald-700 dark:text-emerald-400"
              : phase === "failed"
                ? "text-rose-700 dark:text-rose-400"
                : "text-neutral-700 dark:text-neutral-300"
          }`}
        >
          {phaseLabel[phase] ?? phase}
        </span>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="mb-4">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${phase === "reading_zip" ? 5 : phase === "parsing" ? 30 : phase === "storing" ? 60 : phase === "computing_summaries" ? 90 : 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
        {recordsParsed > 0 && <p>{t("progress.recordsParsed", { count: recordsParsed })}</p>}
        {recordsStored > 0 && <p>{t("progress.recordsStored", { count: recordsStored })}</p>}
        {summariesComputed > 0 && (
          <p>{t("progress.summariesComputed", { count: summariesComputed })}</p>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      {(phase === "complete" || phase === "failed") && (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            {t("progress.importAnother")}
          </button>
          {phase === "complete" && (
            <Link
              to="/"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              {t("progress.viewDashboard")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// --- Import history table ---

function ImportHistory() {
  const { t } = useTranslation("import");
  const { imports, isLoading } = useImportHistory();

  if (isLoading) {
    return (
      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t("history.title")}</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
        </div>
      </Card>
    );
  }

  if (imports.length === 0) {
    return (
      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t("history.title")}</h2>
        <p className="py-4 text-center text-sm text-neutral-400">{t("history.noImports")}</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">{t("history.title")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:border-neutral-800">
              <th className="pb-3 pr-4">{t("history.date")}</th>
              <th className="pb-3 pr-4">{t("history.source")}</th>
              <th className="pb-3 pr-4 text-right tabular-nums">{t("history.records")}</th>
              <th className="pb-3 pr-4">{t("history.status")}</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody>
            {imports.map((imp) => (
              <ImportHistoryRow key={imp.id} import_={imp} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ImportHistoryRow({
  import_: imp,
}: {
  import_: {
    id: string;
    platform: string;
    fileName: string;
    startedAt: Date;
    recordCount: number;
    status: string;
  };
}) {
  const { t } = useTranslation("import");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(t("history.deleteConfirm", { count: imp.recordCount }));
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteImport(imp.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const statusLabel =
    imp.status === "completed"
      ? t("history.statusCompleted")
      : imp.status === "processing"
        ? t("history.statusProcessing")
        : t("history.statusFailed");

  const statusColor =
    imp.status === "completed"
      ? "text-emerald-600 dark:text-emerald-400"
      : imp.status === "processing"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

  return (
    <tr className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
      <td className="py-3 pr-4 tabular-nums">
        {new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(imp.startedAt)}
      </td>
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {imp.platform === "apple_health" ? "Apple Health" : "Health Connect"}
        </span>
      </td>
      <td className="py-3 pr-4 text-right tabular-nums">{imp.recordCount.toLocaleString()}</td>
      <td className="py-3 pr-4">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${statusColor}`}>
          {imp.status === "completed" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : imp.status === "processing" ? (
            <Clock className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {statusLabel}
        </span>
      </td>
      <td className="py-3 text-right">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-neutral-800"
          title={t("history.deleteImport")}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </td>
    </tr>
  );
}
