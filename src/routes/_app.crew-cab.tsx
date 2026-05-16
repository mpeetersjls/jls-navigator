import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/crew-cab")({
  beforeLoad: () => { throw redirect({ to: "/crew-cab/trips" }) },
});
