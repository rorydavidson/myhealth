import type { MetricCategory, MetricType } from "../types/health.js";

export interface MetricDefinition {
  type: MetricType;
  category: MetricCategory;
  label: string;
  unit: string;
  /** Whether the daily summary uses sum (additive) or avg */
  aggregation: "sum" | "avg";
  /** Icon name from lucide-react */
  icon: string;
}

export const METRICS: Record<MetricType, MetricDefinition> = {
  step_count: {
    type: "step_count",
    category: "activity",
    label: "Steps",
    unit: "count",
    aggregation: "sum",
    icon: "Footprints",
  },
  distance: {
    type: "distance",
    category: "activity",
    label: "Distance",
    unit: "km",
    aggregation: "sum",
    icon: "Route",
  },
  active_energy: {
    type: "active_energy",
    category: "activity",
    label: "Active Energy",
    unit: "kcal",
    aggregation: "sum",
    icon: "Flame",
  },
  flights_climbed: {
    type: "flights_climbed",
    category: "activity",
    label: "Flights Climbed",
    unit: "count",
    aggregation: "sum",
    icon: "TrendingUp",
  },
  heart_rate: {
    type: "heart_rate",
    category: "heart",
    label: "Heart Rate",
    unit: "bpm",
    aggregation: "avg",
    icon: "HeartPulse",
  },
  resting_heart_rate: {
    type: "resting_heart_rate",
    category: "heart",
    label: "Resting Heart Rate",
    unit: "bpm",
    aggregation: "avg",
    icon: "Heart",
  },
  hrv: {
    type: "hrv",
    category: "heart",
    label: "Heart Rate Variability",
    unit: "ms",
    aggregation: "avg",
    icon: "Activity",
  },
  body_mass: {
    type: "body_mass",
    category: "body",
    label: "Weight",
    unit: "kg",
    aggregation: "avg",
    icon: "Scale",
  },
  body_fat: {
    type: "body_fat",
    category: "body",
    label: "Body Fat",
    unit: "%",
    aggregation: "avg",
    icon: "Percent",
  },
  sleep_session: {
    type: "sleep_session",
    category: "sleep",
    label: "Sleep",
    unit: "hr",
    aggregation: "sum",
    icon: "Moon",
  },
  oxygen_saturation: {
    type: "oxygen_saturation",
    category: "vitals",
    label: "Blood Oxygen",
    unit: "%",
    aggregation: "avg",
    icon: "Droplets",
  },
  blood_pressure: {
    type: "blood_pressure",
    category: "vitals",
    label: "Blood Pressure",
    unit: "mmHg",
    aggregation: "avg",
    icon: "Gauge",
  },
  respiratory_rate: {
    type: "respiratory_rate",
    category: "vitals",
    label: "Respiratory Rate",
    unit: "breaths/min",
    aggregation: "avg",
    icon: "Wind",
  },
  workout: {
    type: "workout",
    category: "workouts",
    label: "Workout",
    unit: "min",
    aggregation: "sum",
    icon: "Dumbbell",
  },
};

export const CATEGORY_COLORS: Record<MetricCategory, string> = {
  activity: "#3b82f6", // blue-500
  heart: "#f43f5e", // rose-500
  sleep: "#6366f1", // indigo-500
  body: "#f59e0b", // amber-500
  vitals: "#10b981", // emerald-500
  lab_results: "#8b5cf6", // violet-500
  workouts: "#f97316", // orange-500
};
