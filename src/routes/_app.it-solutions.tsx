import { createFileRoute } from "@tanstack/react-router";
import { YachtItSolutionsPage } from "@/components/yacht-it/yacht-it-solutions-page";

export const Route = createFileRoute("/_app/it-solutions")({
  component: YachtItSolutionsPage,
  head: () => ({ meta: [{ title: "Yacht IT Solutions — Polaris" }] }),
});
