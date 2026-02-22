import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/**
 * Provides locale-aware number and date formatting via Intl APIs.
 * All number/date rendering in the app should go through this hook.
 */
export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  return useMemo(() => {
    const numberFormat = new Intl.NumberFormat(locale);
    const compactFormat = new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
    const percentFormat = new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 1,
    });
    const dateFormat = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const dateTimeFormat = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const timeFormat = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const shortDateFormat = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    });

    return {
      /** Format a number with locale-appropriate grouping/decimals */
      number: (value: number) => numberFormat.format(value),

      /** Format a number in compact notation (e.g., 8.2K) */
      compact: (value: number) => compactFormat.format(value),

      /** Format a decimal as a percentage (0.15 → "15%") */
      percent: (value: number) => percentFormat.format(value),

      /** Format a number with specific fraction digits */
      decimal: (value: number, fractionDigits: number) =>
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        }).format(value),

      /** Format a Date or ISO string as a readable date */
      date: (value: Date | string) =>
        dateFormat.format(typeof value === "string" ? new Date(value) : value),

      /** Format a Date or ISO string as date + time */
      dateTime: (value: Date | string) =>
        dateTimeFormat.format(typeof value === "string" ? new Date(value) : value),

      /** Format a Date or ISO string as time only */
      time: (value: Date | string) =>
        timeFormat.format(typeof value === "string" ? new Date(value) : value),

      /** Short date (e.g., "Jan 5") */
      shortDate: (value: Date | string) =>
        shortDateFormat.format(typeof value === "string" ? new Date(value) : value),

      locale,
    };
  }, [locale]);
}
