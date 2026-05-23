import { createFileRoute } from "@tanstack/react-router";
import { YachtItPage } from "@/components/yacht-it/yacht-it-page";

export const Route = createFileRoute("/_app/yacht-it")({
  component: YachtItPage,
  head: () => ({ meta: [{ title: "Yacht IT Solutions — JLS Navigator" }] }),
});
