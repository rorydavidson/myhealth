import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:placeholder:text-neutral-500 dark:focus:border-neutral-500 dark:focus:ring-neutral-700",
          error && "border-red-300 focus:border-red-400 focus:ring-red-200 dark:border-red-700",
          className,
        )}
        ref={ref}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
    </div>
  ),
);
Input.displayName = "Input";
