import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertCircle,
  Bot,
  Check,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import type { AllergyRow } from "@/db";
import { db } from "@/db";
import { generateConceptSummary } from "@/services/llm";
import {
  getFhirTerminologyUrl,
  type SnomedConcept,
  searchSnomedSubstances,
} from "@/services/snomed";

export const Route = createFileRoute("/_app/allergies")({
  component: AllergiesPage,
});

const inputClassName =
  "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50";

const selectClassName =
  "rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50";

function AllergiesPage() {
  const { t } = useTranslation("allergies");

  const allergies = useLiveQuery(
    () => db.allergies.orderBy("createdAt").reverse().toArray(),
    [],
  );

  const [showForm, setShowForm] = useState(false);

  const handleDelete = useCallback(async (id: string) => {
    await db.allergies.delete(id);
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
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
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

      {/* Add new allergy */}
      {showForm ? (
        <Card className="mb-6">
          <AddAllergyForm onAdded={handleAdded} onCancel={() => setShowForm(false)} />
        </Card>
      ) : (
        <div className="mb-6">
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("addAllergy")}
          </Button>
        </div>
      )}

      {/* Allergies list */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">{t("yourAllergies")}</h2>
        {allergies && allergies.length > 0 ? (
          <div className="space-y-3">
            {allergies.map((allergy) => (
              <AllergyCard key={allergy.id} allergy={allergy} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">{t("noAllergies")}</p>
        )}
      </Card>

      {/* FHIR server info */}
      <div className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
        {t("fhirServer")}: {getFhirTerminologyUrl()}
      </div>
    </div>
  );
}

// --- Add Allergy Form ---

function AddAllergyForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const { t } = useTranslation("allergies");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SnomedConcept[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<SnomedConcept | null>(null);
  const [type, setType] = useState<"allergy" | "intolerance">("allergy");
  const [category, setCategory] = useState<"food" | "medication" | "environment" | "biologic">(
    "food",
  );
  const [criticality, setCriticality] = useState<"low" | "high" | "unable-to-assess">("low");
  const [reaction, setReaction] = useState("");
  const [onsetDate, setOnsetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (selectedConcept) return;

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
        const result = await searchSnomedSubstances(searchQuery);
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
        const id = crypto.randomUUID();
        const allergy: AllergyRow = {
          id,
          snomedCode: selectedConcept.code,
          snomedDisplay: selectedConcept.display,
          type,
          category,
          criticality,
          reaction: reaction.trim() || undefined,
          onsetDate: onsetDate || undefined,
          notes: notes.trim() || undefined,
          createdAt: new Date(),
        };

        await db.allergies.add(allergy);
        onAdded(); // close form immediately

        // Generate AI summary in background — update record when done
        generateConceptSummary(selectedConcept.code, selectedConcept.display, "allergen")
          .then((summary) => db.allergies.update(id, { aiSummary: summary }))
          .catch(() => {
            // Silently swallow errors — the card simply won't show a summary
          });
      } finally {
        setSaving(false);
      }
    },
    [selectedConcept, type, category, criticality, reaction, onsetDate, notes, onAdded],
  );

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="mb-4 text-lg font-semibold">{t("form.title")}</h3>

      {/* SNOMED CT search */}
      <div className="relative mb-4" ref={resultsRef}>
        <label htmlFor="allergy-search" className="mb-1 block text-sm font-medium">
          {t("form.searchLabel")}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            id="allergy-search"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (selectedConcept) setSelectedConcept(null);
            }}
            onFocus={() => {
              if (searchResults.length > 0 && !selectedConcept) setShowResults(true);
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
          <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm dark:border-rose-800 dark:bg-rose-950">
            <Check className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            <span className="font-medium text-rose-900 dark:text-rose-100">
              {selectedConcept.display}
            </span>
            <span className="text-xs text-rose-500">SNOMED CT: {selectedConcept.code}</span>
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

      {/* Type */}
      <div className="mb-4">
        <label htmlFor="allergy-type" className="mb-1 block text-sm font-medium">
          {t("form.type")}
        </label>
        <select
          id="allergy-type"
          value={type}
          onChange={(e) => setType(e.target.value as "allergy" | "intolerance")}
          className={selectClassName}
        >
          <option value="allergy">{t("form.typeAllergy")}</option>
          <option value="intolerance">{t("form.typeIntolerance")}</option>
        </select>
      </div>

      {/* Category */}
      <div className="mb-4">
        <label htmlFor="allergy-category" className="mb-1 block text-sm font-medium">
          {t("form.category")}
        </label>
        <select
          id="allergy-category"
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as "food" | "medication" | "environment" | "biologic")
          }
          className={selectClassName}
        >
          <option value="food">{t("form.categoryFood")}</option>
          <option value="medication">{t("form.categoryMedication")}</option>
          <option value="environment">{t("form.categoryEnvironment")}</option>
          <option value="biologic">{t("form.categoryBiologic")}</option>
        </select>
      </div>

      {/* Criticality */}
      <div className="mb-4">
        <label htmlFor="allergy-criticality" className="mb-1 block text-sm font-medium">
          {t("form.criticality")}
        </label>
        <select
          id="allergy-criticality"
          value={criticality}
          onChange={(e) =>
            setCriticality(e.target.value as "low" | "high" | "unable-to-assess")
          }
          className={selectClassName}
        >
          <option value="low">{t("form.criticalityLow")}</option>
          <option value="high">{t("form.criticalityHigh")}</option>
          <option value="unable-to-assess">{t("form.criticalityUnableToAssess")}</option>
        </select>
      </div>

      {/* Reaction */}
      <div className="mb-4">
        <label htmlFor="allergy-reaction" className="mb-1 block text-sm font-medium">
          {t("form.reaction")}
        </label>
        <input
          id="allergy-reaction"
          type="text"
          value={reaction}
          onChange={(e) => setReaction(e.target.value)}
          placeholder={t("form.reactionPlaceholder")}
          className={`${inputClassName} max-w-sm`}
        />
      </div>

      {/* Onset date */}
      <div className="mb-4">
        <label htmlFor="allergy-onset" className="mb-1 block text-sm font-medium">
          {t("form.onsetDate")}
        </label>
        <input
          id="allergy-onset"
          type="date"
          value={onsetDate}
          onChange={(e) => setOnsetDate(e.target.value)}
          className={`${inputClassName} max-w-xs`}
        />
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label htmlFor="allergy-notes" className="mb-1 block text-sm font-medium">
          {t("form.notes")}
        </label>
        <textarea
          id="allergy-notes"
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

// --- Allergy Card ---

const criticalityColors: Record<string, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400",
  low: "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400",
  "unable-to-assess":
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
};

