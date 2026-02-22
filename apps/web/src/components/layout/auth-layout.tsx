import { FileHeart } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
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
