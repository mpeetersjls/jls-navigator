import { createFileRoute } from "@tanstack/react-router";
import { QuickBooksDisconnectedPage } from "@/components/legal/legal-pages";

// Public landing for Intuit's "Disconnect URL".
export const Route = createFileRoute("/legal/quickbooks-disconnected")({
  component: QuickBooksDisconnectedPage,
  head: () => ({ meta: [{ title: "QuickBooks disconnected — Polaris" }] }),
});