function AllergyCard({
  allergy,
  onDelete,
}: {
  allergy: AllergyRow;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation("allergies");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isGeneratingSummary = allergy.aiSummary === undefined;

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              {allergy.snomedDisplay}
            </h3>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${criticalityColors[allergy.criticality] ?? criticalityColors.low}`}
            >
              {t(`criticality.${allergy.criticality}`)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
            <span>SNOMED CT: {allergy.snomedCode}</span>
            <span>
              {t("card.type")}: {t(`type.${allergy.type}`)}
            </span>
            <span>
              {t("card.category")}: {t(`category.${allergy.category}`)}
            </span>
            {allergy.onsetDate && (
              <span>
                {t("card.onset")}: {allergy.onsetDate}
              </span>
            )}
            <span>
              {t("card.added")}: {allergy.createdAt.toLocaleDateString()}
            </span>
          </div>

          {/* AI summary */}
          {isGeneratingSummary ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
              <Bot className="h-3.5 w-3.5 shrink-0" />
              <span>{t("card.generatingSummary")}</span>
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : allergy.aiSummary ? (
            <div className="mt-2 flex items-start gap-1.5">
              <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400 dark:text-rose-500" />
              <Markdown size="compact">{allergy.aiSummary}</Markdown>
            </div>
          ) : null}

          {allergy.reaction && (
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              {t("card.reaction")}: {allergy.reaction}
            </p>
          )}
          {allergy.notes && (
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{allergy.notes}</p>
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
                onClick={() => onDelete(allergy.id)}
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
