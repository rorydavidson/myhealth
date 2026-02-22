import { createFileRoute } from "@tanstack/react-router";
import { FileHeart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/_app/patient-summary")({
  component: PatientSummaryPage,
});

function PatientSummaryPage() {
  const { t } = useTranslation("ips");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t("title")}</h1>
      <EmptyState
        icon={<FileHeart className="h-12 w-12" />}
        title={t("whatIsIps")}
        description={t("description")}
      />
    </div>
  );
}
