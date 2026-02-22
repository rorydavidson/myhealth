import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-shadow dark:border-neutral-800 dark:bg-neutral-900",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-sm font-medium text-neutral-500 dark:text-neutral-400", className)}
      {...props}
    />
  );
}

export function CardValue({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-3xl font-bold tabular-nums", className)} {...props} />;
}
