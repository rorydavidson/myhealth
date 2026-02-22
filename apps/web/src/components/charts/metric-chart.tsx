/**
 * Reusable metric chart component.
 *
 * Supports line, area, and bar chart types.
 * Follows the design system: minimal axes, gradients, smooth curves.
 * Includes animated transitions when data changes (300ms ease).
 */

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailySummaryRow } from "@/db";
import { useLocaleFormat } from "@/hooks/use-locale-format";

interface MetricChartProps {
  data: DailySummaryRow[];
  color: string;
  type?: "line" | "area" | "bar";
  /** Which field to display: sum for additive metrics, avg for instantaneous */
  valueField?: "sum" | "avg" | "min" | "max";
  /** Unit label for tooltip (e.g., "bpm", "steps") */
  unit?: string;
  /** Chart height in pixels */
  height?: number;
  /** Show Y axis */
  showYAxis?: boolean;
  /** Show min/max range as area band */
  showRange?: boolean;
}

interface ChartDataPoint {
  date: string;
  value: number | null;
  min?: number | null;
  max?: number | null;
  range?: [number, number] | null;
  label: string;
}

/** Animation duration in milliseconds for chart transitions */
const ANIMATION_DURATION = 300;
const ANIMATION_EASING = "ease-in-out" as const;

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MetricChart({
  data,
  color,
  type = "area",
  valueField = "sum",
  unit = "",
  height = 200,
  showYAxis = false,
  showRange = false,
}: MetricChartProps) {
  const fmt = useLocaleFormat();
  const gradientId = useId();

  const chartData: ChartDataPoint[] = data.map((d) => ({
    date: d.date,
    value: d[valueField],
    min: d.min,
    max: d.max,
    range: d.min != null && d.max != null ? [d.min, d.max] : null,
    label: formatDate(d.date),
  }));

  if (chartData.length === 0) {
    return null;
  }

  const commonProps = {
    data: chartData,
    margin: { top: 4, right: 4, bottom: 0, left: showYAxis ? 0 : -20 },
  };

  const xAxisProps = {
    dataKey: "label" as const,
    tick: { fontSize: 11, fill: "#a3a3a3" },
    tickLine: false,
    axisLine: false,
    interval: Math.max(0, Math.floor(chartData.length / 6) - 1),
  };

  const yAxisProps = {
    tick: showYAxis ? { fontSize: 11, fill: "#a3a3a3" } : (false as const),
    tickLine: false,
    axisLine: false,
    width: showYAxis ? 45 : 0,
    domain: ["auto" as const, "auto" as const],
  };

  const gridProps = {
    strokeDasharray: "3 3",
    stroke: "#e5e5e5",
    vertical: false,
  };

  const animationProps = {
    animationDuration: ANIMATION_DURATION,
    animationEasing: ANIMATION_EASING,
  };

  // Custom tooltip renderer
  function CustomTooltip({ active, payload }: Record<string, unknown>) {
    if (!active || !Array.isArray(payload) || payload.length === 0) return null;
    const point = (payload[0] as { payload?: ChartDataPoint })?.payload;
    if (!point) return null;
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatDate(point.date)}</p>
        <p className="text-sm font-semibold" style={{ color }}>
          {point.value !== null ? fmt.number(Math.round(point.value * 100) / 100) : "—"} {unit}
        </p>
        {showRange && point.min != null && point.max != null && (
          <p className="text-xs text-neutral-400">
            {fmt.number(Math.round(point.min * 100) / 100)} –{" "}
            {fmt.number(Math.round(point.max * 100) / 100)} {unit}
          </p>
        )}
      </div>
    );
  }

  const rangeGradientId = `range-${gradientId}`;
  const fillGradientId = `fill-${gradientId}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      {type === "bar" ? (
        <BarChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar
            dataKey="value"
            fill={color}
            radius={[3, 3, 0, 0]}
            opacity={0.85}
            {...animationProps}
          />
        </BarChart>
      ) : type === "line" ? (
        <LineChart {...commonProps}>
          <defs>
            {showRange && (
              <linearGradient id={rangeGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          {showRange && (
            <Area
              type="monotone"
              dataKey="range"
              stroke="none"
              fill={`url(#${rangeGradientId})`}
              {...animationProps}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            {...animationProps}
          />
        </LineChart>
      ) : (
        <AreaChart {...commonProps}>
          <defs>
            <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            {showRange && (
              <linearGradient id={rangeGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            )}
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip content={<CustomTooltip />} />
          {showRange && (
            <Area
              type="monotone"
              dataKey="range"
              stroke="none"
              fill={`url(#${rangeGradientId})`}
              {...animationProps}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${fillGradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            {...animationProps}
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
