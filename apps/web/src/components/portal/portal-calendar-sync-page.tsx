"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../../lib/api";
import { PortalShell } from "./portal-shell";
import { usePortalData } from "./use-portal-data";

type Props = {
  businessId?: string;
};

type CalendarIntegration = {
  provider: "GOOGLE_CALENDAR";
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

type CalendarHealthStatus = "DISCONNECTED" | "HEALTHY" | "ERROR";

type CalendarHealth = {
  provider: "GOOGLE_CALENDAR";
  connected: boolean;
  connectedEmail: string;
  calendarId: string;
  status: CalendarHealthStatus;
  message: string;
  syncAppointments: boolean;
  respectBusyTimes: boolean;
  tokenExpiresAt: string;
  lastHealthCheckedAt: string;
  lastHealthStatus: string;
  lastHealthError: string;
  lastSyncAt: string;
  lastSyncStatus: string;
  lastSyncError: string;
  lastSyncImportedCount: number;
  lastSyncUpdatedCount: number;
  lastSyncDeletedCount: number;
  twoWaySyncMode: string;
  pushNotificationsEnabled: boolean;
  pushNotificationsNote: string;
};

type CalendarSyncResponse = {
  message: string;
  sync: {
    importedCount: number;
    updatedCount: number;
    deletedCount: number;
    syncedAt: string;
  };
  health: CalendarHealth;
};

const DEFAULT_INTEGRATION: CalendarIntegration = {
  provider: "GOOGLE_CALENDAR",
  connected: false,
  connectedEmail: "",
  connectedAt: "",
  syncAppointments: true,
  respectBusyTimes: true,
};

const DEFAULT_HEALTH: CalendarHealth = {
  provider: "GOOGLE_CALENDAR",
  connected: false,
  connectedEmail: "",
  calendarId: "primary",
  status: "DISCONNECTED",
  message: "Google Calendar is not connected.",
  syncAppointments: true,
  respectBusyTimes: true,
  tokenExpiresAt: "",
  lastHealthCheckedAt: "",
  lastHealthStatus: "",
  lastHealthError: "",
  lastSyncAt: "",
  lastSyncStatus: "",
  lastSyncError: "",
  lastSyncImportedCount: 0,
  lastSyncUpdatedCount: 0,
  lastSyncDeletedCount: 0,
  twoWaySyncMode: "manual-pull",
  pushNotificationsEnabled: false,
  pushNotificationsNote: "Google push sync needs a deployed HTTPS webhook. Manual two-way sync is available now.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatCalendarDate(value: string) {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: CalendarHealthStatus | string) {
  if (status === "HEALTHY") return "Healthy";
  if (status === "ERROR") return "Action needed";
  return "Not connected";
}

function formatCalendarSyncSummary(importedCount: number, updatedCount: number, deletedCount: number) {
  if (importedCount + updatedCount + deletedCount === 0) {
    return "No new Google changes found.";
  }

  return `${importedCount} imported, ${updatedCount} updated, ${deletedCount} canceled.`;
}

export function PortalCalendarSyncPage({ businessId = "" }: Props) {
  const portal = usePortalData(businessId);
  const [integration, setIntegration] = useState<CalendarIntegration>(DEFAULT_INTEGRATION);
  const [health, setHealth] = useState<CalendarHealth>(DEFAULT_HEALTH);
  const [saving, setSaving] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!portal.business?.id) {
      return;
    }

    setIntegration(portal.business.calendarIntegration ?? DEFAULT_INTEGRATION);
  }, [portal.business?.id, portal.business?.calendarIntegration]);

  useEffect(() => {
    if (!portal.business?.id) {
      return;
    }

    if (!integration.connected) {
      setHealth(DEFAULT_HEALTH);
      return;
    }

    void refreshHealth(false);
  }, [portal.business?.id, integration.connected]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarStatus = params.get("calendar");

    if (calendarStatus === "connected") {
      setNotice("Google Calendar connected successfully.");
    }

    if (calendarStatus === "error") {
      setError("Google Calendar connection was not completed. Please try again.");
    }
  }, []);

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
      if (!response.calendarIntegration?.connected) {
        setHealth(DEFAULT_HEALTH);
      }
      setNotice(response.message);
      await portal.refreshBusiness();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update calendar integration.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshHealth(showNotice = true) {
    if (!portal.business?.id) {
      return;
    }

    setCheckingHealth(true);
    setError("");

    try {
      const response = await apiRequest<CalendarHealth>(`/api/calendar/google/health?businessId=${encodeURIComponent(portal.business.id)}`);
      setHealth(response);
      if (showNotice) {
        setNotice(response.message);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to check Google Calendar health.");
    } finally {
      setCheckingHealth(false);
    }
  }

  async function syncNow() {
    if (!portal.business?.id) {
      return;
    }

    setSyncing(true);
    setNotice("");
    setError("");

    try {
      const response = await apiRequest<CalendarSyncResponse>("/api/calendar/google/sync", {
        method: "POST",
        body: { businessId: portal.business.id },
      });
      setHealth(response.health);
      setNotice(`${response.message} ${formatCalendarSyncSummary(
        response.sync.importedCount,
        response.sync.updatedCount,
        response.sync.deletedCount,
      )}`);
      await portal.refreshBusiness();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sync Google Calendar.");
      await refreshHealth(false);
    } finally {
      setSyncing(false);
    }
  }

  function disconnectCalendar() {
    void saveIntegration({
      ...integration,
      connected: false,
    });
  }

  function connectCalendar() {
    window.location.href = `${API_URL}/api/calendar/google/connect?businessId=${encodeURIComponent(portal.business!.id)}`;
  }

  return (
    <PortalShell
      active="calendar-sync"
      portal={portal}
      subtitle="Connect Google Calendar so AI-booked appointments appear there automatically and the AI respects your existing meetings."
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
              <h2>Google Calendar</h2>
              <p>
                Connect one Google account. Every appointment the AI books will be added to this calendar with full details.
                Existing meetings in your calendar will also block the AI from double-booking.
              </p>
            </div>
          </div>

          <div className="calendar-provider-card">
            <div className="provider-mark" aria-hidden="true">G</div>
            <div className="provider-copy">
              <h3>Google Calendar</h3>
              {integration.connected ? (
                <p><span className="connected-dot" />Connected as <strong>{integration.connectedEmail || "Google account"}</strong></p>
              ) : (
                <p>Not connected. Connect Google to sync AI-booked appointments.</p>
              )}
            </div>
            {integration.connected ? (
              <button className="button-secondary" type="button" onClick={disconnectCalendar} disabled={saving}>
                {saving ? "Saving..." : "Disconnect"}
              </button>
            ) : (
              <button className="button" type="button" onClick={connectCalendar} disabled={saving}>
                Connect with Google
              </button>
            )}
          </div>

          <section className="calendar-health-panel">
            <div className="calendar-health-heading">
              <div>
                <span className={`calendar-health-pill ${health.status.toLowerCase()}`}>{statusLabel(health.status)}</span>
                <h3>Sync health</h3>
                <p>{health.message}</p>
              </div>
              <div className="calendar-health-actions">
                <button className="button-secondary" type="button" onClick={() => refreshHealth(true)} disabled={!integration.connected || checkingHealth}>
                  {checkingHealth ? "Checking..." : "Check health"}
                </button>
                <button className="button" type="button" onClick={syncNow} disabled={!integration.connected || syncing}>
                  {syncing ? "Syncing..." : "Sync now"}
                </button>
              </div>
            </div>

            <div className="calendar-health-grid">
              <div>
                <span>Account</span>
                <strong>{health.connectedEmail || integration.connectedEmail || "Not connected"}</strong>
              </div>
              <div>
                <span>Last health check</span>
                <strong>{formatCalendarDate(health.lastHealthCheckedAt)}</strong>
              </div>
              <div>
                <span>Last two-way sync</span>
                <strong>{formatCalendarDate(health.lastSyncAt)}</strong>
              </div>
              <div>
                <span>Last sync result</span>
                <strong>
                  {health.lastSyncStatus
                    ? formatCalendarSyncSummary(health.lastSyncImportedCount, health.lastSyncUpdatedCount, health.lastSyncDeletedCount)
                    : "Not yet"}
                </strong>
              </div>
              <div>
                <span>Sync mode</span>
                <strong>{health.twoWaySyncMode === "manual-pull" ? "Manual two-way pull" : health.twoWaySyncMode}</strong>
              </div>
              <div>
                <span>Push webhooks</span>
                <strong>{health.pushNotificationsEnabled ? "Active" : "Ready after deploy"}</strong>
              </div>
            </div>

            {health.lastHealthError || health.lastSyncError ? (
              <div className="status-banner error">{health.lastHealthError || health.lastSyncError}</div>
            ) : null}
          </section>

          <div className="calendar-sync-info-grid">
            <article className="detail-block calendar-sync-info">
              <h3>How it works</h3>
              <p>
                When you click Connect with Google, you will be redirected to log in with your Google account.
                Grant calendar permissions and you will be returned here. Once connected, every appointment the AI books on a call will show in your Google Calendar within seconds with the caller name, phone, notes, and service details.
              </p>
            </article>

            <article className="detail-block calendar-sync-info">
              <h3>What you grant access to</h3>
              <p><strong>calendar.events</strong> - Create, update, and delete appointment events on your Google Calendar.</p>
              <p><strong>calendar.freebusy</strong> - Read busy/free times so the AI does not double-book.</p>
              <p><strong>email</strong> - Display which Google account is connected.</p>
            </article>
          </div>
        </section>
      )}
    </PortalShell>
  );
}
