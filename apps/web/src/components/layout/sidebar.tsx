import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  Dumbbell,
  FileHeart,
  FlaskConical,
  LayoutDashboard,
  PanelLeft,
  PanelLeftClose,
  Settings,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

interface NavItem {
  labelKey: string;
  to: string;
  icon: typeof LayoutDashboard;
  color?: string;
}

const navItems: NavItem[] = [
  {
    labelKey: "nav.dashboard",
    to: "/",
    icon: LayoutDashboard,
  },
  {
    labelKey: "nav.import",
    to: "/import",
    icon: Upload,
  },
  {
    labelKey: "nav.workouts",
    to: "/workouts",
    icon: Dumbbell,
    color: "text-orange-500",
  },
  {
    labelKey: "nav.trends",
    to: "/trends",
    icon: TrendingUp,
    color: "text-activity",
  },
  {
    labelKey: "nav.labResults",
    to: "/lab-results",
    icon: FlaskConical,
    color: "text-lab-results",
  },
  {
    labelKey: "nav.conditions",
    to: "/conditions",
    icon: ClipboardList,
    color: "text-violet-500",
  },
  {
    labelKey: "nav.insights",
    to: "/insights",
    icon: Sparkles,
  },
  {
    labelKey: "nav.patientSummary",
    to: "/patient-summary",
    icon: FileHeart,
  },
  {
    labelKey: "nav.settings",
    to: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const { t } = useTranslation("common");
  const [collapsed, setCollapsed] = useState(false);
  const matchRoute = useMatchRoute();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-neutral-200 bg-white transition-all duration-200 dark:border-neutral-800 dark:bg-neutral-900",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo / App name */}
      <div className="flex h-14 items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900 dark:bg-white">
          <FileHeart className="h-4 w-4 text-white dark:text-neutral-900" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {t("appName")}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = matchRoute({ to: item.to, fuzzy: true });
          const Icon = item.icon;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-50",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", item.color)} />
              {!collapsed && <span>{t(item.labelKey)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <>
              <PanelLeftClose className="h-5 w-5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
