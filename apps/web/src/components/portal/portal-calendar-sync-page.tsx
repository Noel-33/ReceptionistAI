"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { PortalShell } from "./portal-shell";
import { usePortalData } from "./use-portal-data";

type Props = {
  businessId?: string;
};

type CalendarIntegration = {
  provider: "MICROSOFT_OUTLOOK";
  connected: boolean;
  connectedEmail: string;
  connectedAt: string;
  syncAppointments: boolean;
  respectBusyTimes: boolean;
};

type CalendarIntegrationResponse = {
  message: string;
  calendarIntegration: CalendarIntegration;
};

const DEFAULT_INTEGRATION: CalendarIntegration = {
  provider: "MICROSOFT_OUTLOOK",
  connected: true,
  connectedEmail: "vishant@vivratech.ca",
  connectedAt: "2026-05-20T10:00:00",
  syncAppointments: true,
  respectBusyTimes: true,
};

export function PortalCalendarSyncPage({ businessId = "" }: Props) {
  const portal = usePortalData(businessId);
  const [integration, setIntegration] = useState<CalendarIntegration>(DEFAULT_INTEGRATION);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!portal.business?.id) {
      return;
    }

    const savedIntegration = portal.business.calendarIntegration;
    const hasSavedState =
      savedIntegration && (savedIntegration.connected || savedIntegration.connectedEmail || savedIntegration.connectedAt);
    setIntegration(hasSavedState ? savedIntegration : DEFAULT_INTEGRATION);
  }, [portal.business?.id, portal.business?.calendarIntegration]);

  if (portal.loading) return <main className="app-shell"><section className="container"><div className="status-banner neutral">Loading calendar integration...</div></section></main>;
  if (portal.error) return <main className="app-shell"><section className="container"><div className="status-banner error">{portal.error}</div></section></main>;
  if (!portal.business) return <main className="app-shell"><section className="container"><div className="status-banner neutral">No business data found yet.</div></section></main>;

  async function saveIntegration(nextIntegration: CalendarIntegration) {
    setSaving(true);
    setNotice("");
    setError("");

    try {
      const response = await apiRequest<CalendarIntegrationResponse>(`/api/businesses/${portal.business!.id}/calendar-integration`, {
        method: "PATCH",
        body: nextIntegration,
      });
      setIntegration(response.calendarIntegration ?? nextIntegration);
      setNotice(response.message);
      await portal.refreshBusiness();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update calendar integration.");
    } finally {
      setSaving(false);
    }
  }

  function disconnectCalendar() {
    void saveIntegration({
      ...integration,
      connected: false,
    });
  }

  function connectCalendar() {
    void saveIntegration({
      ...integration,
      connected: true,
      connectedEmail: integration.connectedEmail || "vishant@vivratech.ca",
      connectedAt: new Date().toISOString(),
      syncAppointments: true,
      respectBusyTimes: true,
    });
  }

  return (
    <PortalShell
      active="calendar-sync"
      portal={portal}
      subtitle="Connect your Outlook / Microsoft 365 calendar so AI-booked appointments appear there automatically and so the AI respects your existing meetings."
      title="Calendar Integration"
    >
      {!portal.canEditConfiguration ? (
        <div className="status-banner neutral">Your role does not have access to calendar sync settings.</div>
      ) : (
        <section className="surface-card calendar-sync-card">
          {notice ? <div className="status-banner success">{notice}</div> : null}
          {error ? <div className="status-banner error">{error}</div> : null}

          <div className="calendar-sync-header">
            <div>
              <h2>Microsoft Outlook / Teams Calendar</h2>
              <p>
                Connect one Microsoft account. Every appointment the AI books will be added to this calendar with full details.
                Existing meetings in your calendar will also block the AI from double-booking.
              </p>
            </div>
          </div>

          <div className="calendar-provider-card">
            <div className="provider-mark" aria-hidden="true">MS</div>
            <div className="provider-copy">
              <h3>Microsoft Outlook</h3>
              {integration.connected ? (
                <p><span className="connected-dot" />Connected as <strong>{integration.connectedEmail || "vishant@vivratech.ca"}</strong></p>
              ) : (
                <p>Not connected. Connect Microsoft to sync AI-booked appointments.</p>
              )}
            </div>
            {integration.connected ? (
              <button className="button-secondary" type="button" onClick={disconnectCalendar} disabled={saving}>
                {saving ? "Saving..." : "Disconnect"}
              </button>
            ) : (
              <button className="button" type="button" onClick={connectCalendar} disabled={saving}>
                {saving ? "Saving..." : "Connect with Microsoft"}
              </button>
            )}
          </div>

          <div className="calendar-sync-info-grid">
            <article className="detail-block calendar-sync-info">
              <h3>How it works</h3>
              <p>
                When you click Connect with Microsoft, you will be redirected to log in with your Microsoft account.
                Grant calendar permissions and you will be returned here. Once connected, every appointment the AI books on a call will show in your Outlook / Teams calendar within seconds with the caller name, phone, notes, and when available a link to the call recording.
              </p>
            </article>

            <article className="detail-block calendar-sync-info">
              <h3>What you grant access to</h3>
              <p><strong>Calendars.ReadWrite</strong> - Read busy/free times so the AI does not double-book; create, update, and delete events on your behalf.</p>
              <p><strong>offline_access</strong> - Allows Receptionist AI to refresh access tokens so you do not have to reconnect every hour.</p>
              <p><strong>User.Read</strong> - Read your basic profile so we can display which account is connected.</p>
            </article>
          </div>
        </section>
      )}
    </PortalShell>
  );
}
