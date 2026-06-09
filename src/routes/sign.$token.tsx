import { createFileRoute } from "@tanstack/react-router";
import { PublicSignPage } from "@/components/esign/public-sign-page";

// Public, unauthenticated signing route. NOT under `_app`, so no session gate.
export const Route = createFileRoute("/sign/$token")({
  component: PublicSignPage,
  head: () => ({ meta: [{ title: "Sign Document — JLS Yachts" }] }),
});
