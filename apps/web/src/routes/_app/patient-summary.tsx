import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, FileHeart, Info, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { db } from "@/db";
import { useSession } from "@/lib/auth-client";
import { exportIPSAsJson, exportIPSAsPdf, getIPSPreview } from "@/services/ips";

export const Route = createFileRoute("/_app/patient-summary")({
  component: PatientSummaryPage,
});

const selectClassName =
  "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800";

const inputClassName =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50";

function PatientSummaryPage() {
  const { t } = useTranslation("ips");
  const { data: session } = useSession();

  const [patientName, setPatientName] = useState(session?.user?.name ?? "");
  const [timeRangeDays, setTimeRangeDays] = useState(90);

  // Pre-fill name from session once it loads (only if user hasn't typed anything)
  useEffect(() => {
    if (session?.user?.name && !patientName) {
      setPatientName(session.user.name);
    }
  }, [session?.user?.name]);
  const [selectedLabIds, setSelectedLabIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<{
    vitalSignMetrics: Array<{ metric: string; latestDate: string; latestValue: string }>;
    labResults: Array<{ fileName: string; date: string; testCount: number }>;
    conditionCount: number;
  } | null>(null);

  // Load lab results for selection
  const labResults = useLiveQuery(() => db.labResults.toArray(), []);

  // Update preview when settings change
  useEffect(() => {
    getIPSPreview(timeRangeDays, selectedLabIds).then(setPreview);
  }, [timeRangeDays, selectedLabIds]);

  const handleLabToggle = useCallback((labId: string) => {
    setSelectedLabIds((prev) =>
      prev.includes(labId) ? prev.filter((id) => id !== labId) : [...prev, labId],
    );
  }, []);

  const handleExportJson = useCallback(async () => {
    if (!patientName.trim()) return;
    setExporting(true);
    try {
      await exportIPSAsJson({
        patientName: patientName.trim(),
        timeRangeDays,
        includeLabResultIds: selectedLabIds,
      });
    } finally {
      setExporting(false);
    }
  }, [patientName, timeRangeDays, selectedLabIds]);

  const handleExportPdf = useCallback(async () => {
    if (!patientName.trim()) return;
    setExporting(true);
    try {
      await exportIPSAsPdf({
        patientName: patientName.trim(),
        timeRangeDays,
        includeLabResultIds: selectedLabIds,
      });
    } finally {
      setExporting(false);
    }
  }, [patientName, timeRangeDays, selectedLabIds]);

  const metricDisplayNames: Record<string, string> = {
    heart_rate: "Heart Rate",
    resting_heart_rate: "Resting Heart Rate",
    blood_pressure: "Blood Pressure",
    oxygen_saturation: "SpO\u2082",
    respiratory_rate: "Respiratory Rate",
    body_mass: "Body Weight",
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      {/* What is IPS */}
      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
          <div>
            <h2 className="mb-1 text-sm font-semibold">{t("whatIsIps")}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("whatIsIpsDetail")}</p>
          </div>
        </div>
      </Card>

      {/* Configuration form */}
      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold">
          <FileHeart className="mr-2 inline h-5 w-5 text-violet-500" />
          {t("description")}
        </h2>

        {/* Patient name */}
        <div className="mb-4">
          <label htmlFor="patient-name" className="mb-1 block text-sm font-medium">
            {t("form.nameLabel")}
          </label>
          <input
            id="patient-name"
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder={t("form.namePlaceholder")}
            className={inputClassName}
          />
          <div className="mt-1.5 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("form.namePrivacy")}
            </span>
          </div>
        </div>

        {/* Time range */}
        <div className="mb-4">
          <label htmlFor="time-range" className="mb-1 block text-sm font-medium">
            {t("form.timeRange")}
          </label>
          <select
            id="time-range"
            value={timeRangeDays}
            onChange={(e) => setTimeRangeDays(Number(e.target.value))}
            className={selectClassName}
          >
            <option value={30}>{t("form.timeRanges.30")}</option>
            <option value={90}>{t("form.timeRanges.90")}</option>
            <option value={180}>{t("form.timeRanges.180")}</option>
            <option value={365}>{t("form.timeRanges.365")}</option>
          </select>
        </div>

        {/* Lab results selection */}
        <div className="mb-4">
          <span className="mb-2 block text-sm font-medium">{t("form.labResultsSelect")}</span>
          {labResults && labResults.length > 0 ? (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
              {labResults.map((lab) => (
                <label key={lab.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLabIds.includes(lab.id)}
                    onChange={() => handleLabToggle(lab.id)}
                    className="rounded border-neutral-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-neutral-900 dark:text-neutral-50">{lab.fileName}</span>
                  <span className="text-neutral-400">({lab.date})</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">{t("form.noLabResults")}</p>
          )}
        </div>
      </Card>

      {/* Preview */}
      {preview && (
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">{t("preview.title")}</h2>

          {/* Vital signs preview */}
          <h3 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {t("preview.vitalSigns")}
          </h3>
          {preview.vitalSignMetrics.length > 0 ? (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="py-2 pr-4 text-left font-medium text-neutral-500 dark:text-neutral-400">
                      {t("preview.metric")}
                    </th>
                    <th className="py-2 pr-4 text-left font-medium text-neutral-500 dark:text-neutral-400">
                      {t("preview.latestValue")}
                    </th>
                    <th className="py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">
                      {t("preview.date")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.vitalSignMetrics.map((vs) => (
                    <tr
                      key={vs.metric}
                      className="border-b border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="py-2 pr-4">{metricDisplayNames[vs.metric] ?? vs.metric}</td>
                      <td className="py-2 pr-4 tabular-nums">{vs.latestValue}</td>
                      <td className="py-2 tabular-nums text-neutral-500 dark:text-neutral-400">
                        {vs.latestDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-4 text-sm text-neutral-400">{t("preview.noVitalSigns")}</p>
          )}

          {/* Lab results preview */}
          <h3 className="mb-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {t("preview.labResults")}
          </h3>
          {preview.labResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="py-2 pr-4 text-left font-medium text-neutral-500 dark:text-neutral-400">
                      {t("preview.file")}
                    </th>
                    <th className="py-2 pr-4 text-left font-medium text-neutral-500 dark:text-neutral-400">
                      {t("preview.date")}
                    </th>
                    <th className="py-2 text-left font-medium text-neutral-500 dark:text-neutral-400">
                      {t("preview.tests")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.labResults.map((lr) => (
                    <tr
                      key={lr.fileName}
                      className="border-b border-neutral-100 dark:border-neutral-800"
                    >
                      <td className="py-2 pr-4">{lr.fileName}</td>
                      <td className="py-2 pr-4 tabular-nums">{lr.date}</td>
                      <td className="py-2 tabular-nums">{lr.testCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">{t("preview.noLabResults")}</p>
          )}

          {/* Conditions / Problem List preview */}
          <h3 className="mb-2 mt-4 text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {t("preview.problemList")}
          </h3>
          {preview.conditionCount > 0 ? (
            <p className="text-sm text-neutral-900 dark:text-neutral-50">
              {t("preview.conditionCount", { count: preview.conditionCount })}
            </p>
          ) : (
            <p className="text-sm text-neutral-400">{t("preview.noConditions")}</p>
          )}
        </Card>
      )}

      {/* Export buttons */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            disabled={!patientName.trim() || exporting}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {exporting ? t("export.exporting") : t("export.json")}
          </Button>
          <span className="hidden text-xs text-neutral-400 sm:inline-flex sm:items-center">
            {t("export.jsonDescription")}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExportPdf}
            disabled={!patientName.trim() || exporting}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {exporting ? t("export.exporting") : t("export.pdf")}
          </Button>
          <span className="hidden text-xs text-neutral-400 sm:inline-flex sm:items-center">
            {t("export.pdfDescription")}
          </span>
        </div>
      </Card>
    </div>
  );
}
