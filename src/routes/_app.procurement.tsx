import { createFileRoute } from "@tanstack/react-router";
import { ProcurementPage } from "@/components/procurement/procurement-page";

export const Route = createFileRoute("/_app/procurement")({
  component: ProcurementPage,
  head: () => ({ meta: [{ title: "Procurement — JLS Navigator" }] }),
});
