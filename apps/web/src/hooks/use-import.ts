/**
 * React hooks for health data import workflows.
 *
 * - useImport: manages import state, progress, and file handling
 * - useImportHistory: reads import history from IndexedDB
 */

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";
import { db } from "@/db";
import {
  type ImportPhase,
  type ImportProgress,
  importAppleHealthFile,
  importHealthConnectFile,
} from "@/services/import";

export interface ImportState {
  isImporting: boolean;
  phase: ImportPhase;
  recordsParsed: number;
  recordsStored: number;
  totalRecords: number;
  summariesComputed: number;
  error: string | null;
  fileName: string | null;
}

const initialState: ImportState = {
  isImporting: false,
  phase: "idle",
  recordsParsed: 0,
  recordsStored: 0,
  totalRecords: 0,
  summariesComputed: 0,
  error: null,
  fileName: null,
};

export function useImport() {
  const [state, setState] = useState<ImportState>(initialState);

  const startImport = useCallback(async (file: File) => {
    setState({
      isImporting: true,
      phase: "reading_zip",
      recordsParsed: 0,
      recordsStored: 0,
      totalRecords: 0,
      summariesComputed: 0,
      error: null,
      fileName: file.name,
    });

    try {
      const result = await importAppleHealthFile(file, (progress: ImportProgress) => {
        setState((prev) => ({
          ...prev,
          phase: progress.phase,
          recordsParsed: progress.recordsParsed,
          recordsStored: progress.recordsStored,
          totalRecords: progress.totalRecords,
          summariesComputed: progress.summariesComputed,
          error: progress.error ?? null,
        }));
      });

      setState((prev) => ({
        ...prev,
        isImporting: false,
        phase: "complete",
        totalRecords: result.recordCount,
        recordsStored: result.recordCount,
      }));

      return result;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isImporting: false,
        phase: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
      throw err;
    }
  }, []);

  const startHealthConnectImport = useCallback(async (file: File) => {
    setState({
      isImporting: true,
      phase: "parsing",
      recordsParsed: 0,
      recordsStored: 0,
      totalRecords: 0,
      summariesComputed: 0,
      error: null,
      fileName: file.name,
    });

    try {
      const result = await importHealthConnectFile(file, (progress: ImportProgress) => {
        setState((prev) => ({
          ...prev,
          phase: progress.phase,
          recordsParsed: progress.recordsParsed,
          recordsStored: progress.recordsStored,
          totalRecords: progress.totalRecords,
          summariesComputed: progress.summariesComputed,
          error: progress.error ?? null,
        }));
      });

      setState((prev) => ({
        ...prev,
        isImporting: false,
        phase: "complete",
        totalRecords: result.recordCount,
        recordsStored: result.recordCount,
      }));

      return result;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isImporting: false,
        phase: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { ...state, startImport, startHealthConnectImport, reset };
}

/**
 * Live query that watches the imports table for changes.
 * Returns import history sorted by most recent first.
 */
export function useImportHistory() {
  const imports = useLiveQuery(() => db.imports.orderBy("startedAt").reverse().toArray(), []);

  return {
    imports: imports ?? [],
    isLoading: imports === undefined,
  };
}
