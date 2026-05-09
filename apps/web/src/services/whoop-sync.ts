/**
 * Whoop Integration Service
 *
 * Handles PKCE OAuth flow, token management, API fetching, and normalization
 * of Whoop data into IndexedDB. No health data is sent to the app server —
 * the browser talks directly to the Whoop API.
 */

import { WHOOP_SCORED_STATES, WHOOP_SPORT_MAP } from "@health-app/shared";
import { computeDailySummaries } from "@/services/aggregate";
import { db, type HealthRecordRow } from "@/db";

// --- Whoop OAuth endpoints & config ---

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";
const WHOOP_SCOPES =
  "read:recovery read:sleep read:workout read:cycles read:body_measurement read:profile offline";

// --- localStorage keys ---

const SK_CLIENT_ID = "whoop_client_id";
const SK_CLIENT_SECRET = "whoop_client_secret";
const SK_TOKENS = "whoop_tokens";
const SK_CODE_VERIFIER = "whoop_pkce_verifier";
const SK_OAUTH_STATE = "whoop_oauth_state";
const SK_LAST_SYNC = "whoop_last_sync";

// --- Types ---

interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms timestamp
  token_type: string;
}

interface WhoopRecovery {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score?: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage: number;
    skin_temp_celsius: number;
  };
}

interface WhoopSleep {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score?: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
    respiratory_rate: number;
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  };
}

interface WhoopWorkout {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  sport_id: number;
  score_state: string;
  score?: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    percent_recorded: number;
    distance_meter: number;
    altitude_gain_meter: number;
    altitude_change_meter: number;
    zone_duration: {
      zone_zero_milli: number;
      zone_one_milli: number;
      zone_two_milli: number;
      zone_three_milli: number;
      zone_four_milli: number;
      zone_five_milli: number;
    };
  };
}

interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  score_state: string;
  score?: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

interface WhoopBodyMeasurement {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

interface WhoopPagedResponse<T> {
  records: T[];
  next_token?: string;
}

// --- Connection status ---

export interface WhoopConnection {
  connected: boolean;
  clientId: string | null;
}

export function getWhoopConnection(): WhoopConnection {
  return {
    connected: !!getTokens(),
    clientId: localStorage.getItem(SK_CLIENT_ID),
  };
}

export function getStoredClientId(): string | null {
  return localStorage.getItem(SK_CLIENT_ID);
}

export function getStoredClientSecret(): string | null {
  return localStorage.getItem(SK_CLIENT_SECRET);
}

export function isWhoopConnected(): boolean {
  return !!getTokens();
}

export function getLastSyncTime(): Date | null {
  const val = localStorage.getItem(SK_LAST_SYNC);
  return val ? new Date(Number(val)) : null;
}

// --- Token storage ---

function getTokens(): WhoopTokens | null {
  const raw = localStorage.getItem(SK_TOKENS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WhoopTokens;
  } catch {
    return null;
  }
}

function saveTokens(tokens: WhoopTokens): void {
  localStorage.setItem(SK_TOKENS, JSON.stringify(tokens));
}

export function disconnectWhoop(): void {
  localStorage.removeItem(SK_TOKENS);
  localStorage.removeItem(SK_CLIENT_ID);
  localStorage.removeItem(SK_CLIENT_SECRET);
  localStorage.removeItem(SK_LAST_SYNC);
}

// --- PKCE helpers ---

function base64UrlEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return base64UrlEncode(buf);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

// --- OAuth flow ---

export async function initiateWhoopAuth(clientId: string, clientSecret?: string): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));

  localStorage.setItem(SK_CLIENT_ID, clientId);
  if (clientSecret) localStorage.setItem(SK_CLIENT_SECRET, clientSecret);
  else localStorage.removeItem(SK_CLIENT_SECRET);

  localStorage.setItem(SK_CODE_VERIFIER, verifier);
  localStorage.setItem(SK_OAUTH_STATE, state);

  const redirectUri = `${window.location.origin}/whoop/callback`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: WHOOP_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.href = `${WHOOP_AUTH_URL}?${params.toString()}`;
}

