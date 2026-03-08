import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/forgot-password")({
  component: () => <Navigate to="/login" replace />,
});
