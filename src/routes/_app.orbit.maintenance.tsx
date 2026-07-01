import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/resource-page";
import { ORBIT_MAINTENANCE_CONFIG } from "@/components/orbit/orbit-resource-configs";

export const Route = createFileRoute("/_app/orbit/maintenance")({
  component: () => <ResourcePage config={ORBIT_MAINTENANCE_CONFIG} />,
  head: () => ({ meta: [{ title: "Planned Maintenance — Polaris" }] }),
});
