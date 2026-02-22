import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/_app")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) {
      navigate({ to: "/login" });
    }
  }, [isPending, session, navigate]);

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900 dark:border-neutral-700 dark:border-t-white" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
