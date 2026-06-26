import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/components/legal/legal-pages";

// Public, unauthenticated. NOT under `_app`, so no session gate.
export const Route = createFileRoute("/legal/privacy")({
  component: PrivacyPage,
  head: () => ({ meta: [{ title: "Privacy Policy — Polaris" }] }),
});
