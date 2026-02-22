import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  buildEnhancedContext,
  buildStandardContext,
  type ChatMessage,
  createMessageId,
  streamLLMQuery,
} from "@/services/llm";

export const Route = createFileRoute("/_app/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const { t } = useTranslation("insights");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [showDataPreview, setShowDataPreview] = useState(false);
  const [healthContext, setHealthContext] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Refresh health context when enhanced mode changes
  useEffect(() => {
    let cancelled = false;
    setContextLoading(true);
    const builder = enhanced ? buildEnhancedContext : buildStandardContext;
    builder().then((ctx) => {
      if (!cancelled) {
        setHealthContext(ctx);
        setContextLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enhanced]);

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isStreaming) return;

      setInput("");

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content,
        timestamp: new Date(),
        healthContext: healthContext ?? undefined,
        enhanced,
      };

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);
      requestAnimationFrame(scrollToBottom);

      try {
        // Build the message history for the API (only role + content)
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const stream = streamLLMQuery({
          messages: apiMessages,
          healthContext: healthContext ?? "",
          enhanced,
        });

        for await (const chunk of stream) {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + chunk,
              };
            }
            return updated;
          });
          requestAnimationFrame(scrollToBottom);
        }
      } catch (error) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content:
                error instanceof Error ? error.message : "An error occurred. Please try again.",
            };
          }
          return updated;
        });
      } finally {
        setIsStreaming(false);
        // Reset enhanced mode after each query (per CLAUDE.md spec)
        setEnhanced(false);
      }
    },
    [input, isStreaming, messages, healthContext, enhanced, scrollToBottom],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleClick = (question: string) => {
    handleSend(question);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <h1 className="mb-4 text-2xl font-bold">{t("title")}</h1>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {!hasMessages ? (
          <WelcomeScreen onExampleClick={handleExampleClick} isStreaming={isStreaming} />
        ) : (
          <div className="space-y-1 p-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isStreaming={isStreaming} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Privacy mode + data preview */}
      <div className="mt-3">
        <PrivacyControls
          enhanced={enhanced}
          onEnhancedChange={setEnhanced}
          showDataPreview={showDataPreview}
          onToggleDataPreview={() => setShowDataPreview((v) => !v)}
          healthContext={healthContext}
          contextLoading={contextLoading}
        />
      </div>

      {/* Input area */}
      <div className="mt-2 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder:text-neutral-500 dark:focus:border-neutral-600"
        />
        <Button
          onClick={() => handleSend()}
          disabled={!input.trim() || isStreaming}
          size="icon"
          className="h-[46px] w-[46px] shrink-0 rounded-xl"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <p className="mt-2 text-center text-xs text-neutral-400">{t("disclaimer")}</p>
    </div>
  );
}

// --- Sub-components ---

function WelcomeScreen({
  onExampleClick,
  isStreaming,
}: {
  onExampleClick: (q: string) => void;
  isStreaming: boolean;
}) {
  const { t } = useTranslation("insights");

  const examples = t("chat.examples", { returnObjects: true }) as Record<string, string>;

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <Sparkles className="mb-4 h-12 w-12 text-neutral-300 dark:text-neutral-600" />
      <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">{t("chat.welcome")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {Object.entries(examples).map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => onExampleClick(label)}
            disabled={isStreaming}
            className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming: boolean }) {
  const { t } = useTranslation("insights");
  const isUser = message.role === "user";
  const isLastAssistant = !isUser && isStreaming && message.content === "";

  return (
    <div className={`flex gap-3 py-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
        }`}
      >
        {isLastAssistant ? (
          <span className="flex items-center gap-2 text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("chat.thinking")}
          </span>
        ) : (
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
          <User className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
        </div>
      )}
    </div>
  );
}

function PrivacyControls({
  enhanced,
  onEnhancedChange,
  showDataPreview,
  onToggleDataPreview,
  healthContext,
  contextLoading,
}: {
  enhanced: boolean;
  onEnhancedChange: (v: boolean) => void;
  showDataPreview: boolean;
  onToggleDataPreview: () => void;
  healthContext: string | null;
  contextLoading: boolean;
}) {
  const { t } = useTranslation("insights");

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <Lock className="h-3 w-3" />
            {enhanced ? t("privacy.enhancedMode") : t("privacy.standardMode")}
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={enhanced}
              onChange={(e) => onEnhancedChange(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-violet-500 focus:ring-violet-500"
            />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("privacy.enhancedToggle")}
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={onToggleDataPreview}
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          {showDataPreview ? (
            <>
              <EyeOff className="h-3 w-3" />
              {t("privacy.hideData")}
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              {t("privacy.showData")}
            </>
          )}
          {showDataPreview ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Enhanced warning */}
      {enhanced && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{t("privacy.enhancedWarning", { provider: "Claude AI" })}</span>
        </div>
      )}

      {/* Data preview */}
      {showDataPreview && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
          <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {t("privacy.dataSent")}
          </p>
          {contextLoading ? (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading...
            </div>
          ) : (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-300">
              {healthContext ?? "No data available"}
            </pre>
          )}
          <p className="mt-2 text-xs text-neutral-400">
            <Lock className="mr-1 inline h-3 w-3" />
            {t("privacy.neverSent")}
          </p>
        </div>
      )}

      {/* Standard mode info (when not enhanced) */}
      {!enhanced && !showDataPreview && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          {t("privacy.standardDescription")}
        </p>
      )}
    </div>
  );
}
