#!/usr/bin/env node
/**
 * Generates a synthetic Google Health Connect JSON export for demo and testing.
 * Covers February 2026 (28 days) with realistic variation across all
 * metric types the app supports.
 *
 * The output uses the typed-arrays format that the Health Connect parser handles:
 *   { StepsRecord: [...], HeartRateRecord: [...], ... }
 * Each key ending in "Record" is a recognised record type.
 *
 * Usage: node generate.js > export.json
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simple seeded PRNG (mulberry32) so output is deterministic. */
function makePrng(seed) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makePrng(42);

function rnd(min, max) {
  return min + rand() * (max - min);
}
function rndInt(min, max) {
  return Math.round(rnd(min, max));
}

function isWeekend(d) {
  return d.getDay() === 0 || d.getDay() === 6;
}

/** Format a Date as an ISO 8601 UTC string (no milliseconds). */
function iso(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function addSecs(d, secs) {
  return new Date(d.getTime() + secs * 1000);
}
function addMins(d, mins) {
  return addSecs(d, mins * 60);
}
function addHours(d, h) {
  return addMins(d, h * 60);
}

// ── Shared metadata ───────────────────────────────────────────────────────────

const META = { dataOrigin: "com.google.android.apps.fitness" };

// ── Data generation ───────────────────────────────────────────────────────────

const StepsRecord = [];
const DistanceRecord = [];
const ActiveCaloriesBurnedRecord = [];
const TotalCaloriesBurnedRecord = [];
const FloorsClimbedRecord = [];
const HeartRateRecord = [];
const RestingHeartRateRecord = [];
const HeartRateVariabilityRmssdRecord = [];
const OxygenSaturationRecord = [];
const RespiratoryRateRecord = [];
const WeightRecord = [];
const BodyFatRecord = [];
const BloodPressureRecord = [];
const SleepSessionRecord = [];
const ExerciseSessionRecord = [];

// 28 days: Feb 1–28 2026
for (let day = 0; day < 28; day++) {
  const date = new Date(2026, 1, day + 1); // month is 0-indexed
  const weekend = isWeekend(date);

  // ── Steps (3 bursts: morning commute, midday, evening) ──
  const totalSteps = weekend ? rndInt(4500, 9000) : rndInt(7000, 13000);
  const stepSplit = [0.25, 0.35, 0.40].map((f) => Math.round(totalSteps * f));
  const stepTimes = [
    new Date(2026, 1, day + 1, 8, rndInt(0, 30)),
    new Date(2026, 1, day + 1, 12, rndInt(15, 45)),
    new Date(2026, 1, day + 1, 18, rndInt(0, 45)),
  ];
  stepTimes.forEach((start, i) => {
    StepsRecord.push({
      count: stepSplit[i],
      startTime: iso(start),
      endTime: iso(addMins(start, rndInt(20, 50))),
      metadata: META,
    });
  });

  // ── Distance (meters → converted to km by normalize) ──
  const distMeters = Math.round(totalSteps * 0.8); // ~0.8 m per step
  const distStart = new Date(2026, 1, day + 1, 8, 0);
  DistanceRecord.push({
    distance: { inMeters: distMeters },
    startTime: iso(distStart),
    endTime: iso(addHours(distStart, rndInt(8, 12))),
    metadata: META,
  });

  // ── Active calories ──
  const activeKcal = weekend ? rndInt(250, 500) : rndInt(350, 650);
  const energyStart = new Date(2026, 1, day + 1, 7, 0);
  ActiveCaloriesBurnedRecord.push({
    energy: { inKilocalories: activeKcal },
    startTime: iso(energyStart),
    endTime: iso(addHours(energyStart, 14)),
    metadata: META,
  });

  // ── Total (basal + active) calories ──
  const basalKcal = rndInt(1500, 1750);
  TotalCaloriesBurnedRecord.push({
    energy: { inKilocalories: basalKcal + activeKcal },
    startTime: iso(new Date(2026, 1, day + 1, 0, 0)),
    endTime: iso(new Date(2026, 1, day + 1, 23, 59)),
    metadata: META,
  });

  // ── Floors climbed ──
  // Uses { count } since the parser's extractValue handles it via r.count.
  const floors = weekend ? rndInt(2, 8) : rndInt(4, 14);
  FloorsClimbedRecord.push({
    count: floors,
    startTime: iso(new Date(2026, 1, day + 1, 9, 0)),
    endTime: iso(new Date(2026, 1, day + 1, 17, 0)),
    metadata: META,
  });

  // ── Heart rate (one record per reading session, each with a single sample) ──
  const hrHours = [7, 9, 12, 15, 18, 20, 22].slice(0, rndInt(6, 7));
  hrHours.forEach((hour) => {
    const t = new Date(2026, 1, day + 1, hour, rndInt(0, 59));
    HeartRateRecord.push({
      startTime: iso(t),
      endTime: iso(addSecs(t, 10)),
      samples: [{ beatsPerMinute: rndInt(55, 95), time: iso(t) }],
      metadata: META,
    });
  });

  // ── Resting heart rate (once per day, morning) ──
  RestingHeartRateRecord.push({
    beatsPerMinute: rndInt(52, 65),
    time: iso(new Date(2026, 1, day + 1, 7, 0)),
    metadata: META,
  });

  // ── Heart rate variability — RMSSD (ms) ──
  // Uses { value, unit } directly since the HC-specific field name
  // (heartRateVariabilityMillis) is not handled by extractValue.
  HeartRateVariabilityRmssdRecord.push({
    value: parseFloat(rnd(28, 58).toFixed(1)),
    unit: "milliseconds",
    time: iso(new Date(2026, 1, day + 1, 6, 30)),
    metadata: META,
  });

  // ── Oxygen saturation (2 readings per day) ──
  [8, 20].forEach((hour) => {
    OxygenSaturationRecord.push({
      percentage: parseFloat(rnd(96.5, 99.2).toFixed(1)),
      time: iso(new Date(2026, 1, day + 1, hour, rndInt(0, 30))),
      metadata: META,
    });
  });

  // ── Respiratory rate (2 readings per day) ──
  [7, 21].forEach((hour) => {
    RespiratoryRateRecord.push({
      rate: rndInt(13, 18),
      time: iso(new Date(2026, 1, day + 1, hour, rndInt(0, 30))),
      metadata: META,
    });
  });

  // ── Weight (every 3 days, morning) ──
  // Slight downward trend: 76.2 → 75.0 over the month.
  if (day % 3 === 0) {
    WeightRecord.push({
      weight: { inKilograms: parseFloat((76.2 - (day / 28) * 1.2 + rnd(-0.3, 0.3)).toFixed(1)) },
      time: iso(new Date(2026, 1, day + 1, 7, 15)),
      metadata: META,
    });
  }

  // ── Body fat (weekly) ──
  if (day % 7 === 0) {
    BodyFatRecord.push({
      percentage: parseFloat((18.5 - (day / 28) * 0.5 + rnd(-0.2, 0.2)).toFixed(1)),
      time: iso(new Date(2026, 1, day + 1, 7, 16)),
      metadata: META,
    });
  }

  // ── Blood pressure (every 4 days) ──
  if (day % 4 === 0) {
    BloodPressureRecord.push({
      systolic: { inMillimetersOfMercury: rndInt(112, 128) },
      diastolic: { inMillimetersOfMercury: rndInt(72, 82) },
      time: iso(new Date(2026, 1, day + 1, 8, rndInt(0, 30))),
      metadata: META,
    });
  }

  // ── Sleep (previous night, with stage breakdown) ──
  // Starts evening of the prior calendar day (~22:00).
  const sleepStart = new Date(2026, 1, day, 22, rndInt(0, 45));
  const totalSleepMins = rndInt(390, 510); // 6.5–8.5 hours
  const sleepEnd = addMins(sleepStart, totalSleepMins);

  // Stage constants:  0=awake, 1=asleep(unspecified), 2=out-of-bed, 3=light, 4=deep, 5=REM
  const stageDefs = [
    { stage: 3, mins: rndInt(40, 60) }, // light
    { stage: 4, mins: rndInt(20, 40) }, // deep
    { stage: 3, mins: rndInt(30, 50) }, // light
    { stage: 5, mins: rndInt(20, 35) }, // REM
    { stage: 3, mins: rndInt(40, 60) }, // light
    { stage: 4, mins: rndInt(15, 30) }, // deep
    { stage: 5, mins: rndInt(25, 45) }, // REM
    { stage: 3, mins: rndInt(30, 50) }, // light
    { stage: 0, mins: rndInt(3, 8) },   // awake
    { stage: 5, mins: rndInt(20, 35) }, // REM
  ];

  const stages = [];
  let cursor = addMins(sleepStart, rndInt(10, 20)); // sleep-onset latency
  for (const { stage, mins } of stageDefs) {
    const stageEnd = addMins(cursor, mins);
    if (stageEnd > sleepEnd) break;
    stages.push({ stage, startTime: iso(cursor), endTime: iso(stageEnd) });
    cursor = stageEnd;
  }

  SleepSessionRecord.push({
    startTime: iso(sleepStart),
    endTime: iso(sleepEnd),
    stages,
    metadata: META,
  });
}

// ── Workouts (12 sessions across the month) ──────────────────────────────────
//
// Health Connect exercise type codes (from HEALTH_CONNECT_EXERCISE_MAP):
//   8  = biking
//   39 = running
//   52 = strength_training
//   62 = walking

const workoutDays = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26];
const workoutDefs = [
  { exerciseType: 39, durationMin: 35, energyKcal: rndInt(310, 380), distanceM: Math.round(rnd(4500, 6500)) },
  { exerciseType:  8, durationMin: 55, energyKcal: rndInt(420, 520), distanceM: Math.round(rnd(18000, 26000)) },
  { exerciseType: 39, durationMin: 28, energyKcal: rndInt(240, 310), distanceM: Math.round(rnd(3500, 5000)) },
  { exerciseType: 62, durationMin: 45, energyKcal: rndInt(180, 240), distanceM: Math.round(rnd(3000, 4500)) },
  { exerciseType: 39, durationMin: 42, energyKcal: rndInt(360, 440), distanceM: Math.round(rnd(5500, 7500)) },
  { exerciseType:  8, durationMin: 70, energyKcal: rndInt(530, 650), distanceM: Math.round(rnd(25000, 35000)) },
  { exerciseType: 39, durationMin: 30, energyKcal: rndInt(260, 330), distanceM: Math.round(rnd(4000, 5500)) },
  { exerciseType: 52, durationMin: 45, energyKcal: rndInt(220, 300), distanceM: null },
  { exerciseType: 39, durationMin: 50, energyKcal: rndInt(430, 520), distanceM: Math.round(rnd(7000, 9000)) },
  { exerciseType:  8, durationMin: 60, energyKcal: rndInt(460, 570), distanceM: Math.round(rnd(22000, 30000)) },
  { exerciseType: 52, durationMin: 40, energyKcal: rndInt(200, 270), distanceM: null },
  { exerciseType: 39, durationMin: 38, energyKcal: rndInt(330, 410), distanceM: Math.round(rnd(5000, 6500)) },
];

