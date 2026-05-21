import Link from "next/link";
import { SiteHeader } from "../components/site-header";

const pillars = [
  {
    title: "Business Portal",
    body: "Clean onboarding, call records, lead capture, staff access, billing, and business settings in one focused system.",
  },
  {
    title: "AI Call Intelligence",
    body: "Answering conditions, greetings, voice selection, summaries, recordings, and calendar-aware booking flows.",
  },
  {
    title: "Platform Oversight",
    body: "Admin control across packages, invoices, support actions, service uptime, and account management.",
  },
];

const stats = [
  { value: "24/7", label: "call coverage with business-controlled answering rules" },
  { value: "1", label: "portal for transcripts, recordings, leads, billing, and admin visibility" },
  { value: "Multi", label: "industry flows for clinics, restaurants, salons, legal, and service teams" },
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <SiteHeader />
      <section className="container stack-lg">
        <div className="hero-card home-frame hero-modern">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">AI receptionist platform</span>
              <h1 className="display-title">
                The unified portal for <strong>calls</strong>, leads, billing, and business control.
              </h1>
              <p className="lead">
                Build one responsive system where companies configure how AI answers, what it says, which voice it
                uses, and how every transcript, recording, lead, and invoice gets handled after the call.
              </p>
              <div className="button-row" style={{ marginTop: 28 }}>
                <Link className="button" href="/signup">
                  Start company signup
                </Link>
                <Link className="button-secondary" href="/onboarding">
                  View onboarding
                </Link>
              </div>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="hero-orbit">
                <div className="connector connector-a" />
                <div className="connector connector-b" />
                <div className="connector connector-c" />
                <div className="connector connector-d" />

                <div className="node-card node-a">
                  <span>Phone Calls</span>
                  <small>Twilio intake</small>
                </div>
                <div className="node-card node-b">
                  <span>Schedules</span>
                  <small>Calendar sync</small>
                </div>
                <div className="node-card node-c">
                  <span>Billing</span>
                  <small>Plans and invoices</small>
                </div>
                <div className="node-card node-d">
                  <span>Lead Intake</span>
                  <small>Summary and transcript</small>
                </div>

                <div className="hero-platform">
                  <div className="platform-grid">
                    <div className="platform-tile active" />
                    <div className="platform-tile" />
                    <div className="platform-tile" />
                    <div className="platform-tile" />
                    <div className="platform-tile active" />
                    <div className="platform-tile" />
                    <div className="platform-tile" />
                    <div className="platform-tile" />
                    <div className="platform-tile active" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="stats-row">
          {stats.map((stat) => (
            <div key={stat.value} className="stat-card">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section className="grid-3">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="feature-card">
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </section>

        <section className="contact-section" id="contact">
          <div className="contact-header">
            <span className="eyebrow">Get in touch</span>
            <h2 className="contact-title">Talk to the team behind Receptionist AI</h2>
            <p className="contact-subtitle">
              Built by DeltaPrompt AI, a full-service AI agency helping businesses Stop Waiting and Start Winning with AI.
            </p>
          </div>

          <div className="contact-grid">
            <a className="contact-card" href="mailto:mahesh@deltaprompt.ai">
              <span className="contact-icon" aria-hidden="true">✉️</span>
              <div className="contact-text">
                <small>Email us</small>
                <strong>mahesh@deltaprompt.ai</strong>
              </div>
            </a>

            <a className="contact-card" href="tel:+14379901708">
              <span className="contact-icon" aria-hidden="true">📞</span>
              <div className="contact-text">
                <small>Call us</small>
                <strong>+1 (437) 990-1708</strong>
              </div>
            </a>

            <a className="contact-card" href="https://www.deltaprompt.ai/" target="_blank" rel="noopener noreferrer">
              <span className="contact-icon" aria-hidden="true">🌐</span>
              <div className="contact-text">
                <small>Visit our site</small>
                <strong>www.deltaprompt.ai</strong>
              </div>
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
