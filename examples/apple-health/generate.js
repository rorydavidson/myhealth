#!/usr/bin/env node
/**
 * Generates a synthetic Apple Health XML export for demo and testing.
 * Covers February 2026 (28 days) with realistic variation across all
 * metric types the app supports.
 *
 * Usage: node generate.js > export.xml
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
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

const SOURCE_NAME = "Demo iPhone 15";
const SOURCE_VERSION = "17.4";
const DEVICE = "<<HKDevice: 0x0>, name:iPhone, manufacturer:Apple Inc., model:iPhone, hardware:iPhone16,1, software:17.4>";

/** Format a Date as Apple Health timestamp: "2026-02-01 09:15:00 -0800" */
function fmt(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} -0800`;
}

/** Add seconds to a date, returning a new Date. */
function addSecs(d, secs) {
  return new Date(d.getTime() + secs * 1000);
}
function addMins(d, mins) {
  return addSecs(d, mins * 60);
}
function addHours(d, h) {
  return addMins(d, h * 60);
}

function record({ type, unit, value, start, end, sourceName = SOURCE_NAME }) {
  const s = fmt(start);
  const e = fmt(end ?? addMins(start, 1));
  return `  <Record type="${type}" sourceName="${sourceName}" sourceVersion="${SOURCE_VERSION}" device="${DEVICE}" unit="${unit}" creationDate="${e}" startDate="${s}" endDate="${e}" value="${value}"/>`;
}

function workout({ activityType, duration, energy, distance, start }) {
  const end = addMins(start, duration);
  const distAttr = distance != null ? ` workoutActivityType="HKWorkoutActivityType${activityType}" totalDistance="${distance}" totalDistanceUnit="km"` : '';
  return `  <Workout workoutActivityType="HKWorkoutActivityType${activityType}" duration="${duration}" durationUnit="min" totalEnergyBurned="${energy}" totalEnergyBurnedUnit="kcal"${distance != null ? ` totalDistance="${distance}" totalDistanceUnit="km"` : ''} sourceName="${SOURCE_NAME}" sourceVersion="${SOURCE_VERSION}" creationDate="${fmt(end)}" startDate="${fmt(start)}" endDate="${fmt(end)}"/>`;
}

function sleepRecord(value, start, end) {
  return `  <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="${SOURCE_NAME}" sourceVersion="${SOURCE_VERSION}" device="${DEVICE}" creationDate="${fmt(end)}" startDate="${fmt(start)}" endDate="${fmt(end)}" value="${value}"/>`;
}

// ── Data generation ───────────────────────────────────────────────────────────

const records = [];

// 28 days: Feb 1–28 2026
for (let day = 0; day < 28; day++) {
  const date = new Date(2026, 1, day + 1); // month is 0-indexed
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  // ── Steps (3 bursts: morning commute, midday, evening) ──
  const totalSteps = isWeekend ? rndInt(4500, 9000) : rndInt(7000, 13000);
  const stepSplit = [0.25, 0.35, 0.40].map((f) => Math.round(totalSteps * f));

  const stepTimes = [
    new Date(2026, 1, day + 1, 8, rndInt(0, 30)),
    new Date(2026, 1, day + 1, 12, rndInt(15, 45)),
    new Date(2026, 1, day + 1, 18, rndInt(0, 45)),
  ];
  stepTimes.forEach((start, i) => {
    records.push(record({ type: "HKQuantityTypeIdentifierStepCount", unit: "count", value: stepSplit[i], start, end: addMins(start, rndInt(20, 50)) }));
  });

  // ── Distance walking/running (km) ──
  const distKm = (totalSteps * 0.0008).toFixed(3);
  const distStart = new Date(2026, 1, day + 1, 8, 0);
  records.push(record({ type: "HKQuantityTypeIdentifierDistanceWalkingRunning", unit: "km", value: distKm, start: distStart, end: addHours(distStart, rndInt(8, 12)) }));

  // ── Active energy (kcal) ──
  const activeKcal = isWeekend ? rndInt(250, 500) : rndInt(350, 650);
  const energyStart = new Date(2026, 1, day + 1, 7, 0);
  records.push(record({ type: "HKQuantityTypeIdentifierActiveEnergyBurned", unit: "kcal", value: activeKcal, start: energyStart, end: addHours(energyStart, 14) }));

  // ── Basal energy ──
  const basalKcal = rndInt(1500, 1750);
  records.push(record({ type: "HKQuantityTypeIdentifierBasalEnergyBurned", unit: "kcal", value: basalKcal, start: new Date(2026, 1, day + 1, 0, 0), end: new Date(2026, 1, day + 1, 23, 59) }));

  // ── Flights climbed ──
  const flights = isWeekend ? rndInt(2, 8) : rndInt(4, 14);
  records.push(record({ type: "HKQuantityTypeIdentifierFlightsClimbed", unit: "count", value: flights, start: new Date(2026, 1, day + 1, 9, 0), end: new Date(2026, 1, day + 1, 17, 0) }));

  // ── Heart rate (6-8 readings spread through the day) ──
  const hrReadingTimes = [7, 9, 12, 15, 18, 20, 22].slice(0, rndInt(6, 7));
  hrReadingTimes.forEach((hour) => {
    const hr = rndInt(55, 95);
    const start = new Date(2026, 1, day + 1, hour, rndInt(0, 59));
    records.push(record({ type: "HKQuantityTypeIdentifierHeartRate", unit: "count/min", value: hr, start, end: addSecs(start, 10) }));
  });

  // ── Resting heart rate (once per day, morning) ──
  const restingHr = rndInt(52, 65);
  records.push(record({ type: "HKQuantityTypeIdentifierRestingHeartRate", unit: "count/min", value: restingHr, start: new Date(2026, 1, day + 1, 7, 0), end: new Date(2026, 1, day + 1, 7, 1) }));

  // ── HRV (once per day) ──
  const hrv = rndInt(28, 58);
  records.push(record({ type: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN", unit: "ms", value: hrv, start: new Date(2026, 1, day + 1, 6, 30), end: new Date(2026, 1, day + 1, 6, 35) }));

  // ── SpO2 (2 readings) ──
  [8, 20].forEach((hour) => {
    const spo2 = (rnd(96.5, 99.2)).toFixed(1);
    const start = new Date(2026, 1, day + 1, hour, rndInt(0, 30));
    records.push(record({ type: "HKQuantityTypeIdentifierOxygenSaturation", unit: "%", value: spo2, start, end: addSecs(start, 15) }));
  });

  // ── Respiratory rate (2 readings) ──
  [7, 21].forEach((hour) => {
    const rr = rndInt(13, 18);
    const start = new Date(2026, 1, day + 1, hour, rndInt(0, 30));
    records.push(record({ type: "HKQuantityTypeIdentifierRespiratoryRate", unit: "count/min", value: rr, start, end: addSecs(start, 60) }));
  });

  // ── Weight (every 2-3 days, morning) ──
  if (day % 3 === 0) {
    // Slight downward trend: 76.2 → 75.0 over the month
    const weight = (76.2 - (day / 28) * 1.2 + rnd(-0.3, 0.3)).toFixed(1);
    records.push(record({ type: "HKQuantityTypeIdentifierBodyMass", unit: "kg", value: weight, start: new Date(2026, 1, day + 1, 7, 15), end: new Date(2026, 1, day + 1, 7, 16) }));
  }

  // ── Body fat (weekly) ──
  if (day % 7 === 0) {
    const bf = (18.5 - (day / 28) * 0.5 + rnd(-0.2, 0.2)).toFixed(1);
    records.push(record({ type: "HKQuantityTypeIdentifierBodyFatPercentage", unit: "%", value: (bf / 100).toFixed(4), start: new Date(2026, 1, day + 1, 7, 16), end: new Date(2026, 1, day + 1, 7, 17) }));
  }

  // ── Blood pressure (every 4 days) ──
  if (day % 4 === 0) {
    const systolic = rndInt(112, 128);
    const diastolic = rndInt(72, 82);
    const bpStart = new Date(2026, 1, day + 1, 8, rndInt(0, 30));
    const bpEnd = addMins(bpStart, 1);
    records.push(record({ type: "HKQuantityTypeIdentifierBloodPressureSystolic", unit: "mmHg", value: systolic, start: bpStart, end: bpEnd }));
    records.push(record({ type: "HKQuantityTypeIdentifierBloodPressureDiastolic", unit: "mmHg", value: diastolic, start: bpStart, end: bpEnd }));
  }

  // ── Sleep (previous night: 22:00–06:30 approx, split into stages) ──
  // Use previous calendar day for start
  const sleepStart = new Date(2026, 1, day + 1, 22, rndInt(0, 45));
  sleepStart.setDate(sleepStart.getDate() - 1); // previous night
  const totalSleepMins = rndInt(390, 510); // 6.5–8.5 hours

  // InBed spans the whole period
  const inBedEnd = addMins(sleepStart, totalSleepMins + rndInt(10, 30));
  records.push(sleepRecord("HKCategoryValueSleepAnalysisInBed", sleepStart, inBedEnd));

  // Asleep (core) — a few segments
  let cursor = addMins(sleepStart, rndInt(10, 20)); // sleep onset
  const stages = [
    { value: "HKCategoryValueSleepAnalysisAsleepCore", mins: rndInt(40, 60) },
    { value: "HKCategoryValueSleepAnalysisAsleepDeep", mins: rndInt(20, 40) },
    { value: "HKCategoryValueSleepAnalysisAsleepCore", mins: rndInt(30, 50) },
    { value: "HKCategoryValueSleepAnalysisAsleepREM",  mins: rndInt(20, 35) },
    { value: "HKCategoryValueSleepAnalysisAsleepCore", mins: rndInt(40, 60) },
    { value: "HKCategoryValueSleepAnalysisAsleepDeep", mins: rndInt(15, 30) },
    { value: "HKCategoryValueSleepAnalysisAsleepREM",  mins: rndInt(25, 45) },
    { value: "HKCategoryValueSleepAnalysisAsleepCore", mins: rndInt(30, 50) },
    { value: "HKCategoryValueSleepAnalysisAwake",      mins: rndInt(3, 8) },
    { value: "HKCategoryValueSleepAnalysisAsleepREM",  mins: rndInt(20, 35) },
  ];
  stages.forEach(({ value, mins }) => {
    const end = addMins(cursor, mins);
    records.push(sleepRecord(value, cursor, end));
    cursor = end;
  });
}

// ── Workouts (12 sessions across the month) ──────────────────────────────────
const workoutDays = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26];
const workoutDefs = [
  { activityType: "Running",  duration: 35, energy: rndInt(310, 380), distance: parseFloat(rnd(4.5, 6.5).toFixed(2)) },
  { activityType: "Cycling",  duration: 55, energy: rndInt(420, 520), distance: parseFloat(rnd(18, 26).toFixed(2)) },
  { activityType: "Running",  duration: 28, energy: rndInt(240, 310), distance: parseFloat(rnd(3.5, 5.0).toFixed(2)) },
  { activityType: "Walking",  duration: 45, energy: rndInt(180, 240), distance: parseFloat(rnd(3.0, 4.5).toFixed(2)) },
  { activityType: "Running",  duration: 42, energy: rndInt(360, 440), distance: parseFloat(rnd(5.5, 7.5).toFixed(2)) },
  { activityType: "Cycling",  duration: 70, energy: rndInt(530, 650), distance: parseFloat(rnd(25, 35).toFixed(2)) },
  { activityType: "Running",  duration: 30, energy: rndInt(260, 330), distance: parseFloat(rnd(4.0, 5.5).toFixed(2)) },
  { activityType: "FunctionalStrengthTraining", duration: 45, energy: rndInt(220, 300), distance: null },
  { activityType: "Running",  duration: 50, energy: rndInt(430, 520), distance: parseFloat(rnd(7.0, 9.0).toFixed(2)) },
  { activityType: "Cycling",  duration: 60, energy: rndInt(460, 570), distance: parseFloat(rnd(22, 30).toFixed(2)) },
  { activityType: "FunctionalStrengthTraining", duration: 40, energy: rndInt(200, 270), distance: null },
  { activityType: "Running",  duration: 38, energy: rndInt(330, 410), distance: parseFloat(rnd(5.0, 6.5).toFixed(2)) },
];

workoutDays.forEach((day, i) => {
  const def = workoutDefs[i];
  const hour = isWeekend(new Date(2026, 1, day)) ? rndInt(9, 11) : rndInt(17, 19);
  const start = new Date(2026, 1, day, hour, rndInt(0, 30));
  records.push(workout({ ...def, start }));
});

function isWeekend(d) {
  return d.getDay() === 0 || d.getDay() === 6;
}

// ── Assemble XML ──────────────────────────────────────────────────────────────

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData PUBLIC "-//Apple//DTD HEALTHDATA 1.0//EN" "http://www.apple.com/DTDs/HealthData.dtd">
<HealthData locale="en_US">
  <ExportDate value="2026-03-01 10:00:00 -0800"/>
  <Me HKCharacteristicTypeIdentifierDateOfBirth="" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexNotSet" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet" HKCharacteristicTypeIdentifierFitzpatrickSkinType="HKFitzpatrickSkinTypeNotSet"/>
${records.join("\n")}
</HealthData>
`;

process.stdout.write(xml);
