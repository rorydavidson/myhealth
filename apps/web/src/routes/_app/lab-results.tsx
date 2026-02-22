import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, FlaskConical, Shield, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { db, type LabResultRow } from "@/db";
import { useLocaleFormat } from "@/hooks/use-locale-format";
import {
  createPdfUrl,
  deleteLabResult,
  extractStructuredValues,
  extractTextFromPdf,
  type LabCategory,
  type StructuredValue,
  saveLabResult,
} from "@/services/lab-results";

export const Route = createFileRoute("/_app/lab-results")({
  component: LabResultsPage,
});

type ViewMode = "list" | "upload" | "detail";

function LabResultsPage() {
  const { t } = useTranslation("lab-results");
  const [view, setView] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const labResults = useLiveQuery(() => db.labResults.orderBy("date").reverse().toArray());
  const isLoading = labResults === undefined;

  const selectedResult = useMemo(
    () => (selectedId ? (labResults?.find((r) => r.id === selectedId) ?? null) : null),
    [selectedId, labResults],
  );

  const handleView = useCallback((id: string) => {
    setSelectedId(id);
    setView("detail");
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setView("list");
  }, []);

  const handleUploaded = useCallback(() => {
    setView("list");
  }, []);

  if (isLoading) {
    return <LabResultsSkeleton />;
  }

  if (view === "upload") {
    return <UploadView onBack={handleBack} onSaved={handleUploaded} />;
  }

  if (view === "detail" && selectedResult) {
    return <DetailView result={selectedResult} onBack={handleBack} />;
  }

  // List view
  if (!labResults || labResults.length === 0) {
    return (
      <EmptyState
        icon={<FlaskConical className="h-12 w-12" />}
        title={t("list.empty")}
        description={t("list.emptyDescription")}
        action={
          <Button onClick={() => setView("upload")}>
            <Upload className="h-4 w-4" />
            {t("upload.title")}
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button onClick={() => setView("upload")}>
          <Upload className="h-4 w-4" />
          {t("upload.title")}
        </Button>
      </div>

      <LabResultsList results={labResults} onView={handleView} />
    </div>
  );
}

// --- Lab Results List ---

function LabResultsList({
  results,
  onView,
}: {
  results: LabResultRow[];
  onView: (id: string) => void;
}) {
  const { t } = useTranslation("lab-results");
  const fmt = useLocaleFormat();

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50">
              <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400">
                {t("list.date")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400">
                {t("list.category")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400">
                {t("list.file")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400">
                {t("list.values")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400" />
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <LabResultListRow
                key={result.id}
                result={result}
                fmt={fmt}
                onView={() => onView(result.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LabResultListRow({
  result,
  fmt,
  onView,
}: {
  result: LabResultRow;
  fmt: ReturnType<typeof useLocaleFormat>;
  onView: () => void;
}) {
  const { t } = useTranslation("lab-results");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valuesCount = Object.keys(result.structuredValues).length;

  const handleDelete = async () => {
    await deleteLabResult(result.id);
    setConfirmDelete(false);
  };

  return (
    <tr className="border-b border-neutral-100 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/30">
      <td className="px-4 py-3 tabular-nums text-neutral-900 dark:text-neutral-100">
        {fmt.date(result.date)}
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
          {t(`form.categories.${result.category}`)}
        </span>
      </td>
      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{result.fileName}</td>
      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
        {valuesCount > 0 ? t("list.valuesCount", { count: valuesCount }) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onView}
            className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            {t("detail.viewPdf")}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleDelete}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                {t("list.deleteConfirm").split("?")[0]}?
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-neutral-400 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// --- Upload View ---

interface UploadState {
  phase: "idle" | "extracting" | "review" | "saving" | "done";
  file: File | null;
  extractedText: string;
  structuredValues: Record<string, StructuredValue>;
  date: string;
  category: LabCategory;
  notes: string;
  error: string | null;
}

function UploadView({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const { t } = useTranslation("lab-results");
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({
    phase: "idle",
    file: null,
    extractedText: "",
    structuredValues: {},
    date: new Date().toISOString().slice(0, 10),
    category: "other",
    notes: "",
    error: null,
  });

  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setState((s) => ({ ...s, error: "Only PDF files are accepted" }));
      return;
    }

    setState((s) => ({ ...s, file, phase: "extracting", error: null }));

    try {
      const text = await extractTextFromPdf(file);
      const values = extractStructuredValues(text);

      setState((s) => ({
        ...s,
        extractedText: text,
        structuredValues: values,
        phase: "review",
      }));
    } catch {
      setState((s) => ({
        ...s,
        extractedText: "",
        structuredValues: {},
        phase: "review",
        error: "Could not extract text from PDF. You can still save the report.",
      }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleSave = async () => {
    if (!state.file) return;

    setState((s) => ({ ...s, phase: "saving" }));

    try {
      await saveLabResult({
        file: state.file,
        date: state.date,
        category: state.category,
        notes: state.notes,
        extractedText: state.extractedText,
        structuredValues: state.structuredValues,
      });
      setState((s) => ({ ...s, phase: "done" }));
      onSaved();
    } catch {
      setState((s) => ({ ...s, phase: "review", error: "Failed to save lab result" }));
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">{t("upload.title")}</h1>
      </div>

      {/* Privacy banner */}
      <div className="mb-6 flex items-center gap-2 rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">
        <Shield className="h-4 w-4 shrink-0" />
        {t("upload.privacy")}
      </div>

      {/* Dropzone or review */}
      {state.phase === "idle" && (
        <Card>
          {/* biome-ignore lint/a11y/useSemanticElements: dropzone needs div for drag-and-drop */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 transition-colors ${
              dragOver
                ? "border-violet-500 bg-violet-50 dark:bg-violet-900/10"
                : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-600"
            }`}
          >
            <FlaskConical className="mb-3 h-10 w-10 text-neutral-400" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t("upload.dropzone")}
            </p>
            <p className="mt-1 text-xs text-neutral-500">{t("upload.dropzoneOr")}</p>
            <p className="mt-2 text-xs text-neutral-400">{t("upload.acceptedFormat")}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </Card>
      )}

      {state.phase === "extracting" && (
        <Card className="flex flex-col items-center justify-center py-16">
          <Skeleton className="mb-4 h-8 w-8 rounded-full" />
          <p className="text-sm text-neutral-500">{t("extraction.extracting")}</p>
        </Card>
      )}

      {(state.phase === "review" || state.phase === "saving") && (
        <ReviewForm state={state} setState={setState} onSave={handleSave} />
      )}

      {state.error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {state.error}
        </div>
      )}
    </div>
  );
}

// --- Review Form ---

function ReviewForm({
  state,
  setState,
  onSave,
}: {
  state: UploadState;
  setState: React.Dispatch<React.SetStateAction<UploadState>>;
  onSave: () => void;
}) {
  const { t } = useTranslation("lab-results");
  const categories: LabCategory[] = ["blood_panel", "lipid_panel", "thyroid", "metabolic", "other"];
  const values = Object.entries(state.structuredValues);

  return (
    <div className="space-y-4">
      {/* Metadata form */}
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="lab-date"
              className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              {t("form.dateLabel")}
            </label>
            <input
              id="lab-date"
              type="date"
              value={state.date}
              onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div>
            <label
              htmlFor="lab-category"
              className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
            >
              {t("form.categoryLabel")}
            </label>
            <select
              id="lab-category"
              value={state.category}
              onChange={(e) => setState((s) => ({ ...s, category: e.target.value as LabCategory }))}
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`form.categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="lab-notes"
            className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {t("form.notesLabel")}
          </label>
          <textarea
            id="lab-notes"
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            placeholder={t("form.notesPlaceholder")}
            rows={3}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
      </Card>

      {/* Extracted values */}
      <Card>
        <CardTitle className="mb-3">{t("extraction.reviewValues")}</CardTitle>

        {values.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("extraction.noValuesExtracted")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">
                    {t("extraction.testName")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-neutral-500">
                    {t("extraction.value")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">
                    {t("extraction.unit")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">
                    {t("extraction.referenceRange")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">
                    {t("extraction.flag")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500">
                    {t("extraction.loincCode")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {values.map(([name, val]) => (
                  <tr key={name} className="border-b border-neutral-100 dark:border-neutral-800">
                    <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                      {name}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
                      {val.value}
                    </td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{val.unit}</td>
                    <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">
                      {val.referenceRange ?? "—"}
                    </td>
                    <td className="px-3 py-2">{val.flag && <FlagBadge flag={val.flag} />}</td>
                    <td className="px-3 py-2 text-xs text-neutral-400">{val.loincCode ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={state.phase === "saving"}>
          {state.phase === "saving" ? t("save.saving") : t("save.button")}
        </Button>
      </div>
    </div>
  );
}

// --- Detail View ---

function DetailView({ result, onBack }: { result: LabResultRow; onBack: () => void }) {
  const { t } = useTranslation("lab-results");
  const fmt = useLocaleFormat();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const values = Object.entries(result.structuredValues);

  useEffect(() => {
    const url = createPdfUrl(result.pdfBlob);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result.pdfBlob]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{result.fileName}</h1>
          <p className="text-sm text-neutral-500">
            {fmt.date(result.date)} ·{" "}
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              {t(`form.categories.${result.category}`)}
            </span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* PDF viewer */}
        <Card className="overflow-hidden p-0">
          {pdfUrl && (
            <iframe src={pdfUrl} title={result.fileName} className="h-[600px] w-full border-0" />
          )}
        </Card>

        {/* Extracted values + notes */}
        <div className="space-y-4">
          <Card>
            <CardTitle className="mb-3">{t("detail.extractedValues")}</CardTitle>
            {values.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("extraction.noValuesExtracted")}</p>
            ) : (
              <div className="space-y-2">
                {values.map(([name, val]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800/50"
                  >
                    <div>
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        {name}
                      </span>
                      {val.loincCode && (
                        <span className="ml-2 text-xs text-neutral-400">LOINC {val.loincCode}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {val.value} {val.unit}
                      </span>
                      {val.referenceRange && (
                        <span className="text-xs text-neutral-400">({val.referenceRange})</span>
                      )}
                      {val.flag && <FlagBadge flag={val.flag} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card>
            <CardTitle className="mb-2">{t("detail.notes")}</CardTitle>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {result.notes || t("detail.noNotes")}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Flag Badge ---

function FlagBadge({ flag }: { flag: string }) {
  const { t } = useTranslation("lab-results");

  const colors: Record<string, string> = {
    normal: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    low: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    high: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    critical_low: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
    critical_high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[flag] ?? colors.normal}`}
    >
      {t(`flags.${flag}`)}
    </span>
  );
}

// --- Skeleton ---

function LabResultsSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-44" />
      </div>
      <Card className="p-0">
        {["lr-1", "lr-2", "lr-3"].map((id) => (
          <div
            key={id}
            className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}
