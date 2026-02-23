/**
 * Markdown renderer component.
 *
 * Wraps react-markdown with remark-gfm and applies design-system-consistent
 * prose styles via Tailwind utility classes. Use this anywhere LLM-generated
 * or otherwise markdown-formatted text needs to be rendered.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

interface MarkdownProps {
  children: string;
  /** Additional class names applied to the root wrapper element. */
  className?: string;
  /**
   * Visual density preset.
   * - "default": standard body prose (for chat bubbles, rich content areas)
   * - "compact": tighter spacing and smaller text (for inline card summaries)
   */
  size?: "default" | "compact";
}

export function Markdown({ children, className, size = "default" }: MarkdownProps) {
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        // Base prose styles shared across both sizes
        "[&_p]:leading-relaxed",
        "[&_strong]:font-semibold",
        "[&_em]:italic",
        "[&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:dark:bg-neutral-800",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-100 [&_pre]:p-3 [&_pre]:font-mono [&_pre]:dark:bg-neutral-800",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-500 [&_blockquote]:dark:border-neutral-600 [&_blockquote]:dark:text-neutral-400",
        "[&_hr]:border-neutral-200 [&_hr]:dark:border-neutral-700",
        "[&_a]:text-violet-600 [&_a]:underline [&_a]:hover:text-violet-700 [&_a]:dark:text-violet-400 [&_a]:dark:hover:text-violet-300",
        isCompact
          ? [
              // Compact — used for card AI summaries
              "text-xs text-neutral-500 dark:text-neutral-400",
              "[&_p]:mb-1.5 [&_p:last-child]:mb-0",
              "[&_ul]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ul:last-child]:mb-0",
              "[&_ol]:mb-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol:last-child]:mb-0",
              "[&_li]:mb-0.5 [&_li:last-child]:mb-0",
              "[&_h1]:mb-1 [&_h1]:text-sm [&_h1]:font-semibold",
              "[&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold",
              "[&_h3]:mb-0.5 [&_h3]:text-xs [&_h3]:font-semibold",
            ]
          : [
              // Default — used for chat bubbles
              "text-sm",
              "[&_p]:mb-3 [&_p:last-child]:mb-0",
              "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul:last-child]:mb-0",
              "[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol:last-child]:mb-0",
              "[&_li]:mb-1 [&_li:last-child]:mb-0",
              "[&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
              "[&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold",
              "[&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium",
            ],
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
