import { createFileRoute } from "@tanstack/react-router";
import { PortalStub } from "@/components/platform/PortalStub";

export const Route = createFileRoute("/_app/portal/shipsync")({
  component: () => (
    <PortalStub label="Polaris / ShipSync" title="ShipSync — Logistics"
      blurb="Ship spares, logistics, customs and storage. This portal is being built out." />
  ),
  head: () => ({ meta: [{ title: "ShipSync — Polaris" }] }),
});
