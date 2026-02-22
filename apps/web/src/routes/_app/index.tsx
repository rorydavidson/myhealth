import type { MetricType } from "@health-app/shared";
import { CATEGORY_COLORS } from "@health-app/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Droplets,
  Flame,
  Footprints,
  Gauge,
  Heart,
  HeartPulse,
  Moon,
  Percent,
  Route as RouteIcon,
  Scale,
  Upload,
  Wind,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { MetricChart } from "@/components/charts/metric-chart";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { DateRangeSelector } from "@/components/ui/date-range-selector";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type DateRangePreset,
  useDailySummaries,
  useDashboardSnapshot,
  useHasHealthData,
} from "@/hooks/use-health-data";
import { useLocaleFormat } from "@/hooks/use-locale-format";

export const Route = createFileRoute("/_app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const { hasData, isLoading } = useHasHealthData();
  const [dateRange, setDateRange] = useState<DateRangePreset>("30d");

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!hasData) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-12 w-12" />}
        title={t("empty.title")}
        description={t("empty.description")}
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
      {/* Header with date range selector */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <DateRangeSelector value={dateRange} onChange={setDateRange} />
      </div>

      {/* Overview snapshot cards */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("section.overview")}
        </h2>
        <SnapshotCards />
      </section>

      {/* Activity section */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("section.activity")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChartCard
            title={t("chart.steps")}
            metricType="step_count"
            dateRange={dateRange}
            color={CATEGORY_COLORS.activity}
            type="bar"
            valueField="sum"
            unit={t("unit.steps")}
            icon={<Footprints className="h-4 w-4" />}
          />
          <ChartCard
            title={t("chart.distance")}
            metricType="distance"
            dateRange={dateRange}
            color={CATEGORY_COLORS.activity}
            type="area"
            valueField="sum"
            unit={t("unit.km")}
            icon={<RouteIcon className="h-4 w-4" />}
          />
          <ChartCard
            title={t("chart.activeEnergy")}
            metricType="active_energy"
            dateRange={dateRange}
            color={CATEGORY_COLORS.activity}
            type="bar"
            valueField="sum"
            unit={t("unit.kcal")}
            icon={<Flame className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Heart section */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("section.heart")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChartCard
            title={t("chart.heartRate")}
            metricType="heart_rate"
            dateRange={dateRange}
            color={CATEGORY_COLORS.heart}
            type="area"
            valueField="avg"
            unit={t("unit.bpm")}
            icon={<HeartPulse className="h-4 w-4" />}
            showRange
          />
          <ChartCard
            title={t("chart.restingHeartRate")}
            metricType="resting_heart_rate"
            dateRange={dateRange}
            color={CATEGORY_COLORS.heart}
            type="line"
            valueField="avg"
            unit={t("unit.bpm")}
            icon={<Heart className="h-4 w-4" />}
          />
          <ChartCard
            title={t("chart.hrv")}
            metricType="hrv"
            dateRange={dateRange}
            color={CATEGORY_COLORS.heart}
            type="line"
            valueField="avg"
            unit={t("unit.ms")}
            icon={<Activity className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Sleep section */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("section.sleep")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChartCard
            title={t("chart.sleep")}
            metricType="sleep_session"
            dateRange={dateRange}
            color={CATEGORY_COLORS.sleep}
            type="bar"
            valueField="sum"
            unit={t("unit.hr")}
            icon={<Moon className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Body section */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("section.body")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChartCard
            title={t("chart.weight")}
            metricType="body_mass"
            dateRange={dateRange}
            color={CATEGORY_COLORS.body}
            type="line"
            valueField="avg"
            unit={t("unit.kg")}
            icon={<Scale className="h-4 w-4" />}
            showYAxis
          />
          <ChartCard
            title={t("chart.bodyFat")}
            metricType="body_fat"
            dateRange={dateRange}
            color={CATEGORY_COLORS.body}
            type="line"
            valueField="avg"
            unit={t("unit.percent")}
            icon={<Percent className="h-4 w-4" />}
            showYAxis
          />
        </div>
      </section>

      {/* Vitals section */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("section.vitals")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChartCard
            title={t("chart.bloodOxygen")}
            metricType="oxygen_saturation"
            dateRange={dateRange}
            color={CATEGORY_COLORS.vitals}
            type="line"
            valueField="avg"
            unit={t("unit.percent")}
            icon={<Droplets className="h-4 w-4" />}
            showYAxis
          />
          <ChartCard
            title={t("chart.bloodPressure")}
            metricType="blood_pressure"
            dateRange={dateRange}
            color={CATEGORY_COLORS.vitals}
            type="line"
            valueField="avg"
            unit={t("unit.mmHg")}
            icon={<Gauge className="h-4 w-4" />}
            showRange
          />
          <ChartCard
            title={t("chart.respiratoryRate")}
            metricType="respiratory_rate"
            dateRange={dateRange}
            color={CATEGORY_COLORS.vitals}
            type="line"
            valueField="avg"
            unit={t("unit.breathsPerMin")}
            icon={<Wind className="h-4 w-4" />}
          />
        </div>
      </section>
    </div>
  );
}

// --- Snapshot Cards ---

function SnapshotCards() {
  const { t } = useTranslation("dashboard");
  const fmt = useLocaleFormat();
  const { data: snapshot, isLoading } = useDashboardSnapshot();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["steps", "heart", "sleep", "weight"].map((id) => (
          <Card key={id}>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-9 w-20" />
          </Card>
        ))}
      </div>
    );
  }

  const metrics: {
    type: MetricType;
    label: string;
    field: "sum" | "avg";
    unit: string;
    color: string;
    icon: ReactNode;
    decimals?: number;
  }[] = [
    {
      type: "step_count",
      label: t("card.stepsToday"),
      field: "sum",
      unit: t("unit.steps"),
      color: CATEGORY_COLORS.activity,
      icon: <Footprints className="h-4 w-4" />,
    },
    {
      type: "heart_rate",
      label: t("card.heartRateNow"),
      field: "avg",
      unit: t("unit.bpm"),
      color: CATEGORY_COLORS.heart,
      icon: <HeartPulse className="h-4 w-4" />,
    },
    {
      type: "sleep_session",
      label: t("card.sleepLastNight"),
      field: "sum",
      unit: t("unit.hr"),
      color: CATEGORY_COLORS.sleep,
      icon: <Moon className="h-4 w-4" />,
      decimals: 1,
    },
    {
      type: "body_mass",
      label: t("card.weight"),
      field: "avg",
      unit: t("unit.kg"),
      color: CATEGORY_COLORS.body,
      icon: <Scale className="h-4 w-4" />,
      decimals: 1,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const summary = snapshot.get(metric.type);
        const value = summary ? (metric.field === "sum" ? summary.sum : summary.avg) : null;

        return (
          <Card key={metric.type} className="hover:shadow-md">
            <div className="mb-2 flex items-center gap-2">
              <span style={{ color: metric.color }}>{metric.icon}</span>
              <CardTitle>{metric.label}</CardTitle>
            </div>
            <CardValue>
              {value !== null ? `${fmt.decimal(value, metric.decimals ?? 0)} ` : t("card.noData")}
              {value !== null && (
                <span className="text-sm font-normal text-neutral-500">{metric.unit}</span>
              )}
            </CardValue>
            {summary && (
              <p className="mt-1 text-xs text-neutral-400">{fmt.shortDate(summary.date)}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// --- Chart Card ---

function ChartCard({
  title,
  metricType,
  dateRange,
  color,
  type,
  valueField,
  unit,
  icon,
  showYAxis,
  showRange,
}: {
  title: string;
  metricType: MetricType;
  dateRange: DateRangePreset;
  color: string;
  type: "line" | "area" | "bar";
  valueField: "sum" | "avg";
  unit: string;
  icon: ReactNode;
  showYAxis?: boolean;
  showRange?: boolean;
}) {
  const { t } = useTranslation("dashboard");
  const { data, isLoading } = useDailySummaries(metricType, dateRange);

  if (isLoading) {
    return (
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <CardTitle>{title}</CardTitle>
        </div>
        <Skeleton className="h-[200px] w-full" />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card className="flex min-h-[200px] flex-col items-center justify-center">
        <span className="mb-2 opacity-40" style={{ color }}>
          {icon}
        </span>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{title}</p>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{t("card.noData")}</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <span style={{ color }}>{icon}</span>
        <CardTitle>{title}</CardTitle>
      </div>
      <MetricChart
        data={data}
        color={color}
        type={type}
        valueField={valueField}
        unit={unit}
        showYAxis={showYAxis}
        showRange={showRange}
      />
    </Card>
  );
}

// --- Skeleton dashboard ---

function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["skel-steps", "skel-heart", "skel-sleep", "skel-weight"].map((id) => (
          <Card key={id}>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-9 w-20" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          "skel-chart-1",
          "skel-chart-2",
          "skel-chart-3",
          "skel-chart-4",
          "skel-chart-5",
          "skel-chart-6",
        ].map((id) => (
          <Card key={id}>
            <Skeleton className="mb-3 h-4 w-32" />
            <Skeleton className="h-[200px] w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