workoutDays.forEach((day, i) => {
  const def = workoutDefs[i];
  const d = new Date(2026, 1, day);
  const hour = isWeekend(d) ? rndInt(9, 11) : rndInt(17, 19);
  const start = new Date(2026, 1, day, hour, rndInt(0, 30));
  const end = addMins(start, def.durationMin);

  const rec = {
    exerciseType: def.exerciseType,
    startTime: iso(start),
    endTime: iso(end),
    activeCalories: { inKilocalories: def.energyKcal },
    metadata: META,
  };
  if (def.distanceM !== null) {
    rec.distance = { inMeters: def.distanceM };
  }
  ExerciseSessionRecord.push(rec);
});

// ── Assemble and emit ─────────────────────────────────────────────────────────

const exportData = {
  exportDate: "2026-03-01T10:00:00Z",
  device: {
    manufacturer: "Google",
    model: "Pixel 8",
    type: "PHONE",
  },
  StepsRecord,
  DistanceRecord,
  ActiveCaloriesBurnedRecord,
  TotalCaloriesBurnedRecord,
  FloorsClimbedRecord,
  HeartRateRecord,
  RestingHeartRateRecord,
  HeartRateVariabilityRmssdRecord,
  OxygenSaturationRecord,
  RespiratoryRateRecord,
  WeightRecord,
  BodyFatRecord,
  BloodPressureRecord,
  SleepSessionRecord,
  ExerciseSessionRecord,
};

process.stdout.write(JSON.stringify(exportData, null, 2) + "\n");
