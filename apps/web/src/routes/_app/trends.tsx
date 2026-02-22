import type { MetricType } from "@health-app/shared";
import { CATEGORY_COLORS, METRICS } from "@health-app/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
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
  TrendingUp,
  Upload,
  Wind,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardValue } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailySummaries, useHasHealthData } from "@/hooks/use-health-data";
import { useLocaleFormat } from "@/hooks/use-locale-format";
import {
  computeTrend,
  correlationStrength,
  generateSparklineData,
  pearsonCorrelation,
  splitIntoPeriods,
  type TrendDirection,
  type TrendResult,
} from "@/services/trends";

export const Route = createFileRoute("/_app/trends")({
  component: TrendsPage,
});

// Metrics to show in the trend overview (excluding workout and flights_climbed)
const TREND_METRICS: {
  type: MetricType;
  chartKey: string;
  unitKey: string;
  icon: ReactNode;
}[] = [
  {
    type: "step_count",
    chartKey: "chart.steps",
    unitKey: "unit.steps",
    icon: <Footprints className="h-4 w-4" />,
  },
  {
    type: "distance",
    chartKey: "chart.distance",
    unitKey: "unit.km",
    icon: <RouteIcon className="h-4 w-4" />,
  },
  {
    type: "active_energy",
    chartKey: "chart.activeEnergy",
    unitKey: "unit.kcal",
    icon: <Flame className="h-4 w-4" />,
  },
  {
    type: "heart_rate",
    chartKey: "chart.heartRate",
    unitKey: "unit.bpm",
    icon: <HeartPulse className="h-4 w-4" />,
  },
  {
    type: "resting_heart_rate",
    chartKey: "chart.restingHeartRate",
    unitKey: "unit.bpm",
    icon: <Heart className="h-4 w-4" />,
  },
  {
    type: "hrv",
    chartKey: "chart.hrv",
    unitKey: "unit.ms",
    icon: <Activity className="h-4 w-4" />,
  },
  {
    type: "sleep_session",
    chartKey: "chart.sleep",
    unitKey: "unit.hr",
    icon: <Moon className="h-4 w-4" />,
  },
  {
    type: "body_mass",
    chartKey: "chart.weight",
    unitKey: "unit.kg",
    icon: <Scale className="h-4 w-4" />,
  },
  {
    type: "body_fat",
    chartKey: "chart.bodyFat",
    unitKey: "unit.percent",
    icon: <Percent className="h-4 w-4" />,
  },
  {
    type: "oxygen_saturation",
    chartKey: "chart.bloodOxygen",
    unitKey: "unit.percent",
    icon: <Droplets className="h-4 w-4" />,
  },
  {
    type: "blood_pressure",
    chartKey: "chart.bloodPressure",
    unitKey: "unit.mmHg",
    icon: <Gauge className="h-4 w-4" />,
  },
  {
    type: "respiratory_rate",
    chartKey: "chart.respiratoryRate",
    unitKey: "unit.breathsPerMin",
    icon: <Wind className="h-4 w-4" />,
  },
];

// Metrics available for correlation (no workout)
const CORRELATION_METRICS = TREND_METRICS.filter((m) => m.type !== "blood_pressure");

function TrendsPage() {
  const { t } = useTranslation("dashboard");
  const { hasData, isLoading } = useHasHealthData();

  if (isLoading) {
    return <TrendsSkeleton />;
  }

  if (!hasData) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-12 w-12" />}
        title={t("trends.noTrendData")}
        description={t("trends.noTrendDescription")}
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
      <h1 className="mb-6 text-2xl font-bold">{t("trends.title")}</h1>

      {/* Weekly comparison */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("trends.weeklyComparison")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TREND_METRICS.map((metric) => (
            <TrendCard key={metric.type} metric={metric} />
          ))}
        </div>
      </section>

      {/* Correlation Explorer */}
      <section className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {t("trends.correlationExplorer")}
        </h2>
        <CorrelationExplorer />
      </section>
    </div>
  );
}

// --- Trend Card ---

