import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && <div className="mb-4 text-neutral-400 dark:text-neutral-600">{icon}</div>}
      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
      {action}
    </div>
  );
}
