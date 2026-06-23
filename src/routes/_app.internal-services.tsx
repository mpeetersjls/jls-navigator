import { createFileRoute } from "@tanstack/react-router";
import { InternalServicesPage } from "@/components/yacht-it/internal-services-page";

export const Route = createFileRoute("/_app/internal-services")({
  component: InternalServicesPage,
  head: () => ({ meta: [{ title: "Internal Services — Yacht IT — JLS Navigator" }] }),
});
