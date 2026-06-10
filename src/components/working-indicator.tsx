import { useAuth } from "@/lib/auth";
import { COLORS } from "@/lib/tokens";

/**
 * Recognised team members. When one of these is the signed-in user, a small
 * "working on it" overlay appears at the top-right of the app.
 *
 * ⚠️ Match is by email (case-insensitive). Confirm/adjust the addresses below.
 */
const TEAM: { email: string; name: string }[] = [
  { email: "m.peeters@jlsyachts.com", name: "Matt Peeters" },
  // TODO: confirm your own work email — best-guess from the jlsyachts.com pattern:
  { email: "m.fetton@jlsyachts.com", name: "Mike Fetton" },
];

export function WorkingIndicator() {
  const { user } = useAuth();

  const email = user?.email?.toLowerCase();
  const match = email ? TEAM.find((t) => t.email.toLowerCase() === email) : undefined;

  if (!match) return null;

  return (
    <div
      className="fixed right-4 top-3 z-50 flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-3.5 shadow-lg backdrop-blur-sm"
      style={{
        background: `rgba(13,21,32,0.92)`,
        border: `1px solid rgba(0,196,204,0.30)`,
      }}
    >
      {/* Pulsing live dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: COLORS.signal }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: COLORS.signal }} />
      </span>
      <span
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.04em",
          color: COLORS.frost,
        }}
      >
        <span style={{ fontWeight: 700, color: COLORS.signal }}>{match.name}</span> is working on it
      </span>
    </div>
  );
}
