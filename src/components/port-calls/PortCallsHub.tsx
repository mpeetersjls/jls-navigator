/**
 * PortCallsHub — Agency Module entry point for the New View.
 *
 * List <-> create-form <-> detail, all via local state, so the whole
 * Port Calls / Inward Clearance flow stays inside the Polaris shell
 * (mirrors src/components/vessels/vessels-hub.tsx and the crew screen
 * in src/routes/_app.polaris-redesign.tsx).
 */
import { useState } from "react";
import { PortCallsList } from "./PortCallsList";
import { CreatePortCallForm } from "./CreatePortCallForm";
import { PortCallDetail } from "./PortCallDetail";

type ViewState =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "detail"; portCallId: string };

export function PortCallsHub() {
  const [view, setView] = useState<ViewState>({ mode: "list" });

  if (view.mode === "create") {
    return (
      <CreatePortCallForm
        onCreated={(portCallId) => setView({ mode: "detail", portCallId })}
        onCancel={() => setView({ mode: "list" })}
      />
    );
  }

  if (view.mode === "detail") {
    return (
      <PortCallDetail
        portCallId={view.portCallId}
        embedded
        onBack={() => setView({ mode: "list" })}
      />
    );
  }

  return (
    <PortCallsList
      onOpenPortCall={(portCallId) => setView({ mode: "detail", portCallId })}
      onNewPortCall={() => setView({ mode: "create" })}
    />
  );
}

export default PortCallsHub;
