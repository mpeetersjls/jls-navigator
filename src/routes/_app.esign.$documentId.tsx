import { createFileRoute } from "@tanstack/react-router";
import { EsignDetailPage } from "@/components/esign/esign-detail-page";

export const Route = createFileRoute("/_app/esign/$documentId")({
  component: EsignDetailPage,
  head: () => ({ meta: [{ title: "Document — e-Sign" }] }),
});
