import { CATEGORY_COLORS } from "@health-app/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Dumbbell, Upload } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DateRangeSelector } from "@/components/ui/date-range-selector";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { HealthRecordRow } from "@/db";
import { type DateRangePreset, useHealthRecords } from "@/hooks/use-health-data";
import { useLocaleFormat } from "@/hooks/use-locale-format";
import { getUniqueWorkoutTypeKeys, getWorkoutTypeKey } from "@/lib/workout-types";

export const Route = createFileRoute("/_app/workouts")({
  component: WorkoutsPage,
});

const WORKOUT_COLOR = CATEGORY_COLORS.workouts;

function WorkoutsPage() {
  const { t } = useTranslation("dashboard");
  const [dateRange, setDateRange] = useState<DateRangePreset>("90d");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { data: workouts, isLoading } = useHealthRecords("workout", dateRange);

  // Get unique workout types for the filter dropdown
  const workoutTypeKeys = useMemo(() => {
    const activityTypes = workouts
      .map((w) => (w.metadata as Record<string, string> | undefined)?.workoutActivityType ?? "")
      .filter(Boolean);
    return getUniqueWorkoutTypeKeys(activityTypes);
  }, [workouts]);

  // Filter workouts by type
  const filteredWorkouts = useMemo(() => {
    if (typeFilter === "all") return workouts;
    return workouts.filter((w) => {
      const activityType =
        (w.metadata as Record<string, string> | undefined)?.workoutActivityType ?? "";
      return getWorkoutTypeKey(activityType) === typeFilter;
    });
  }, [workouts, typeFilter]);

  // Sort by date descending (most recent first)
  const sortedWorkouts = useMemo(
    () =>
      [...filteredWorkouts].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
      ),
    [filteredWorkouts],
  );

  if (isLoading) {
    return <WorkoutsSkeleton />;
  }

  if (workouts.length === 0) {
    return (
      <EmptyState
        icon={<Dumbbell className="h-12 w-12" />}
        title={t("workoutLog.noWorkouts")}
        description={t("workoutLog.noWorkoutsDescription")}
        action={
          <Link to="/import">
            <Button>
              <Upload className="h-4 w-4" />
              {t("empty.cta")}
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("workoutLog.title")}</h1>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Monthly frequency chart */}
      <section className="mb-8">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span style={{ color: WORKOUT_COLOR }}>
              <Dumbbell className="h-4 w-4" />
            </span>
            <CardTitle>{t("workoutLog.monthlyFrequency")}</CardTitle>
          </div>
          <MonthlyFrequencyChart workouts={workouts} />
        </Card>
      </section>

      {/* Filter bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WorkoutTypeFilter types={workoutTypeKeys} value={typeFilter} onChange={setTypeFilter} />
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("workoutLog.showing", { count: sortedWorkouts.length })}
        </p>
      </div>

      {/* Workout table */}
      <WorkoutTable workouts={sortedWorkouts} />
    </div>
  );
}

// --- Workout Type Filter ---

function WorkoutTypeFilter({
  types,
  value,
  onChange,
}: {
  types: string[];
  value: string;
  onChange: (type: string) => void;
}) {
  const { t } = useTranslation("dashboard");

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600 dark:focus:ring-white/10"
    >
      <option value="all">{t("workoutLog.allTypes")}</option>
      {types.map((typeKey) => (
        <option key={typeKey} value={typeKey}>
          {t(`workoutType.${typeKey}`)}
        </option>
      ))}
    </select>
  );
}

// --- Workout Table ---

const WorkoutTable = memo(function WorkoutTable({ workouts }: { workouts: HealthRecordRow[] }) {
  const { t } = useTranslation("dashboard");
  const fmt = useLocaleFormat();

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50">
              <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400">
                {t("workoutLog.type")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-500 dark:text-neutral-400">
                {t("workoutLog.date")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">
                {t("workoutLog.duration")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">
                {t("workoutLog.distance")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-neutral-500 dark:text-neutral-400">
                {t("workoutLog.calories")}
              </th>
            </tr>
          </thead>
          <tbody>
            {workouts.map((workout) => (
              <WorkoutRow key={workout.id} workout={workout} fmt={fmt} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
});

const WorkoutRow = memo(function WorkoutRow({
  workout,
  fmt,
}: {
  workout: HealthRecordRow;
  fmt: ReturnType<typeof useLocaleFormat>;
}) {
  const { t } = useTranslation("dashboard");
  const meta = workout.metadata as Record<string, string> | undefined;
  const activityType = meta?.workoutActivityType ?? "";
  const typeKey = getWorkoutTypeKey(activityType);

  const duration = workout.value;
  const distance = meta?.totalDistance ? Number.parseFloat(meta.totalDistance) : null;
  const distanceUnit = meta?.totalDistanceUnit ?? "km";
  const calories = meta?.totalEnergyBurned ? Number.parseFloat(meta.totalEnergyBurned) : null;

  return (
    <tr
      className="border-b border-neutral-100 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/30"
      style={{ contentVisibility: "auto", containIntrinsicSize: "0 52px" }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ backgroundColor: `${WORKOUT_COLOR}15`, color: WORKOUT_COLOR }}
          >
            <Dumbbell className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">
            {t(`workoutType.${typeKey}`)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
        {fmt.dateTime(workout.startTime)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
        {duration !== null ? t("workoutLog.minutes", { count: Math.round(duration) }) : "—"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
        {distance !== null ? `${fmt.decimal(distance, 2)} ${distanceUnit}` : "—"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-neutral-900 dark:text-neutral-100">
        {calories !== null ? `${fmt.number(Math.round(calories))} kcal` : "—"}
      </td>
    </tr>
  );
});

// --- Monthly Frequency Chart ---

interface MonthlyData {
  month: string;
  count: number;
}

function MonthlyFrequencyChart({ workouts }: { workouts: HealthRecordRow[] }) {
  const { t } = useTranslation("dashboard");
  const fmt = useLocaleFormat();

  const chartData: MonthlyData[] = useMemo(() => {
    const monthCounts = new Map<string, number>();

    for (const w of workouts) {
      const date = new Date(w.startTime);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
    }

    return [...monthCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const [year, month] = key.split("-");
        const date = new Date(Number(year), Number(month) - 1, 1);
        return {
          month: date.toLocaleDateString(fmt.locale, { month: "short", year: "2-digit" }),
          count,
        };
      });
  }, [workouts, fmt.locale]);

  if (chartData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#a3a3a3" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis tick={false} tickLine={false} axisLine={false} width={0} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !Array.isArray(payload) || payload.length === 0) return null;
            const point = payload[0]?.payload as MonthlyData | undefined;
            if (!point) return null;
            return (
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{point.month}</p>
                <p className="text-sm font-semibold" style={{ color: WORKOUT_COLOR }}>
                  {point.count} {t("workoutLog.workoutsPerMonth")}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" fill={WORKOUT_COLOR} radius={[3, 3, 0, 0]} opacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// --- Skeleton ---

function WorkoutsSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-56" />
      </div>
      <Card className="mb-8">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-[200px] w-full" />
      </Card>
      <Skeleton className="mb-4 h-9 w-40" />
      <Card className="p-0">
        <div className="space-y-0">
          {["skel-row-1", "skel-row-2", "skel-row-3", "skel-row-4", "skel-row-5"].map((id) => (
            <div
              key={id}
              className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800"
            >
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
