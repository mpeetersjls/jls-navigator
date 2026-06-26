/**
 * Public, unauthenticated legal / OAuth landing pages.
 * Linked from the Intuit Developer production questionnaire (EULA + Privacy URLs)
 * and used as the QuickBooks Disconnect / post-Connect landing pages.
 * Not linked anywhere in the app nav — reachable only by direct URL.
 */
import { useEffect, useState } from "react";

const ORG = "JLS Yachts LLC";
const APP = "Polaris";
const OPERATOR = "New Horizon IT";
const CONTACT = "itsupport@jlsyachts.com";
const EFFECTIVE = "26 June 2026";

function LegalShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-600" /> {APP} · {ORG}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="prose prose-slate mt-6 max-w-none prose-headings:font-semibold prose-h2:text-lg prose-h2:mt-6 prose-p:text-sm prose-li:text-sm prose-p:leading-relaxed">
            {children}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {ORG}. Operated by {OPERATOR}. Contact{" "}
          <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </div>
    </div>
  );
}

export function EulaPage() {
  return (
    <LegalShell title="End-User License Agreement" subtitle={`Effective ${EFFECTIVE}`}>
      <p>
        This End-User License Agreement (“Agreement”) governs use of <strong>{APP}</strong> (the
        “Platform”), an internal business-operations application operated by {OPERATOR} on behalf of {ORG}.
        By accessing the Platform you agree to these terms.
      </p>
      <h2>1. License</h2>
      <p>
        {ORG} grants authorized employees, contractors and agents a limited, non-exclusive,
        non-transferable, revocable licence to use the Platform solely for {ORG}’s internal business
        operations. The Platform is not offered to the general public.
      </p>
      <h2>2. Acceptable use</h2>
      <p>You agree not to: (a) access data you are not authorized to view; (b) share account
        credentials; (c) reverse-engineer, copy or resell the Platform; or (d) use it to violate any
        applicable law or third-party rights, including the terms of any integrated service.</p>
      <h2>3. Third-party services (QuickBooks Online)</h2>
      <p>
        The Platform integrates with Intuit QuickBooks Online to read accounting reference data
        (customers and items) and to create invoices on behalf of {ORG}. Your use of those features is
        also subject to Intuit’s applicable terms. The connection is authorized by {ORG} and can be
        revoked at any time from within QuickBooks or the Platform.
      </p>
      <h2>4. Data &amp; confidentiality</h2>
      <p>All data accessed through the Platform is the confidential property of {ORG} and must be
        handled in line with {ORG}’s policies and our <a href="/legal/privacy">Privacy Policy</a>.</p>
      <h2>5. Warranty &amp; liability</h2>
      <p>The Platform is provided “as is” without warranties of any kind. To the maximum extent
        permitted by law, {ORG} and {OPERATOR} are not liable for any indirect or consequential loss
        arising from use of the Platform.</p>
      <h2>6. Termination</h2>
      <p>Access may be suspended or terminated at any time. Sections relating to confidentiality,
        warranty and liability survive termination.</p>
      <h2>7. Contact</h2>
      <p>Questions about this Agreement: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" subtitle={`Effective ${EFFECTIVE}`}>
      <p>
        This Privacy Policy explains how <strong>{APP}</strong>, operated by {OPERATOR} on behalf of {ORG},
        handles information. The Platform is an internal tool used by {ORG} staff; it is not a consumer
        product and does not market to the public.
      </p>
      <h2>1. Information we process</h2>
      <ul>
        <li><strong>Account data</strong> — staff names and email addresses used to sign in.</li>
        <li><strong>Operational data</strong> — vessel, crew, immigration, logistics and billing records
          entered by {ORG} for its own business.</li>
        <li><strong>QuickBooks Online data</strong> — when connected, we access customers and items
          (for reference) and create invoices in {ORG}’s QuickBooks company. We store the resulting
          invoice references and a securely-held OAuth token to maintain the connection. We do not
          access QuickBooks data beyond what is needed for these features.</li>
      </ul>
      <h2>2. How we use it</h2>
      <p>Solely to provide the Platform’s functions for {ORG} — managing vessels, crew and immigration,
        logistics, and generating invoices. We do not sell personal information or use it for advertising.</p>
      <h2>3. Storage &amp; security</h2>
      <p>Data is stored in {ORG}’s managed cloud infrastructure (Supabase / Cloudflare) with access
        restricted to authorized users. Credentials and integration tokens are encrypted at rest.</p>
      <h2>4. Sharing</h2>
      <p>We share data only with the service providers that operate the Platform (e.g. Supabase,
        Cloudflare, Microsoft, Intuit) as needed to deliver these functions, and where required by law.</p>
      <h2>5. Retention</h2>
      <p>Operational records are retained for as long as {ORG} requires for business and legal purposes.
        The QuickBooks connection can be revoked at any time, which stops further access.</p>
      <h2>6. Your rights &amp; contact</h2>
      <p>For access, correction or deletion requests, or any privacy question, contact{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalShell>
  );
}

export function QuickBooksDisconnectedPage() {
  return (
    <LegalShell title="QuickBooks disconnected" subtitle="The connection between Polaris and QuickBooks has been removed.">
      <p>
        {APP} no longer has access to your QuickBooks Online company. Invoice generation will be
        unavailable until QuickBooks is reconnected.
      </p>
      <p>
        To reconnect, an administrator can start the connection again from{" "}
        <a href="/api/qb/connect">Connect to QuickBooks</a>.
      </p>
    </LegalShell>
  );
}

export function QuickBooksConnectedPage() {
  const [realm, setRealm] = useState<string | null>(null);
  useEffect(() => {
    try { setRealm(new URLSearchParams(window.location.search).get("realm")); } catch { /* ignore */ }
  }, []);
  return (
    <LegalShell title="QuickBooks connected ✓" subtitle="Polaris can now create invoices in your QuickBooks company.">
      <p>The connection was authorized successfully{realm ? <> for company <code>{realm}</code></> : null}.
        You can close this tab and return to the Finance module to generate invoices.</p>
      <p><a href="/finance">Go to Finance</a></p>
    </LegalShell>
  );
}
