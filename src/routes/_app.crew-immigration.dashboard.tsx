import { createFileRoute } from "@tanstack/react-router";
import { CrewDashboardPage } from "@/components/crew-immigration/crew-dashboard-page";

export const Route = createFileRoute("/_app/crew-immigration/dashboard")({
  component: CrewDashboardPage,
  head: () => ({ meta: [{ title: "Crew Dashboard — Polaris" }] }),
});
