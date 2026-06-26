import { createFileRoute } from "@tanstack/react-router";
import { EulaPage } from "@/components/legal/legal-pages";

// Public, unauthenticated. NOT under `_app`, so no session gate.
export const Route = createFileRoute("/legal/eula")({
  component: EulaPage,
  head: () => ({ meta: [{ title: "End-User License Agreement — Polaris" }] }),
});