export async function handleWhoopCallback(code: string, returnedState: string): Promise<void> {
  const storedState = localStorage.getItem(SK_OAUTH_STATE);
  const verifier = localStorage.getItem(SK_CODE_VERIFIER);
  const clientId = localStorage.getItem(SK_CLIENT_ID);
  const clientSecret = localStorage.getItem(SK_CLIENT_SECRET);

  localStorage.removeItem(SK_OAUTH_STATE);
  localStorage.removeItem(SK_CODE_VERIFIER);

  if (!storedState || returnedState !== storedState) {
    throw new Error("OAuth state mismatch — possible CSRF attack");
  }
  if (!verifier || !clientId) {
    throw new Error("Missing PKCE verifier or client ID");
  }

  const redirectUri = `${window.location.origin}/whoop/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
  });
}

async function refreshAccessToken(): Promise<string> {
  const tokens = getTokens();
  const clientId = localStorage.getItem(SK_CLIENT_ID);
  const clientSecret = localStorage.getItem(SK_CLIENT_SECRET);

  if (!tokens || !clientId) throw new Error("Not connected to Whoop");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: clientId,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    disconnectWhoop();
    throw new Error("Token refresh failed — please reconnect Whoop");
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  const updated: WhoopTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
  };
  saveTokens(updated);
  return updated.access_token;
}

async function ensureValidToken(): Promise<string> {
  const tokens = getTokens();
  if (!tokens) throw new Error("Not connected to Whoop");
  // Refresh 60 seconds before expiry
  if (Date.now() >= tokens.expires_at - 60_000) {
    return refreshAccessToken();
  }
  return tokens.access_token;
}

// --- API helpers ---

async function whoopGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await ensureValidToken();
  const url = new URL(`${WHOOP_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whoop API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<T>;
}

async function fetchAllPages<T>(
  path: string,
  extraParams: Record<string, string> = {},
): Promise<T[]> {
  const all: T[] = [];
  let nextToken: string | undefined;

  do {
    const params: Record<string, string> = { limit: "25", ...extraParams };
    if (nextToken) params.nextToken = nextToken;

    const page = await whoopGet<WhoopPagedResponse<T>>(path, params);
    all.push(...page.records);
    nextToken = page.next_token;
  } while (nextToken);

  return all;
}

// --- ID generation (deterministic, same pattern as normalize.ts) ---

async function makeId(
  metricType: string,
  startTime: string,
  endTime: string,
  value: number | null,
  sourceType: string,
): Promise<string> {
  const input = `${metricType}|${startTime}|${endTime}|${value ?? "null"}|whoop|${sourceType}`;
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

// --- Normalization ---

async function normalizeRecovery(
  records: WhoopRecovery[],
  importId: string,
): Promise<HealthRecordRow[]> {
  const rows: HealthRecordRow[] = [];

  for (const r of records) {
    if (!WHOOP_SCORED_STATES.has(r.score_state) || !r.score) continue;
    const { score } = r;
    const ts = r.created_at;
    const dateStr = ts.slice(0, 10);
    const dayStart = `${dateStr}T00:00:00.000Z`;
    const dayEnd = `${dateStr}T23:59:59.999Z`;

    const push = async (
      metricType: string,
      value: number,
      unit: string,
      sourceType: string,
    ) => {
      rows.push({
        id: await makeId(metricType, dayStart, dayEnd, value, sourceType),
        metricType,
        value,
        unit,
        startTime: new Date(dayStart),
        endTime: new Date(dayEnd),
        sourcePlatform: "whoop",
        sourceDevice: "Whoop",
        sourceType,
        importId,
        metadata: { cycle_id: r.cycle_id },
      });
    };

    await push("recovery_score", score.recovery_score, "%", "whoop_recovery");
    await push("resting_heart_rate", score.resting_heart_rate, "bpm", "whoop_recovery_rhr");
    await push("hrv", score.hrv_rmssd_milli, "ms", "whoop_recovery_hrv");
    if (score.spo2_percentage > 0) {
      await push("oxygen_saturation", score.spo2_percentage, "%", "whoop_recovery_spo2");
    }
  }

  return rows;
}

async function normalizeSleep(
  records: WhoopSleep[],
  importId: string,
): Promise<HealthRecordRow[]> {
  const rows: HealthRecordRow[] = [];

  for (const r of records) {
    if (r.nap) continue; // skip naps
    if (!WHOOP_SCORED_STATES.has(r.score_state) || !r.score) continue;

    const { score } = r;
    const startTime = new Date(r.start);
    const endTime = new Date(r.end);

    const sleepMs =
      score.stage_summary.total_in_bed_time_milli -
      score.stage_summary.total_awake_time_milli -
      score.stage_summary.total_no_data_time_milli;
    const sleepHours = Math.max(0, sleepMs) / 3_600_000;

    const sleepId = await makeId(
      "sleep_session",
      r.start,
      r.end,
      sleepHours,
      "whoop_sleep",
    );

    rows.push({
      id: sleepId,
      metricType: "sleep_session",
      value: sleepHours,
      unit: "hr",
      startTime,
      endTime,
      sourcePlatform: "whoop",
      sourceDevice: "Whoop",
      sourceType: "whoop_sleep",
      importId,
      metadata: {
        sleep_id: r.id,
        stage_summary: score.stage_summary,
        sleep_performance_percentage: score.sleep_performance_percentage,
        sleep_efficiency_percentage: score.sleep_efficiency_percentage,
      },
    });

    if (score.respiratory_rate > 0) {
      const rrId = await makeId(
        "respiratory_rate",
        r.start,
        r.end,
        score.respiratory_rate,
        "whoop_sleep_rr",
      );
      rows.push({
        id: rrId,
        metricType: "respiratory_rate",
        value: score.respiratory_rate,
        unit: "breaths/min",
        startTime,
        endTime,
        sourcePlatform: "whoop",
        sourceDevice: "Whoop",
        sourceType: "whoop_sleep_rr",
        importId,
        metadata: { sleep_id: r.id },
      });
    }
  }

  return rows;
}

async function normalizeWorkouts(
  records: WhoopWorkout[],
  importId: string,
): Promise<HealthRecordRow[]> {
  const rows: HealthRecordRow[] = [];

  for (const r of records) {
    if (!WHOOP_SCORED_STATES.has(r.score_state) || !r.score) continue;

    const startTime = new Date(r.start);
    const endTime = new Date(r.end);
    const durationMin = (endTime.getTime() - startTime.getTime()) / 60_000;

    const sportLabel = WHOOP_SPORT_MAP[r.sport_id] ?? "other";
    const id = await makeId("workout", r.start, r.end, durationMin, `whoop_workout_${r.id}`);

    rows.push({
      id,
      metricType: "workout",
      value: durationMin,
      unit: "min",
      startTime,
      endTime,
      sourcePlatform: "whoop",
      sourceDevice: "Whoop",
      sourceType: sportLabel,
      importId,
      metadata: {
        workout_id: r.id,
        sport_id: r.sport_id,
        strain: r.score.strain,
        kilojoule: r.score.kilojoule,
        avg_hr: r.score.average_heart_rate,
        max_hr: r.score.max_heart_rate,
        distance_m: r.score.distance_meter,
        zone_duration: r.score.zone_duration,
      },
    });
  }

  return rows;
}

async function normalizeCycles(
  records: WhoopCycle[],
  importId: string,
): Promise<HealthRecordRow[]> {
  const rows: HealthRecordRow[] = [];

  for (const r of records) {
    if (!WHOOP_SCORED_STATES.has(r.score_state) || !r.score) continue;

    const startTime = new Date(r.start);
    const endTime = new Date(r.end);

    const strainId = await makeId("strain_score", r.start, r.end, r.score.strain, `whoop_cycle_${r.id}`);
    rows.push({
      id: strainId,
      metricType: "strain_score",
      value: r.score.strain,
      unit: "score",
      startTime,
      endTime,
      sourcePlatform: "whoop",
      sourceDevice: "Whoop",
      sourceType: "whoop_cycle",
      importId,
      metadata: { cycle_id: r.id },
    });

    if (r.score.kilojoule > 0) {
      const kcal = r.score.kilojoule * 0.239006;
      const energyId = await makeId("active_energy", r.start, r.end, kcal, `whoop_cycle_energy_${r.id}`);
      rows.push({
        id: energyId,
        metricType: "active_energy",
        value: kcal,
        unit: "kcal",
        startTime,
        endTime,
        sourcePlatform: "whoop",
        sourceDevice: "Whoop",
        sourceType: "whoop_cycle_energy",
        importId,
        metadata: { cycle_id: r.id },
      });
    }
  }

  return rows;
}

async function normalizeBodyMeasurement(
  body: WhoopBodyMeasurement,
  importId: string,
): Promise<HealthRecordRow[]> {
  const rows: HealthRecordRow[] = [];
  const now = new Date().toISOString();

  if (body.weight_kilogram > 0) {
    rows.push({
      id: await makeId("body_mass", now, now, body.weight_kilogram, "whoop_body"),
      metricType: "body_mass",
      value: body.weight_kilogram,
      unit: "kg",
      startTime: new Date(now),
      endTime: new Date(now),
      sourcePlatform: "whoop",
      sourceDevice: "Whoop",
      sourceType: "whoop_body",
      importId,
    });
  }

  return rows;
}

// --- Main sync function ---

export interface WhoopSyncProgress {
  phase: "recovery" | "sleep" | "workouts" | "cycles" | "body" | "storing" | "done" | "error";
  recordCount: number;
  error?: string;
}

export async function syncWhoopData(
  onProgress: (p: WhoopSyncProgress) => void,
): Promise<number> {
  const importId = crypto.randomUUID();
  const lastSync = getLastSyncTime();
  const sinceParams: Record<string, string> = lastSync
    ? { start: lastSync.toISOString() }
    : {};

  const importRow = {
    id: importId,
    platform: "whoop" as const,
    fileName: `Whoop sync ${new Date().toLocaleDateString()}`,
    exportDate: new Date().toISOString().slice(0, 10),
    startedAt: new Date(),
    completedAt: null,
    recordCount: 0,
    status: "processing" as const,
    progressPct: 0,
    dateRange: null,
  };

  await db.imports.add(importRow);

  try {
    const allRows: HealthRecordRow[] = [];

    onProgress({ phase: "recovery", recordCount: 0 });
    const recoveries = await fetchAllPages<WhoopRecovery>("/recovery", sinceParams);
    allRows.push(...(await normalizeRecovery(recoveries, importId)));

    onProgress({ phase: "sleep", recordCount: allRows.length });
    const sleeps = await fetchAllPages<WhoopSleep>("/sleep", sinceParams);
    allRows.push(...(await normalizeSleep(sleeps, importId)));

    onProgress({ phase: "workouts", recordCount: allRows.length });
    const workouts = await fetchAllPages<WhoopWorkout>("/workout", sinceParams);
    allRows.push(...(await normalizeWorkouts(workouts, importId)));

    onProgress({ phase: "cycles", recordCount: allRows.length });
    const cycles = await fetchAllPages<WhoopCycle>("/cycle", sinceParams);
    allRows.push(...(await normalizeCycles(cycles, importId)));

    onProgress({ phase: "body", recordCount: allRows.length });
    const body = await whoopGet<WhoopBodyMeasurement>("/body_measurement");
    allRows.push(...(await normalizeBodyMeasurement(body, importId)));

    onProgress({ phase: "storing", recordCount: allRows.length });
    if (allRows.length > 0) {
      await db.healthRecords.bulkPut(allRows);
      await computeDailySummaries(importId);
    }

    const earliest = allRows.reduce<Date | null>(
      (min, r) => (!min || r.startTime < min ? r.startTime : min),
      null,
    );
    const latest = allRows.reduce<Date | null>(
      (max, r) => (!max || r.startTime > max ? r.startTime : max),
      null,
    );

    await db.imports.update(importId, {
      completedAt: new Date(),
      recordCount: allRows.length,
      status: "completed",
      progressPct: 100,
      dateRange: earliest && latest ? { earliest, latest } : null,
    });

    localStorage.setItem(SK_LAST_SYNC, String(Date.now()));
    onProgress({ phase: "done", recordCount: allRows.length });
    return allRows.length;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db.imports.update(importId, { status: "failed", completedAt: new Date() });
    onProgress({ phase: "error", recordCount: 0, error: message });
    throw err;
  }
}
