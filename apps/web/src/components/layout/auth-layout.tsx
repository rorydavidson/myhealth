import { FileHeart } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";

interface AuthLayoutProps {
  children: ReactNode;
}

const LANGUAGES = [
  { code: "en", labelKey: "language.en" },
  { code: "fr", labelKey: "language.fr" },
] as const;

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation("common");
  const { t: tAuth, i18n: i18nInstance } = useTranslation("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      {/* Language switcher — top right */}
      <div className="absolute right-4 top-4">
        <label className="sr-only" htmlFor="lang-select">
          {tAuth("language.label")}
        </label>
        <select
          id="lang-select"
          value={i18nInstance.language.split("-")[0]}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:focus:ring-neutral-100"
        >
          {LANGUAGES.map(({ code, labelKey }) => (
            <option key={code} value={code}>
              {tAuth(labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 dark:bg-white">
            <FileHeart className="h-6 w-6 text-white dark:text-neutral-900" />
          </div>
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {t("appName")}
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
