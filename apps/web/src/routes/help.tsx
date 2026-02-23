import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

interface FaqItem {
  q: string;
  a: string;
}

function Accordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-neutral-900 transition-colors hover:text-neutral-600 dark:text-neutral-100 dark:hover:text-neutral-300"
      >
        {item.q}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {item.a}
        </p>
      )}
    </div>
  );
}

function HelpPage() {
  const { t } = useTranslation("common");

  const faqSections = [
    {
      title: t("help.section.gettingStarted"),
      items: t("help.faq.gettingStarted", { returnObjects: true }) as FaqItem[],
    },
    {
      title: t("help.section.privacy"),
      items: t("help.faq.privacy", { returnObjects: true }) as FaqItem[],
    },
    {
      title: t("help.section.data"),
      items: t("help.faq.data", { returnObjects: true }) as FaqItem[],
    },
    {
      title: t("help.section.ai"),
      items: t("help.faq.ai", { returnObjects: true }) as FaqItem[],
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Back link */}
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("actions.back")}
        </Link>

        <h1 className="mb-2 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
          {t("help.pageTitle")}
        </h1>
        <p className="mb-10 text-neutral-500 dark:text-neutral-400">
          {t("help.subtitle")}
        </p>

        <div className="space-y-10">
          {faqSections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {section.title}
              </h2>
              <div className="rounded-xl border border-neutral-200 bg-white px-6 dark:border-neutral-800 dark:bg-neutral-900">
                {section.items.map((item) => (
                  <Accordion key={item.q} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("help.contact")}
          </p>
        </div>
      </div>
    </div>
  );
}
