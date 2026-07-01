import { createFileRoute } from "@tanstack/react-router";
import { ResourcePage } from "@/components/resource-page";
import { ORBIT_DEFECTS_CONFIG } from "@/components/orbit/orbit-resource-configs";

export const Route = createFileRoute("/_app/orbit/defects")({
  component: () => <ResourcePage config={ORBIT_DEFECTS_CONFIG} />,
  head: () => ({ meta: [{ title: "Defects & Repairs — Polaris" }] }),
});
