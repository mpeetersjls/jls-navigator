import { createFileRoute } from "@tanstack/react-router";
import { FinancePage } from "@/components/finance/finance-page";

export const Route = createFileRoute("/_app/finance")({
  component: FinancePage,
  head: () => ({ meta: [{ title: "Finance — JLS Navigator" }] }),
});
