import { createFileRoute } from "@tanstack/react-router";
import { PortalStub } from "@/components/platform/PortalStub";

export const Route = createFileRoute("/_app/portal/supplier")({
  component: () => (
    <PortalStub label="Polaris / Supplier" title="Supplier Portal"
      blurb="Purchase orders, quotations and deliveries for connected suppliers. This portal is being built out." />
  ),
  head: () => ({ meta: [{ title: "Supplier Portal — Polaris" }] }),
});
