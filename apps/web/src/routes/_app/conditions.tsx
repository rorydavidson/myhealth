import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertCircle,
  Check,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClinicalConditionRow } from "@/db";
import { db } from "@/db";
import {
  getFhirTerminologyUrl,
  type SnomedConcept,
  searchSnomedConditions,
} from "@/services/snomed";

export const Route = createFileRoute("/_app/conditions")({
  component: ConditionsPage,
});

const inputClassName =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50";

const selectClassName =
  "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50";

function ConditionsPage() {
  const { t } = useTranslation("conditions");

  const conditions = useLiveQuery(
    () => db.clinicalConditions.orderBy("createdAt").reverse().toArray(),
    [],
  );

  const [showForm, setShowForm] = useState(false);

  const handleDelete = useCallback(async (id: string) => {
    await db.clinicalConditions.delete(id);
  }, []);

  const handleAdded = useCallback(() => {
    setShowForm(false);
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>

      {/* Info card */}
      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
          <div>
            <h2 className="mb-1 text-sm font-semibold">{t("description")}</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("descriptionDetail")}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{t("privacy")}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Add new condition */}
      {showForm ? (
        <Card className="mb-6">
          <AddConditionForm onAdded={handleAdded} onCancel={() => setShowForm(false)} />
        </Card>
      ) : (
        <div className="mb-6">
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("addCondition")}
          </Button>
        </div>
      )}

      {/* Conditions list */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t("yourConditions")}</h2>
        {conditions && conditions.length > 0 ? (
          <div className="space-y-3">
            {conditions.map((condition) => (
              <ConditionCard key={condition.id} condition={condition} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">{t("noConditions")}</p>
        )}
      </Card>

      {/* FHIR server info */}
      <div className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
        {t("fhirServer")}: {getFhirTerminologyUrl()}
      </div>
    </div>
  );
}

// --- Add Condition Form ---

function AddConditionForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const { t } = useTranslation("conditions");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SnomedConcept[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<SnomedConcept | null>(null);
  const [onsetDate, setOnsetDate] = useState("");
  const [status, setStatus] = useState<"active" | "resolved" | "inactive">("active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (selectedConcept) return; // Don't search if already selected

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setSearchError(null);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const result = await searchSnomedConditions(searchQuery);
        setSearchResults(result.concepts);
        setShowResults(true);
      } catch {
        setSearchError(t("form.searchError"));
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, selectedConcept, t]);

  // Close results on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectConcept = useCallback((concept: SnomedConcept) => {
    setSelectedConcept(concept);
    setSearchQuery(concept.display);
    setShowResults(false);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedConcept(null);
    setSearchQuery("");
    setSearchResults([]);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedConcept) return;

      setSaving(true);
      try {
        const condition: ClinicalConditionRow = {
          id: crypto.randomUUID(),
          description: selectedConcept.display,
          snomedCode: selectedConcept.code,
          snomedDisplay: selectedConcept.display,
          onsetDate: onsetDate || undefined,
          status,
          notes: notes.trim() || undefined,
          createdAt: new Date(),
        };

        await db.clinicalConditions.add(condition);
        onAdded();
      } finally {
        setSaving(false);
      }
    },
    [selectedConcept, onsetDate, status, notes, onAdded],
  );

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="mb-4 text-lg font-semibold">{t("form.title")}</h3>

      {/* SNOMED CT search */}
      <div className="relative mb-4" ref={resultsRef}>
        <label htmlFor="condition-search" className="mb-1 block text-sm font-medium">
          {t("form.searchLabel")}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            id="condition-search"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (selectedConcept) {
                setSelectedConcept(null);
              }
            }}
            onFocus={() => {
              if (searchResults.length > 0 && !selectedConcept) {
                setShowResults(true);
              }
            }}
            placeholder={t("form.searchPlaceholder")}
            className={`${inputClassName} pl-9 pr-9`}
            autoComplete="off"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-neutral-400" />
          )}
          {selectedConcept && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Selected concept badge */}
        {selectedConcept && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm dark:border-violet-800 dark:bg-violet-950">
            <Check className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            <span className="font-medium text-violet-900 dark:text-violet-100">
              {selectedConcept.display}
            </span>
            <span className="text-xs text-violet-500">SNOMED CT: {selectedConcept.code}</span>
          </div>
        )}

        {/* Search results dropdown */}
        {showResults && searchResults.length > 0 && !selectedConcept && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
            {searchResults.map((concept) => (
              <button
                type="button"
                key={concept.code}
                onClick={() => handleSelectConcept(concept)}
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                    {concept.display}
                  </div>
                  {concept.matchedSynonym && (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      Also known as: {concept.matchedSynonym}
                    </div>
                  )}
                  <div className="text-xs text-neutral-400">{concept.code}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {showResults &&
          searchResults.length === 0 &&
          !searching &&
          searchQuery.trim().length >= 2 &&
          !selectedConcept && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-400 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
              {t("form.noResults")}
            </div>
          )}

        {/* Search error */}
        {searchError && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-500">
            <AlertCircle className="h-3.5 w-3.5" />
            {searchError}
          </div>
        )}

        <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">
          {t("form.searchHint")}
        </p>
      </div>

      {/* Onset date */}
      <div className="mb-4">
        <label htmlFor="onset-date" className="mb-1 block text-sm font-medium">
          {t("form.onsetDate")}
        </label>
        <input
          id="onset-date"
          type="date"
          value={onsetDate}
          onChange={(e) => setOnsetDate(e.target.value)}
          className={`${inputClassName} max-w-xs`}
        />
        <p className="mt-1 text-xs text-neutral-400">{t("form.onsetDateHint")}</p>
      </div>

      {/* Status */}
      <div className="mb-4">
        <label htmlFor="condition-status" className="mb-1 block text-sm font-medium">
          {t("form.status")}
        </label>
        <select
          id="condition-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as "active" | "resolved" | "inactive")}
          className={selectClassName}
        >
          <option value="active">{t("form.statusActive")}</option>
          <option value="resolved">{t("form.statusResolved")}</option>
          <option value="inactive">{t("form.statusInactive")}</option>
        </select>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label htmlFor="condition-notes" className="mb-1 block text-sm font-medium">
          {t("form.notes")}
        </label>
        <textarea
          id="condition-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("form.notesPlaceholder")}
          rows={3}
          className={`${inputClassName} resize-none`}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" size="sm" disabled={!selectedConcept || saving}>
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {t("form.saving")}
            </>
          ) : (
            <>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t("form.save")}
            </>
          )}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          {t("form.cancel")}
        </Button>
      </div>
    </form>
  );
}

// --- Condition Card ---

const statusColors: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
  resolved:
    "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
  inactive:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
};

function ConditionCard({
  condition,
  onDelete,
}: {
  condition: ClinicalConditionRow;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation("conditions");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              {condition.snomedDisplay}
            </h3>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[condition.status] ?? statusColors.active}`}
            >
              {t(`status.${condition.status}`)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
            <span>SNOMED CT: {condition.snomedCode}</span>
            {condition.onsetDate && (
              <span>
                {t("card.onset")}: {condition.onsetDate}
              </span>
            )}
            <span>
              {t("card.added")}: {condition.createdAt.toLocaleDateString()}
            </span>
          </div>
          {condition.notes && (
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{condition.notes}</p>
          )}
        </div>
        <div>
          {showDeleteConfirm ? (
            <div className="flex gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                className="h-7 px-2 text-xs"
              >
                {t("form.cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onDelete(condition.id)}
                className="h-7 bg-rose-600 px-2 text-xs text-white hover:bg-rose-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-rose-500 dark:hover:bg-neutral-800 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
