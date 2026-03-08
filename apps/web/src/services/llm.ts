/**
 * Client-side LLM prompt construction and query service.
 *
 * Computes health context from local IndexedDB data and sends
 * only aggregated summaries to the server's LLM proxy.
 * Raw health records never leave the device.
 */

import { METRICS, type MetricType } from "@health-app/shared";
import { db } from "@/db";

// --- Types ---

export interface LLMProfile {
  /** Age in whole years, derived from date of birth. Not the raw DOB. */
  age?: number;
  /** Biological sex label as the user selected it. */
  biologicalSex?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** The health context that was sent with this message (for transparency) */
  healthContext?: string;
  enhanced?: boolean;
}

export interface LLMQueryOptions {
  messages: { role: "user" | "assistant"; content: string }[];
  healthContext: string;
  enhanced?: boolean;
}

// --- Health context builders ---

/** Sex labels sent to the LLM (maps internal values to human-readable strings). */
const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  intersex: "Intersex",
};

/**
 * Build a standard-mode health context string from local data.
 * Only includes aggregated summaries — no raw records, no PII.
 */
export async function buildStandardContext(profile?: LLMProfile): Promise<string> {
  const lines: string[] = [];

  // Prepend profile header if any profile data is available
  const profileParts: string[] = [];
  if (profile?.age !== undefined) profileParts.push(`Age: ${profile.age}`);
  if (profile?.biologicalSex && profile.biologicalSex !== "prefer_not_to_say") {
    profileParts.push(`Sex: ${SEX_LABELS[profile.biologicalSex] ?? profile.biologicalSex}`);
  }
  if (profileParts.length > 0) {
    lines.push(`User profile: ${profileParts.join(", ")}`);
    lines.push("---");
  }
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const summaryMetrics: MetricType[] = [
    "step_count",
    "distance",
    "active_energy",
    "heart_rate",
    "resting_heart_rate",
    "hrv",
    "body_mass",
    "body_fat",
    "sleep_session",
    "oxygen_saturation",
    "respiratory_rate",
  ];

  for (const metricType of summaryMetrics) {
    const metric = METRICS[metricType];
    const weekData = await db.dailySummaries
      .where("[metricType+date]")
      .between([metricType, sevenDaysAgo], [metricType, today], true, true)
      .toArray();

    if (weekData.length === 0) continue;

    const field = metric.aggregation === "sum" ? "sum" : "avg";
    const values = weekData
      .map((d) => (field === "sum" ? d.sum : d.avg))
      .filter((v): v is number => v !== null);

    if (values.length === 0) continue;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Compute 30-day average for trend comparison
    const monthData = await db.dailySummaries
      .where("[metricType+date]")
      .between([metricType, thirtyDaysAgo], [metricType, today], true, true)
      .toArray();

    const monthValues = monthData
      .map((d) => (field === "sum" ? d.sum : d.avg))
      .filter((v): v is number => v !== null);

    let trendStr = "";
    if (monthValues.length >= 14) {
      const monthAvg = monthValues.reduce((a, b) => a + b, 0) / monthValues.length;
      if (monthAvg > 0) {
        const pctChange = ((avg - monthAvg) / monthAvg) * 100;
        if (Math.abs(pctChange) >= 2) {
          trendStr = ` (${pctChange > 0 ? "+" : ""}${pctChange.toFixed(1)}% vs 30-day avg)`;
        }
      }
    }

    lines.push(
      `${metric.label}: 7-day avg ${formatValue(avg, metricType)} ${metric.unit}, range ${formatValue(min, metricType)}–${formatValue(max, metricType)}${trendStr}`,
    );
  }

  // Add lab results summary (categories only, no values in standard mode)
  const labResults = await db.labResults.orderBy("date").reverse().limit(5).toArray();
  if (labResults.length > 0) {
    const categories = [...new Set(labResults.map((lr) => lr.category))];
    lines.push(
      `Recent lab work: ${categories.join(", ")} (${labResults.length} report${labResults.length > 1 ? "s" : ""})`,
    );
  }

  // Workout summary
  const workoutCount = await db.healthRecords
    .where("[metricType+startTime]")
    .between(["workout", new Date(Date.now() - 7 * 86400000)], ["workout", new Date()], true, true)
    .count();

  if (workoutCount > 0) {
    lines.push(`Workouts this week: ${workoutCount}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No health data available yet.";
}

/**
 * Build enhanced-mode health context with detailed data.
 * Includes lab values, daily breakdowns, etc.
 * Only used when user explicitly opts in.
 */
export async function buildEnhancedContext(profile?: LLMProfile): Promise<string> {
  // Start with standard context
  const standardLines: string[] = [];
  const standard = await buildStandardContext(profile);
  standardLines.push(standard);

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  // Add daily breakdowns for key metrics
  const detailMetrics: MetricType[] = [
    "step_count",
    "heart_rate",
    "resting_heart_rate",
    "sleep_session",
  ];

  const detailLines: string[] = ["\n--- Daily Breakdown (past 7 days) ---"];

  for (const metricType of detailMetrics) {
    const metric = METRICS[metricType];
    const weekData = await db.dailySummaries
      .where("[metricType+date]")
      .between([metricType, sevenDaysAgo], [metricType, today], true, true)
      .sortBy("date");

    if (weekData.length === 0) continue;

    const field = metric.aggregation === "sum" ? "sum" : "avg";
    const dayValues = weekData.map(
      (d) =>
        `${d.date}: ${formatValue((field === "sum" ? d.sum : d.avg) ?? 0, metricType)} ${metric.unit}`,
    );
    detailLines.push(`${metric.label}: ${dayValues.join(", ")}`);
  }

  if (detailLines.length > 1) {
    standardLines.push(detailLines.join("\n"));
  }

  // Add lab result values (the key difference from standard mode)
  const labResults = await db.labResults.orderBy("date").reverse().limit(3).toArray();
  if (labResults.length > 0) {
    standardLines.push("\n--- Lab Results ---");
    for (const lab of labResults) {
      standardLines.push(`\n${lab.category} (${lab.date}):`);
      for (const [testName, val] of Object.entries(lab.structuredValues)) {
        const sv = val as { value: number; unit: string; flag?: string; referenceRange?: string };
        let line = `  ${testName}: ${sv.value} ${sv.unit}`;
        if (sv.referenceRange) line += ` (ref: ${sv.referenceRange})`;
        if (sv.flag && sv.flag !== "normal") line += ` [${sv.flag.toUpperCase()}]`;
        standardLines.push(line);
      }
    }
  }

  return standardLines.join("\n");
}

/**
 * Format a numeric value for display in context.
 */
function formatValue(value: number, metricType: MetricType): string {
  if (metricType === "distance") return value.toFixed(2);
  if (metricType === "body_fat" || metricType === "oxygen_saturation") return value.toFixed(1);
  if (metricType === "body_mass") return value.toFixed(1);
  if (metricType === "hrv") return value.toFixed(0);
  return Math.round(value).toLocaleString("en-US");
}

// --- API interaction ---

// In dev, use a relative URL so requests go through the Vite proxy (avoids CORS).
// In production builds, VITE_API_URL should point to the deployed server.
const API_BASE =
  import.meta.env.DEV ? "" : (import.meta.env.VITE_API_URL ?? "");

/**
 * Stream an LLM query to the server and yield text chunks.
 */
export async function* streamLLMQuery(
  options: LLMQueryOptions,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/llm/query`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: options.messages,
      healthContext: options.healthContext,
      enhanced: options.enhanced,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? err.title ?? "LLM request failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data) as { text?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) yield parsed.text;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
}

/**
 * Generate a short plain-text summary of a clinical concept (condition or allergen).
 *
 * Uses the SNOMED CT preferred term and code to ask the LLM for a concise, plain-language
 * paragraph explaining the concept. The result is stored in IndexedDB so it is never
 * re-fetched on subsequent page loads.
 *
 * Returns the summary string, or throws if the request fails.
 */
export async function generateConceptSummary(
  snomedCode: string,
  snomedDisplay: string,
  conceptType: "condition" | "allergen",
): Promise<string> {
  const typeLabel = conceptType === "condition" ? "clinical condition" : "allergen or allergic condition";
  const prompt =
    `Summarise the ${typeLabel} identified by SNOMED CT code ${snomedCode} — preferred term: "${snomedDisplay}".\n\n` +
    `Write 2–3 plain-language sentences suitable for a patient's personal health record. ` +
    `Cover what the concept is, how it typically presents, and any important patient-facing considerations but do not make the information too overwhelming. ` +
    `Base the summary strictly on this specific SNOMED CT concept (code ${snomedCode}, "${snomedDisplay}") — do not generalise to related conditions. ` +
    `Do not give treatment recommendations. Keep the tone factual and educational.`;

  const res = await fetch(`${API_BASE}/api/llm/query`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      healthContext: "",
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? err.title ?? "LLM request failed");
  }

  // The server streams SSE even for single-turn queries — collect all text chunks.
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data) as { text?: string; error?: string };
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) fullText += parsed.text;
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  return fullText.trim();
}

/**
 * Generate a unique message ID.
 */
export function createMessageId(): string {
  return crypto.randomUUID();
}
