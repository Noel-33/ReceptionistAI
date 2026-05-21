"use client";

import { PortalShell } from "./portal-shell";
import { usePortalData } from "./use-portal-data";

type Props = {
  businessId?: string;
};

export function PortalDashboardPage({ businessId = "" }: Props) {
  const portal = usePortalData(businessId);

  if (portal.loading) return <main className="app-shell"><section className="container"><div className="status-banner neutral">Loading business portal...</div></section></main>;
  if (portal.error) return <main className="app-shell"><section className="container"><div className="status-banner error">{portal.error}</div></section></main>;
  if (!portal.business) return <main className="app-shell"><section className="container"><div className="status-banner neutral">No business data found yet.</div></section></main>;

  const cards = [
    { title: "Onboarding", value: portal.business.onboardingCompleted ? "Completed" : "Pending" },
    { title: "Medical Mode", value: portal.business.medicalModeEnabled ? "Enabled" : "Disabled" },
    { title: "AI Status", value: portal.business.aiEnabled ? "Live" : "Not live yet" },
    { title: "Team members", value: String(portal.members.length) },
  ];
  const isPharmacy = portal.business.category === "PHARMACY";
  const isLeadCapturePortal = portal.business.conversationGoal === "CAPTURE_LEADS";

  return (
    <PortalShell
      active="dashboard"
      portal={portal}
      subtitle={portal.business.description || "A clear command center for the first version of your portal."}
      title={portal.business.name}
    >
      <section className="stats-row">
        {cards.map((card) => (
          <div key={card.title} className="stat-card">
            <span>{card.title}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </section>

      <section className="grid-3">
        <article className="feature-card">
          <h3>{isLeadCapturePortal ? "AI lead answering" : "AI answering"}</h3>
          <p>
            {isLeadCapturePortal
              ? "Control how the AI qualifies callers, captures business details, and prepares follow-up for the team."
              : "Control call-answering conditions, after-hours logic, and ring-based takeover rules."}
          </p>
        </article>
        <article className="feature-card">
          <h3>{isLeadCapturePortal ? "Knowledge base" : "Call records"}</h3>
          <p>
            {isLeadCapturePortal
              ? "Shape services, FAQs, objection handling, differentiators, and the lead capture script from one workspace."
              : "Review caller details, transcripts, summaries, and recording references in a single business log."}
          </p>
        </article>
        <article className="feature-card">
          <h3>Telephony readiness</h3>
          <p>Prepare Twilio routing, fallback handoff, consent messaging, and live AI call connection rules.</p>
        </article>
        {isLeadCapturePortal ? (
          <article className="feature-card">
            <h3>Service catalog</h3>
            <p>Keep DeltaPrompt AI offerings ready for callers, from AI call handling to custom applications and marketing automation.</p>
          </article>
        ) : null}
        {isPharmacy ? (
          <>
            <article className="feature-card">
              <h3>Refill tracking</h3>
              <p>Log refill requests with statuses like under review, approved, and ready for pickup.</p>
            </article>
            <article className="feature-card">
              <h3>Pharmacist callbacks</h3>
              <p>Track who still needs a callback, which requests are urgent, and whether follow-up has happened.</p>
            </article>
          </>
        ) : null}
        {portal.canViewBilling ? (
          <article className="feature-card">
            <h3>Billing visibility</h3>
            <p>Track plan, billing cycle, and later invoices, reminders, and payment automation.</p>
          </article>
        ) : null}
      </section>
    </PortalShell>
  );
}
