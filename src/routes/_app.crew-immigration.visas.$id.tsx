import { createFileRoute } from "@tanstack/react-router";
import { VisaDetailPage } from "@/components/visa/VisaDetailPage";

export const Route = createFileRoute("/_app/crew-immigration/visas/$id")({
  component: VisaDetailPage,
  head: () => ({ meta: [{ title: "Visa Application — Polaris" }] }),
});
