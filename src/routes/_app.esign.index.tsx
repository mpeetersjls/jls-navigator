import { createFileRoute } from "@tanstack/react-router";
import { EsignPage } from "@/components/esign/esign-page";

export const Route = createFileRoute("/_app/esign/")({
  component: EsignPage,
  head: () => ({ meta: [{ title: "Anchor — Aquila One" }] }),
});
