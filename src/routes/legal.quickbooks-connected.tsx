import { createFileRoute } from "@tanstack/react-router";
import { QuickBooksConnectedPage } from "@/components/legal/legal-pages";

// Post-OAuth success landing (redirected to from /api/qb/callback).
export const Route = createFileRoute("/legal/quickbooks-connected")({
  component: QuickBooksConnectedPage,
  head: () => ({ meta: [{ title: "QuickBooks connected — Polaris" }] }),
});
