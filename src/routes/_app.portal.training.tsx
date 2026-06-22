import { createFileRoute } from "@tanstack/react-router";
import { PortalStub } from "@/components/platform/PortalStub";

export const Route = createFileRoute("/_app/portal/training")({
  component: () => (
    <PortalStub label="Polaris / Training" title="JLS Yacht Training Institute"
      blurb="Training, certification and crew development. This portal is being built out." />
  ),
  head: () => ({ meta: [{ title: "Training — Polaris" }] }),
});
