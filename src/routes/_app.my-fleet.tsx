import { createFileRoute } from "@tanstack/react-router";
import { MyFleetPage } from "@/components/my-fleet-page";

export const Route = createFileRoute("/_app/my-fleet")({
  component: MyFleetPage,
  head: () => ({ meta: [{ title: "My Fleet — Vessel Tracking" }] }),
});
