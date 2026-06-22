import { createFileRoute } from "@tanstack/react-router";
import { MfaSetup } from "@/components/auth/MfaSetup";

export const Route = createFileRoute("/_app/mfa-setup")({
  component: MfaSetup,
  head: () => ({ meta: [{ title: "Security — Polaris" }] }),
});