function TrendCard({ metric }: { metric: (typeof TREND_METRICS)[number] }) {
  const { t } = useTranslation("dashboard");
  const fmt = useLocaleFormat();
  const metricDef = METRICS[metric.type];
  const valueField = metricDef.aggregation;
  const color = CATEGORY_COLORS[metricDef.category];

  // Get 14 days of data (this week + last week)
  const { data, isLoading } = useDailySummaries(metric.type, "30d");

  const trend: TrendResult = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        current: null,
        previous: null,
        percentChange: null,
        direction: "stable",
        isSignificant: false,
      };
    }
    const [current, previous] = splitIntoPeriods(data, 7);
    return computeTrend(current, previous, metric.type, valueField);
  }, [data, metric.type, valueField]);

  const sparkline = useMemo(() => {
    if (!data || data.length === 0) return [];
    return generateSparklineData(data, valueField, 14);
  }, [data, valueField]);

  if (isLoading) {
    return (
      <Card>
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-2 h-8 w-20" />
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  if (trend.current === null) {
    return (
      <Card className="flex min-h-[120px] flex-col items-center justify-center opacity-50">
        <span style={{ color }}>{metric.icon}</span>
        <p className="mt-1 text-xs text-neutral-400">{t("card.noData")}</p>
      </Card>
    );
  }

  return (
    <Card
      className={
        trend.isSignificant ? "shadow-md ring-1 ring-neutral-200 dark:ring-neutral-700" : ""
      }
    >
      <div className="mb-1 flex items-center gap-2">
        <span style={{ color }}>{metric.icon}</span>
        <CardTitle>{t(metric.chartKey)}</CardTitle>
      </div>

      <div className="mb-2 flex items-baseline gap-2">
        <CardValue className="text-2xl">
          {fmt.decimal(trend.current, metricDef.aggregation === "sum" ? 0 : 1)}
        </CardValue>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{t(metric.unitKey)}</span>
      </div>

      {/* Trend indicator */}
      <div className="mb-2 flex items-center gap-1.5">
        <TrendArrow direction={trend.direction} />
        {trend.percentChange !== null && (
          <span className="text-xs font-medium" style={{ color: trendColor(trend.direction) }}>
            {trend.percentChange > 0 ? "+" : ""}
            {trend.percentChange}%
          </span>
        )}
        <span className="text-xs text-neutral-400">{t("trends.vsLastWeek")}</span>
      </div>

      {/* Sparkline */}
      {sparkline.length > 2 && <MiniSparkline data={sparkline} color={color} />}
    </Card>
  );
}

// --- Trend Arrow ---

function TrendArrow({ direction }: { direction: TrendDirection }) {
  const color = trendColor(direction);
  if (direction === "improving") return <ArrowUp className="h-3.5 w-3.5" style={{ color }} />;
  if (direction === "declining") return <ArrowDown className="h-3.5 w-3.5" style={{ color }} />;
  return <ArrowRight className="h-3.5 w-3.5" style={{ color }} />;
}

function trendColor(direction: TrendDirection): string {
  switch (direction) {
    case "improving":
      return "#10b981"; // emerald-500
    case "declining":
      return "#f43f5e"; // rose-500
    case "stable":
      return "#a3a3a3"; // neutral-400
  }
}

// --- Mini Sparkline ---

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color})`}
          dot={false}
          animationDuration={300}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// --- Correlation Explorer ---

function CorrelationExplorer() {
  const { t } = useTranslation("dashboard");
  const fmt = useLocaleFormat();
  const [metricX, setMetricX] = useState<MetricType>("step_count");
  const [metricY, setMetricY] = useState<MetricType>("sleep_session");

  const metricXDef = METRICS[metricX];
  const metricYDef = METRICS[metricY];
  const colorX = CATEGORY_COLORS[metricXDef.category];
  const colorY = CATEGORY_COLORS[metricYDef.category];

  const { data: dataX } = useDailySummaries(metricX, "90d");
  const { data: dataY } = useDailySummaries(metricY, "90d");

  // Build overlapping date map
  const { correlation, overlayData } = useMemo(() => {
    if (!dataX || !dataY) return { correlation: null, overlayData: [] };

    const mapX = new Map(dataX.map((d) => [d.date, d]));
    const mapY = new Map(dataY.map((d) => [d.date, d]));

    const dates = [...new Set([...mapX.keys(), ...mapY.keys()])].sort();
    const xValues: number[] = [];
    const yValues: number[] = [];
    const overlay: { date: string; label: string; x: number | null; y: number | null }[] = [];

    for (const date of dates) {
      const dx = mapX.get(date);
      const dy = mapY.get(date);
      const xVal = dx ? (dx[metricXDef.aggregation] ?? null) : null;
      const yVal = dy ? (dy[metricYDef.aggregation] ?? null) : null;

      overlay.push({
        date,
        label: formatDateShort(date),
        x: xVal,
        y: yVal,
      });

      if (xVal !== null && yVal !== null) {
        xValues.push(xVal);
        yValues.push(yVal);
      }
    }

    return {
      correlation: pearsonCorrelation(xValues, yValues),
      overlayData: overlay,
    };
  }, [dataX, dataY, metricXDef.aggregation, metricYDef.aggregation]);

  const strength = correlationStrength(correlation);
  const strengthColor =
    strength === "strong" ? "#10b981" : strength === "moderate" ? "#f59e0b" : "#a3a3a3";

  const metricXInfo = CORRELATION_METRICS.find((m) => m.type === metricX);
  const metricYInfo = CORRELATION_METRICS.find((m) => m.type === metricY);

  return (
    <Card>
      {/* Metric selectors */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MetricSelect
          label={t("trends.selectMetricX")}
          value={metricX}
          onChange={setMetricX}
          color={colorX}
        />
        <span className="text-neutral-400">×</span>
        <MetricSelect
          label={t("trends.selectMetricY")}
          value={metricY}
          onChange={setMetricY}
          color={colorY}
        />

        {/* Correlation badge */}
        {correlation !== null && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("trends.correlationStrength")}:
            </span>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ backgroundColor: `${strengthColor}15`, color: strengthColor }}
            >
              {t(`trends.${strength}`)} ({correlation > 0 ? "+" : ""}
              {fmt.decimal(correlation, 2)})
            </span>
          </div>
        )}
      </div>

      {/* Overlay chart */}
      {metricX === metricY ? (
        <p className="py-8 text-center text-sm text-neutral-400">{t("trends.noCorrelation")}</p>
      ) : overlayData.length < 3 ? (
        <p className="py-8 text-center text-sm text-neutral-400">{t("trends.insufficientData")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={overlayData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#a3a3a3" }}
              tickLine={false}
              axisLine={false}
              interval={Math.max(0, Math.floor(overlayData.length / 8) - 1)}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: colorX }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: colorY }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !Array.isArray(payload) || payload.length === 0) return null;
                const point = payload[0]?.payload as
                  | { date: string; x: number | null; y: number | null }
                  | undefined;
                if (!point) return null;
                return (
                  <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                    <p className="mb-1 text-xs text-neutral-500">{formatDateShort(point.date)}</p>
                    <p className="text-xs font-medium" style={{ color: colorX }}>
                      {metricXInfo ? t(metricXInfo.chartKey) : metricX}:{" "}
                      {point.x !== null ? fmt.decimal(point.x, 1) : "—"}
                    </p>
                    <p className="text-xs font-medium" style={{ color: colorY }}>
                      {metricYInfo ? t(metricYInfo.chartKey) : metricY}:{" "}
                      {point.y !== null ? fmt.decimal(point.y, 1) : "—"}
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={30}
              formatter={(value: string) => {
                if (value === "x") return metricXInfo ? t(metricXInfo.chartKey) : metricX;
                if (value === "y") return metricYInfo ? t(metricYInfo.chartKey) : metricY;
                return value;
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="x"
              stroke={colorX}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: colorX }}
              connectNulls
              animationDuration={300}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="y"
              stroke={colorY}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: colorY }}
              connectNulls
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// --- Metric Select ---

function MetricSelect({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: MetricType;
  onChange: (v: MetricType) => void;
  color: string;
}) {
  const { t } = useTranslation("dashboard");

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as MetricType)}
      className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:border-neutral-300 focus:outline-none focus:ring-2 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600"
      style={{
        borderColor: `${color}40`,
        color,
      }}
    >
      {CORRELATION_METRICS.map((m) => (
        <option key={m.type} value={m.type}>
          {t(m.chartKey)}
        </option>
      ))}
    </select>
  );
}

// --- Utilities ---

function formatDateShort(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// --- Skeleton ---

function TrendsSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-32" />
      <Skeleton className="mb-4 h-4 w-48" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {["ts-1", "ts-2", "ts-3", "ts-4", "ts-5", "ts-6", "ts-7", "ts-8"].map((id) => (
          <Card key={id}>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="mb-2 h-8 w-20" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
