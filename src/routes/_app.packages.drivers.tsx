import { createFileRoute } from "@tanstack/react-router";
import { PackageDriversPage } from "@/components/packages/package-drivers-page";

export const Route = createFileRoute("/_app/packages/drivers")({
  component: PackageDriversPage,
  head: () => ({ meta: [{ title: "Delivery Drivers — JLS Yachts CRM" }] }),
});
