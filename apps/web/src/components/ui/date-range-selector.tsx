import type { DateRangePreset } from "@/hooks/use-health-data";
import { cn } from "@/lib/cn";

const presets: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "1y", label: "1y" },
  { value: "all", label: "All" },
];

interface DateRangeSelectorProps {
  value: DateRangePreset;
  onChange: (preset: DateRangePreset) => void;
  className?: string;
}

export function DateRangeSelector({ value, onChange, className }: DateRangeSelectorProps) {
  return (
    <div className={cn("inline-flex rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800", className)}>
      {presets.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => onChange(preset.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === preset.value
              ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
              : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
