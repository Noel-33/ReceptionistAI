"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import { clearSession, getSession } from "../../lib/session";
import { PasswordChangeForm } from "../auth/password-change-form";

type AdminBusiness = {
  id: string;
  name: string;
  category: string;
  businessEmail: string;
  ownerEmail: string;
  ownerName: string;
  phoneNumber: string;
  address: string;
  timezone: string;
  twilioNumber: string;
  selectedPlan: string;
  billingCycle: string;
  billingStatus: string;
  includedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  overageMinutes: number;
  overageRatePerMinute: number;
  aiEnabled: boolean;
  medicalModeEnabled: boolean;
  onboardingCompleted: boolean;
  memberCount: number;
  members: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
  }>;
  appointments?: AppointmentItem[];
  appointmentsConfigured?: boolean;
  calendarIntegration?: CalendarIntegration;
  createdAt: string;
};

type AdminOverviewResponse = {
  businesses: AdminBusiness[];
};

type AppointmentStatus = "CONFIRMED" | "PENDING" | "COMPLETED" | "CANCELED";
type AppointmentSource = "AI_BOOKED" | "MANUAL" | "GOOGLE_SYNC" | "MICROSOFT_SYNC";
type AppointmentAccent = "blue" | "green" | "red";

type AppointmentItem = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceType: string;
  status: AppointmentStatus;
  notes: string;
  source: AppointmentSource;
  accent: AppointmentAccent;
  googleEventId?: string;
  googleCalendarId?: string;
};

type CalendarIntegration = {
  provider: "GOOGLE_CALENDAR";
  connected: boolean;
  connectedEmail: string;
  connectedAt: string;
  syncAppointments: boolean;
  respectBusyTimes: boolean;
};

type AppointmentsResponse = {
  message: string;
  appointments: AppointmentItem[];
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

const ADMIN_WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const ADMIN_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ADMIN_STATUS_LABELS: Record<AppointmentStatus, string> = {
  CONFIRMED: "Confirmed",
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

const ADMIN_DEFAULT_CALENDAR: CalendarIntegration = {
  provider: "GOOGLE_CALENDAR",
  connected: false,
  connectedEmail: "",
  connectedAt: "",
  syncAppointments: true,
  respectBusyTimes: true,
};

const ADMIN_DEFAULT_HEALTH: CalendarHealth = {
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

function formatAdminDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAdminDateTime(value: string) {
  if (!value) {
    return "Not yet";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not yet";
  }

  return parsed.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function calendarHealthLabel(status: CalendarHealthStatus | string) {
  if (status === "HEALTHY") return "Healthy";
  if (status === "ERROR") return "Action needed";
  return "Not connected";
}

function formatAdminCalendarSyncSummary(importedCount: number, updatedCount: number, deletedCount: number) {
  if (importedCount + updatedCount + deletedCount === 0) {
    return "No new Google changes found.";
  }

  return `${importedCount} imported, ${updatedCount} updated, ${deletedCount} canceled.`;
}

function adminUid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function adminPad(value: number) {
  return String(value).padStart(2, "0");
}

function adminDateKey(date: Date) {
  return `${date.getFullYear()}-${adminPad(date.getMonth() + 1)}-${adminPad(date.getDate())}`;
}

function adminStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function nextAdminAppointmentDateTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${adminDateKey(date)}T${adminPad(date.getHours())}:${adminPad(date.getMinutes())}:00`;
}

function parseAdminDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toAdminInputDateTime(value: string) {
  const date = parseAdminDate(value);
  return `${date.getFullYear()}-${adminPad(date.getMonth() + 1)}-${adminPad(date.getDate())}T${adminPad(date.getHours())}:${adminPad(date.getMinutes())}`;
}

function fromAdminInputDateTime(value: string) {
  return value.length === 16 ? `${value}:00` : value;
}

function formatAdminMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function formatAdminEventTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parseAdminDate(value));
}

function formatAdminAppointmentTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parseAdminDate(value));
}

function buildAdminMonthCells(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function buildAdminDefaultAppointments(businessName: string): AppointmentItem[] {
  return [
    {
      id: "admin-demo-jenex",
      title: "Jenex discovery call",
      startsAt: "2026-05-19T07:30:00",
      durationMinutes: 30,
      customerName: "Jenex",
      customerPhone: "519-555-0171",
      customerEmail: "",
      serviceType: "AI Receptionist Demo",
      status: "CONFIRMED",
      notes: `Business: ${businessName}. Discovery call booked by the AI receptionist.`,
      source: "AI_BOOKED",
      accent: "green",
    },
    {
      id: "admin-demo-abc",
      title: "ABC lead review",
      startsAt: "2026-05-19T08:00:00",
      durationMinutes: 30,
      customerName: "ABC Services",
      customerPhone: "416-555-0188",
      customerEmail: "",
      serviceType: "Lead Qualification",
      status: "CONFIRMED",
      notes: `Business: ${businessName}. Lead asked about after-hours call answering.`,
      source: "AI_BOOKED",
      accent: "green",
    },
    {
      id: "admin-demo-canceled",
      title: "Call with canceled lead",
      startsAt: "2026-05-19T08:30:00",
      durationMinutes: 30,
      customerName: "Canceled lead",
      customerPhone: "905-555-0136",
      customerEmail: "",
      serviceType: "General Consultation",
      status: "CANCELED",
      notes: "Caller requested to move this call to next week.",
      source: "MANUAL",
      accent: "red",
    },
    {
      id: "admin-demo-ai-strategy",
      title: "AI strategy session",
      startsAt: "2026-05-20T07:00:00",
      durationMinutes: 45,
      customerName: "Strategy lead",
      customerPhone: "647-555-0142",
      customerEmail: "",
      serviceType: "AI Strategy",
      status: "CONFIRMED",
      notes: `Business: ${businessName}. Caller wants to discuss AI automation opportunities.`,
      source: "AI_BOOKED",
      accent: "blue",
    },
    {
      id: "admin-demo-vishant",
      title: "Call with Vishant",
      startsAt: "2026-05-20T10:00:00",
      durationMinutes: 30,
      customerName: "Vishant Bhatia",
      customerPhone: "905-781-7529",
      customerEmail: "",
      serviceType: "General Consultation",
      status: "CONFIRMED",
      notes: `Business: ${businessName}. Appointment for a general consultation.`,
      source: "AI_BOOKED",
      accent: "green",
    },
    {
      id: "admin-demo-call-review",
      title: "Call review",
      startsAt: "2026-05-20T11:00:00",
      durationMinutes: 30,
      customerName: "DeltaPrompt prospect",
      customerPhone: "289-555-0125",
      customerEmail: "",
      serviceType: "AI Receptionist Demo",
      status: "CONFIRMED",
      notes: "Review caller needs and confirm next steps.",
      source: "AI_BOOKED",
      accent: "blue",
    },
    {
      id: "admin-demo-call-21",
      title: "Call with service lead",
      startsAt: "2026-05-21T07:00:00",
      durationMinutes: 30,
      customerName: "Service lead",
      customerPhone: "437-555-0199",
      customerEmail: "",
      serviceType: "General Consultation",
      status: "CONFIRMED",
      notes: "Lead asked about connecting Twilio to AI call handling.",
      source: "AI_BOOKED",
      accent: "blue",
    },
    {
      id: "admin-demo-call-25",
      title: "Call with morning lead",
      startsAt: "2026-05-25T06:00:00",
      durationMinutes: 30,
      customerName: "Morning lead",
      customerPhone: "905-555-0104",
      customerEmail: "",
      serviceType: "General Consultation",
      status: "CONFIRMED",
      notes: "Early consultation request captured by the receptionist.",
      source: "AI_BOOKED",
      accent: "blue",
    },
  ];
}

function emptyAdminAppointment(businessName: string, startsAt = nextAdminAppointmentDateTime()): AppointmentItem {
  return {
    id: adminUid(),
    title: "New consultation",
    startsAt,
    durationMinutes: 30,
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    serviceType: "General Consultation",
    status: "CONFIRMED",
    notes: `Business: ${businessName}. Appointment for a general consultation.`,
    source: "MANUAL",
    accent: "blue",
  };
}

function resolveAdminCalendarIntegration(calendar?: CalendarIntegration) {
  if (calendar && (calendar.connected || calendar.connectedEmail || calendar.connectedAt)) {
    return calendar;
  }

  return ADMIN_DEFAULT_CALENDAR;
}

export function AdminDashboardPage() {
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingBilling, setSavingBilling] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [error, setError] = useState("");
  const [billingSuccess, setBillingSuccess] = useState("");
  const [passwordResetSuccess, setPasswordResetSuccess] = useState("");
  const [passwordDraftEmail, setPasswordDraftEmail] = useState("");
  const adminToday = useMemo(() => new Date(), []);
  const [adminVisibleMonth, setAdminVisibleMonth] = useState(() => adminStartOfMonth(new Date()));
  const [adminAppointmentView, setAdminAppointmentView] = useState<"month" | "list">("month");
  const [adminAppointments, setAdminAppointments] = useState<AppointmentItem[]>([]);
  const [activeAppointment, setActiveAppointment] = useState<AppointmentItem | null>(null);
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);
  const [savingAppointments, setSavingAppointments] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState("");
  const [appointmentError, setAppointmentError] = useState("");
  const [savingCalendar, setSavingCalendar] = useState(false);
  const [checkingCalendarHealth, setCheckingCalendarHealth] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [adminCalendarHealth, setAdminCalendarHealth] = useState<CalendarHealth>(ADMIN_DEFAULT_HEALTH);
  const [calendarSuccess, setCalendarSuccess] = useState("");

  useEffect(() => {
    setSession(getSession());
  }, []);

  async function loadOverview() {
    const response = await apiRequest<AdminOverviewResponse>("/api/businesses/admin/overview");
    setData(response);

    if (!selectedBusinessId && response.businesses[0]) {
      setSelectedBusinessId(response.businesses[0].id);
    }
  }

  useEffect(() => {
    if (session === null) {
      return;
    }

    if (!session.admin) {
      window.location.href = "/signin";
      return;
    }

    loadOverview()
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load admin portal.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session]);

  const selectedBusiness = useMemo(
    () => data?.businesses.find((business) => business.id === selectedBusinessId) || data?.businesses[0] || null,
    [data, selectedBusinessId],
  );

  useEffect(() => {
    setPasswordDraftEmail(selectedBusiness?.ownerEmail || "");
  }, [selectedBusiness?.id, selectedBusiness?.ownerEmail]);

  useEffect(() => {
    if (!selectedBusiness) {
      setAdminAppointments([]);
      return;
    }

    const nextAppointments = selectedBusiness.appointmentsConfigured
      ? selectedBusiness.appointments ?? []
      : buildAdminDefaultAppointments(selectedBusiness.name);

    setAdminAppointments(nextAppointments);
    setAdminVisibleMonth(adminStartOfMonth(new Date()));
    setAdminAppointmentView("month");
    setActiveAppointment(null);
    setAppointmentSuccess("");
    setAppointmentError("");
    setCalendarSuccess("");
    setAdminCalendarHealth(ADMIN_DEFAULT_HEALTH);
  }, [selectedBusiness?.id, selectedBusiness?.name]);

  const billingFormKey = selectedBusiness
    ? [
        selectedBusiness.id,
        selectedBusiness.selectedPlan,
        selectedBusiness.billingCycle,
        selectedBusiness.billingStatus,
        selectedBusiness.includedMinutes,
        selectedBusiness.overageRatePerMinute,
      ].join(":")
    : "no-business";

  const resetFormKey = selectedBusiness
    ? `${selectedBusiness.id}:${selectedBusiness.ownerEmail}`
    : "no-reset-target";

  const usagePercent =
    selectedBusiness && selectedBusiness.includedMinutes > 0
      ? Math.min(100, Math.round((selectedBusiness.usedMinutes / selectedBusiness.includedMinutes) * 100))
      : 0;

  const adminCalendarIntegration = selectedBusiness
    ? resolveAdminCalendarIntegration(selectedBusiness.calendarIntegration)
    : ADMIN_DEFAULT_CALENDAR;

  useEffect(() => {
    if (!selectedBusiness?.id || !adminCalendarIntegration.connected) {
      setAdminCalendarHealth(ADMIN_DEFAULT_HEALTH);
      return;
    }

    void refreshAdminCalendarHealth(false);
  }, [selectedBusiness?.id, adminCalendarIntegration.connected]);

  const adminCalendarCells = useMemo(() => buildAdminMonthCells(adminVisibleMonth), [adminVisibleMonth]);
  const adminEventsByDay = useMemo(() => {
    return adminAppointments.reduce<Record<string, AppointmentItem[]>>((acc, appointment) => {
      const key = adminDateKey(parseAdminDate(appointment.startsAt));
      acc[key] = [...(acc[key] ?? []), appointment].sort(
        (a, b) => parseAdminDate(a.startsAt).getTime() - parseAdminDate(b.startsAt).getTime(),
      );
      return acc;
    }, {});
  }, [adminAppointments]);

  const sortedAdminAppointments = useMemo(
    () => [...adminAppointments].sort((a, b) => parseAdminDate(a.startsAt).getTime() - parseAdminDate(b.startsAt).getTime()),
    [adminAppointments],
  );

  async function onSubmitBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedBusiness) {
      return;
    }

    setSavingBilling(true);
    setError("");
    setBillingSuccess("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      planName: String(formData.get("planName") ?? selectedBusiness.selectedPlan),
      billingCycle: String(formData.get("billingCycle") ?? selectedBusiness.billingCycle),
      status: String(formData.get("billingStatus") ?? selectedBusiness.billingStatus),
      includedMinutesPerMonth: Number(formData.get("includedMinutesPerMonth") ?? selectedBusiness.includedMinutes),
      overageRatePerMinute: Number(formData.get("overageRatePerMinute") ?? selectedBusiness.overageRatePerMinute),
    };

    try {
      const response = await apiRequest<{ message: string }>(`/api/businesses/${selectedBusiness.id}/billing-settings`, {
        method: "PATCH",
        body: payload,
      });
      await loadOverview();
      setBillingSuccess(response.message);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save admin billing settings.");
    } finally {
      setSavingBilling(false);
    }
  }

  async function onResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedBusiness) {
      return;
    }

    setResettingPassword(true);
    setError("");
    setPasswordResetSuccess("");

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String((formData.get("email") ?? passwordDraftEmail) || selectedBusiness.ownerEmail),
      newPassword: String(formData.get("newPassword") ?? ""),
    };

    try {
      const response = await apiRequest<{ message: string }>("/api/auth/admin/reset-password", {
        method: "POST",
        body: payload,
      });
      setPasswordResetSuccess(response.message);
      event.currentTarget.reset();
      setPasswordDraftEmail(selectedBusiness.ownerEmail || "");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reset user password.");
    } finally {
      setResettingPassword(false);
    }
  }

  function moveAdminMonth(delta: number) {
    setAdminVisibleMonth(new Date(adminVisibleMonth.getFullYear(), adminVisibleMonth.getMonth() + delta, 1));
  }

  function openAdminNewAppointment(startsAt?: string) {
    if (!selectedBusiness) {
      return;
    }

    setAppointmentError("");
    setAppointmentSuccess("");
    setIsCreatingAppointment(true);
    setActiveAppointment(emptyAdminAppointment(selectedBusiness.name, startsAt));
  }

  function openAdminEditAppointment(appointment: AppointmentItem) {
    setAppointmentError("");
    setAppointmentSuccess("");
    setIsCreatingAppointment(false);
    setActiveAppointment({ ...appointment });
  }

  async function persistAdminAppointments(nextAppointments: AppointmentItem[], message: string) {
    if (!selectedBusiness) {
      return;
    }

    setSavingAppointments(true);
    setAppointmentError("");
    setAppointmentSuccess("");

    try {
      const response = await apiRequest<AppointmentsResponse>(`/api/businesses/${selectedBusiness.id}/appointments`, {
        method: "PATCH",
        body: { appointments: nextAppointments },
      });
      setAdminAppointments(response.appointments ?? nextAppointments);
      setAppointmentSuccess(response.message || message);
      setActiveAppointment(null);
      await loadOverview();
    } catch (requestError) {
      setAppointmentError(requestError instanceof Error ? requestError.message : "Unable to save appointments.");
    } finally {
      setSavingAppointments(false);
    }
  }

  function saveActiveAdminAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeAppointment) {
      return;
    }

    if (!activeAppointment.title.trim()) {
      setAppointmentError("Appointment title is required.");
      return;
    }

    const normalizedAppointment: AppointmentItem = {
      ...activeAppointment,
      title: activeAppointment.title.trim(),
      customerName: activeAppointment.customerName.trim(),
      customerPhone: activeAppointment.customerPhone.trim(),
      customerEmail: activeAppointment.customerEmail.trim(),
      serviceType: activeAppointment.serviceType.trim(),
      notes: activeAppointment.notes.trim(),
      accent: activeAppointment.status === "CANCELED" ? "red" : activeAppointment.accent,
    };

    const nextAppointments = isCreatingAppointment
      ? [...adminAppointments, normalizedAppointment]
      : adminAppointments.map((appointment) => (appointment.id === normalizedAppointment.id ? normalizedAppointment : appointment));

    void persistAdminAppointments(nextAppointments, "Appointment saved.");
  }

  function deleteActiveAdminAppointment() {
    if (!activeAppointment || isCreatingAppointment) {
      return;
    }

    const nextAppointments = adminAppointments.filter((appointment) => appointment.id !== activeAppointment.id);
    void persistAdminAppointments(nextAppointments, "Appointment removed.");
  }

  async function saveAdminCalendarIntegration(nextIntegration: CalendarIntegration) {
    if (!selectedBusiness) {
      return;
    }

    setSavingCalendar(true);
    setError("");
    setCalendarSuccess("");

    try {
      const response = await apiRequest<CalendarIntegrationResponse>(`/api/businesses/${selectedBusiness.id}/calendar-integration`, {
        method: "PATCH",
        body: nextIntegration,
      });
      if (!response.calendarIntegration?.connected) {
        setAdminCalendarHealth(ADMIN_DEFAULT_HEALTH);
      }
      setCalendarSuccess(response.message);
      await loadOverview();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update calendar integration.");
    } finally {
      setSavingCalendar(false);
    }
  }

  async function refreshAdminCalendarHealth(showSuccess = true) {
    if (!selectedBusiness) {
      return;
    }

    setCheckingCalendarHealth(true);
    setError("");

    try {
      const response = await apiRequest<CalendarHealth>(`/api/calendar/google/health?businessId=${encodeURIComponent(selectedBusiness.id)}`);
      setAdminCalendarHealth(response);
      if (showSuccess) {
        setCalendarSuccess(response.message);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to check Google Calendar health.");
    } finally {
      setCheckingCalendarHealth(false);
    }
  }

  async function syncAdminCalendarNow() {
    if (!selectedBusiness) {
      return;
    }

    setSyncingCalendar(true);
    setError("");
    setCalendarSuccess("");
    setAppointmentError("");

    try {
      const response = await apiRequest<CalendarSyncResponse>("/api/calendar/google/sync", {
        method: "POST",
        body: { businessId: selectedBusiness.id },
      });
      setAdminCalendarHealth(response.health);
      setCalendarSuccess(
        `${response.message} ${formatAdminCalendarSyncSummary(
          response.sync.importedCount,
          response.sync.updatedCount,
          response.sync.deletedCount,
        )}`,
      );
      await loadOverview();
    } catch (requestError) {
      setAppointmentError(requestError instanceof Error ? requestError.message : "Unable to sync Google Calendar.");
      await refreshAdminCalendarHealth(false);
    } finally {
      setSyncingCalendar(false);
    }
  }

  function connectAdminCalendar() {
    if (!selectedBusiness) {
      return;
    }

    window.location.href = `${API_URL}/api/calendar/google/connect?businessId=${encodeURIComponent(selectedBusiness.id)}&returnTo=admin`;
  }

  function disconnectAdminCalendar() {
    void saveAdminCalendarIntegration({
      ...adminCalendarIntegration,
      connected: false,
    });
  }

  if (session === null) {
    return (
      <main className="app-shell">
        <section className="container stack-lg admin-shell">
          <div className="status-banner neutral">Loading admin portal...</div>
        </section>
      </main>
    );
  }

  if (!session.admin) {
    return null;
  }

  return (
    <main className="app-shell">
      <section className="container stack-lg admin-shell">
        <section className="surface-card stack-md admin-hero-card">
          <div className="helper-row">
            <div>
              <span className="eyebrow">Admin portal</span>
              <h1 className="display-title admin-display-title">Business control center</h1>
              <p className="lead admin-hero-copy">
                Review one workspace at a time, update billing, and help customers without opening each business portal.
              </p>
            </div>

            <div className="button-row">
              <button
                className="button-ghost"
                onClick={() => {
                  clearSession();
                  window.location.href = "/signin";
                }}
                type="button"
              >
                Sign out
              </button>
            </div>
          </div>
        </section>

        {loading ? <div className="status-banner neutral">Loading admin portal...</div> : null}
        {error ? <div className="status-banner error">{error}</div> : null}

        {data ? (
          <section className="admin-layout">
            <aside className="surface-card stack-md admin-sidebar">
              <div className="page-intro admin-page-intro compact">
                <span className="eyebrow">Selector</span>
                <h2 className="section-title admin-section-title">Choose workspace</h2>
                <p className="lead admin-lead">Pick one business to review and manage.</p>
              </div>

              <div className="field admin-field">
                <label htmlFor="admin-business-select">Jump to business</label>
                <select
                  id="admin-business-select"
                  onChange={(event) => setSelectedBusinessId(event.target.value)}
                  value={selectedBusiness?.id || ""}
                >
                  {data.businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name} - {business.category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="stack-sm admin-selector-list">
                {data.businesses.map((business) => {
                  const selected = business.id === selectedBusiness?.id;

                  return (
                    <button
                      key={business.id}
                      className={selected ? "admin-business-chip selected" : "admin-business-chip"}
                      onClick={() => setSelectedBusinessId(business.id)}
                      type="button"
                    >
                      <span className="admin-business-chip-body">
                        <strong>{business.name}</strong>
                        <span>{business.category} - {statusLabel(business.billingStatus)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="detail-list admin-detail-list compact">
                <div className="detail-row"><span>Total businesses</span><strong>{data.businesses.length}</strong></div>
                <div className="detail-row"><span>Admin email</span><strong>{session.admin.email}</strong></div>
                <div className="detail-row"><span>Admin role</span><strong>{statusLabel(session.admin.role)}</strong></div>
              </div>
            </aside>

            {selectedBusiness ? (
              <div className="stack-lg admin-main-column">
                <section className="surface-card stack-md admin-overview-card">
                  <div className="admin-overview-head">
                    <div>
                      <span className="eyebrow">Selected business</span>
                      <h2 className="section-title admin-section-title">{selectedBusiness.name}</h2>
                      <p className="lead admin-lead">
                        {selectedBusiness.category} business managed by {selectedBusiness.ownerName || selectedBusiness.ownerEmail || "no owner"}.
                      </p>
                    </div>

                    <div className="admin-usage-meter">
                      <div className="admin-usage-track">
                        <div
                          className="admin-usage-fill"
                          style={{
                            background: selectedBusiness.overageMinutes > 0 ? "#d66a5f" : "#2f55d4",
                            width: `${usagePercent}%`,
                          }}
                        />
                      </div>
                      <p className="lead admin-meter-copy">
                        {selectedBusiness.usedMinutes} / {selectedBusiness.includedMinutes} minutes used this cycle
                      </p>
                    </div>
                  </div>

                  <div className="grid-3 admin-stats-grid">
                    <div className="surface-muted stack-sm admin-stat-card">
                      <span className="eyebrow">Usage</span>
                      <h3 className="section-title admin-stat-value">{selectedBusiness.usedMinutes}</h3>
                      <p className="lead admin-stat-copy">Minutes used this cycle</p>
                    </div>
                    <div className="surface-muted stack-sm admin-stat-card">
                      <span className="eyebrow">Remaining</span>
                      <h3 className="section-title admin-stat-value">{selectedBusiness.remainingMinutes}</h3>
                      <p className="lead admin-stat-copy">Minutes before overage</p>
                    </div>
                    <div className="surface-muted stack-sm admin-stat-card">
                      <span className="eyebrow">Overage</span>
                      <h3 className="section-title admin-stat-value">{selectedBusiness.overageMinutes}</h3>
                      <p className="lead admin-stat-copy">Minutes over the limit</p>
                    </div>
                  </div>
                </section>

                <section className="surface-card stack-md admin-panel-card admin-calendar-panel">
                  <div className="admin-calendar-head">
                    <div className="page-intro admin-page-intro compact">
                      <span className="eyebrow">Appointments</span>
                      <h2 className="section-title admin-section-title">Business calendar</h2>
                      <p className="lead admin-lead">
                        Review, create, and edit appointments for {selectedBusiness.name} without switching portals.
                      </p>
                    </div>

                    <div className="admin-calendar-sync-card">
                      <div className="admin-calendar-sync-info">
                        <span className="eyebrow">Calendar Sync</span>
                        <h3>Google Calendar</h3>
                        <p>
                          {adminCalendarIntegration.connected ? (
                            <>Connected as <strong>{adminCalendarIntegration.connectedEmail || "Google account"}</strong></>
                          ) : (
                            "Not connected"
                          )}
                        </p>
                        <div className="admin-calendar-health-line">
                          <span className={`calendar-health-pill ${adminCalendarHealth.status.toLowerCase()}`}>
                            {calendarHealthLabel(adminCalendarHealth.status)}
                          </span>
                          <small>Last sync: {formatAdminDateTime(adminCalendarHealth.lastSyncAt)}</small>
                        </div>
                        <p className="admin-calendar-health-result">
                          {adminCalendarHealth.lastSyncStatus
                            ? formatAdminCalendarSyncSummary(
                                adminCalendarHealth.lastSyncImportedCount,
                                adminCalendarHealth.lastSyncUpdatedCount,
                                adminCalendarHealth.lastSyncDeletedCount,
                              )
                            : "No sync yet."}
                        </p>
                      </div>
                      {adminCalendarIntegration.connected ? (
                        <div className="admin-calendar-sync-actions">
                          <button
                            className="button-secondary"
                            disabled={checkingCalendarHealth}
                            onClick={() => refreshAdminCalendarHealth(true)}
                            type="button"
                          >
                            {checkingCalendarHealth ? "Checking..." : "Check"}
                          </button>
                          <button className="button" disabled={syncingCalendar} onClick={syncAdminCalendarNow} type="button">
                            {syncingCalendar ? "Syncing..." : "Sync now"}
                          </button>
                          <button className="button-secondary" disabled={savingCalendar} onClick={disconnectAdminCalendar} type="button">
                            {savingCalendar ? "Saving..." : "Disconnect"}
                          </button>
                        </div>
                      ) : (
                        <button className="button" disabled={savingCalendar} onClick={connectAdminCalendar} type="button">
                          Connect
                        </button>
                      )}
                    </div>
                  </div>

                  {calendarSuccess ? <div className="status-banner success">{calendarSuccess}</div> : null}
                  {adminCalendarHealth.lastHealthError || adminCalendarHealth.lastSyncError ? (
                    <div className="status-banner error">{adminCalendarHealth.lastHealthError || adminCalendarHealth.lastSyncError}</div>
                  ) : null}
                  {appointmentSuccess ? <div className="status-banner success">{appointmentSuccess}</div> : null}
                  {appointmentError ? <div className="status-banner error">{appointmentError}</div> : null}

                  <div className="calendar-toolbar admin-calendar-toolbar">
                    <div className="calendar-toolbar-left">
                      <button className="icon-button" type="button" onClick={() => moveAdminMonth(-1)} aria-label="Previous month">
                        ‹
                      </button>
                      <h2>{formatAdminMonthTitle(adminVisibleMonth)}</h2>
                      <button className="icon-button" type="button" onClick={() => moveAdminMonth(1)} aria-label="Next month">
                        ›
                      </button>
                      <button
                        className="button-secondary calendar-today-button"
                        type="button"
                        onClick={() => setAdminVisibleMonth(adminStartOfMonth(new Date()))}
                      >
                        Today
                      </button>
                    </div>

                    <div className="calendar-toolbar-right">
                      <div className="segmented-control" aria-label="Admin appointment view">
                        <button
                          className={adminAppointmentView === "month" ? "active" : ""}
                          type="button"
                          onClick={() => setAdminAppointmentView("month")}
                        >
                          Month
                        </button>
                        <button
                          className={adminAppointmentView === "list" ? "active" : ""}
                          type="button"
                          onClick={() => setAdminAppointmentView("list")}
                        >
                          List
                        </button>
                      </div>
                      <button className="button calendar-new-button" type="button" onClick={() => openAdminNewAppointment()}>
                        + New Appointment
                      </button>
                    </div>
                  </div>

                  {adminAppointmentView === "month" ? (
                    <section className="appointment-calendar admin-appointment-calendar" aria-label="Admin appointment calendar">
                      <div className="calendar-weekdays">
                        {ADMIN_WEEKDAYS.map((weekday) => (
                          <div key={weekday}>{weekday}</div>
                        ))}
                      </div>
                      <div className="calendar-grid">
                        {adminCalendarCells.map((cellDate) => {
                          const key = adminDateKey(cellDate);
                          const isOutsideMonth = cellDate.getMonth() !== adminVisibleMonth.getMonth();
                          const isToday = key === adminDateKey(adminToday);
                          const dayEvents = adminEventsByDay[key] ?? [];

                          return (
                            <div key={key} className={`calendar-day${isOutsideMonth ? " muted-day" : ""}`}>
                              <button
                                className={`calendar-day-number${isToday ? " today" : ""}`}
                                type="button"
                                onClick={() => openAdminNewAppointment(`${key}T09:00:00`)}
                                aria-label={`Create appointment on ${key}`}
                              >
                                {cellDate.getDate()}
                              </button>
                              <div className="calendar-events">
                                {dayEvents.map((appointment) => (
                                  <button
                                    key={appointment.id}
                                    className={`calendar-event-pill ${appointment.status === "CANCELED" ? "red canceled" : appointment.accent}`}
                                    type="button"
                                    onClick={() => openAdminEditAppointment(appointment)}
                                    title={`${formatAdminEventTime(appointment.startsAt)} ${appointment.title}`}
                                  >
                                    <span>{formatAdminEventTime(appointment.startsAt)}</span>
                                    <strong>{appointment.title}</strong>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className="appointments-list">
                      {sortedAdminAppointments.map((appointment) => (
                        <article key={appointment.id} className="appointment-list-card">
                          <div>
                            <span className={`appointment-status ${appointment.status.toLowerCase()}`}>
                              {ADMIN_STATUS_LABELS[appointment.status]}
                            </span>
                            <h3>{appointment.title}</h3>
                            <p>{formatAdminAppointmentTime(appointment.startsAt)} - {appointment.durationMinutes} min</p>
                          </div>
                          <div>
                            <strong>{appointment.customerName || "No customer name"}</strong>
                            <span>{appointment.customerPhone || "No phone captured"}</span>
                            <span>{appointment.serviceType || "General Consultation"}</span>
                          </div>
                          <button className="button-secondary" type="button" onClick={() => openAdminEditAppointment(appointment)}>
                            Edit
                          </button>
                        </article>
                      ))}
                    </section>
                  )}
                </section>

                <section className="grid-2 admin-detail-grid">
                  <div className="surface-card stack-md admin-panel-card">
                    <div className="page-intro admin-page-intro compact">
                      <span className="eyebrow">Business details</span>
                      <h2 className="section-title admin-section-title">Account profile</h2>
                    </div>

                    <div className="detail-list admin-detail-list">
                      <div className="detail-row"><span>Business name</span><strong>{selectedBusiness.name}</strong></div>
                      <div className="detail-row"><span>Business type</span><strong>{selectedBusiness.category}</strong></div>
                      <div className="detail-row"><span>Business email</span><strong>{selectedBusiness.businessEmail || "-"}</strong></div>
                      <div className="detail-row"><span>Owner name</span><strong>{selectedBusiness.ownerName || "-"}</strong></div>
                      <div className="detail-row"><span>Owner email</span><strong>{selectedBusiness.ownerEmail || "-"}</strong></div>
                      <div className="detail-row"><span>Business phone</span><strong>{selectedBusiness.phoneNumber || "-"}</strong></div>
                      <div className="detail-row"><span>Address</span><strong>{selectedBusiness.address || "-"}</strong></div>
                      <div className="detail-row"><span>Timezone</span><strong>{selectedBusiness.timezone || "-"}</strong></div>
                      <div className="detail-row"><span>Created</span><strong>{formatAdminDate(selectedBusiness.createdAt)}</strong></div>
                    </div>
                  </div>

                  <div className="surface-card stack-md admin-panel-card">
                    <div className="page-intro admin-page-intro compact">
                      <span className="eyebrow">Operational</span>
                      <h2 className="section-title admin-section-title">System status</h2>
                    </div>

                    <div className="detail-list admin-detail-list">
                      <div className="detail-row"><span>Twilio number</span><strong>{selectedBusiness.twilioNumber || "-"}</strong></div>
                      <div className="detail-row"><span>Plan</span><strong>{selectedBusiness.selectedPlan || "-"}</strong></div>
                      <div className="detail-row"><span>Billing cycle</span><strong>{selectedBusiness.billingCycle || "-"}</strong></div>
                      <div className="detail-row"><span>Billing status</span><strong>{statusLabel(selectedBusiness.billingStatus)}</strong></div>
                      <div className="detail-row"><span>AI enabled</span><strong>{selectedBusiness.aiEnabled ? "Yes" : "No"}</strong></div>
                      <div className="detail-row"><span>Medical mode</span><strong>{selectedBusiness.medicalModeEnabled ? "Yes" : "No"}</strong></div>
                      <div className="detail-row"><span>Onboarding done</span><strong>{selectedBusiness.onboardingCompleted ? "Yes" : "No"}</strong></div>
                      <div className="detail-row"><span>Team members</span><strong>{selectedBusiness.memberCount}</strong></div>
                    </div>
                  </div>
                </section>

                <section className="grid-2 admin-control-grid">
                  <form key={billingFormKey} className="surface-card stack-md admin-panel-card" onSubmit={onSubmitBilling}>
                    <div className="page-intro admin-page-intro compact">
                      <span className="eyebrow">Billing controls</span>
                      <h2 className="section-title admin-section-title">Manage billing</h2>
                      <p className="lead admin-lead">Update the commercial settings for {selectedBusiness.name}.</p>
                    </div>

                    {billingSuccess ? <div className="status-banner success">{billingSuccess}</div> : null}

                    <div className="form-grid two-col admin-form-grid">
                      <div className="field admin-field">
                        <label htmlFor="admin-plan-name">Plan name</label>
                        <select defaultValue={selectedBusiness.selectedPlan} id="admin-plan-name" name="planName">
                          <option value="Free Trial">Free Trial</option>
                          <option value="Starter">Starter</option>
                          <option value="Growth">Growth</option>
                          <option value="Pro">Pro</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>

                      <div className="field admin-field">
                        <label htmlFor="admin-billing-cycle">Billing cycle</label>
                        <select defaultValue={selectedBusiness.billingCycle} id="admin-billing-cycle" name="billingCycle">
                          <option value="Monthly">Monthly</option>
                          <option value="Yearly">Yearly</option>
                        </select>
                      </div>

                      <div className="field admin-field">
                        <label htmlFor="admin-billing-status">Billing status</label>
                        <select defaultValue={selectedBusiness.billingStatus} id="admin-billing-status" name="billingStatus">
                          <option value="TRIAL">Trial</option>
                          <option value="ACTIVE">Active</option>
                          <option value="PAUSED">Paused</option>
                          <option value="PAST_DUE">Past due</option>
                          <option value="CANCELED">Canceled</option>
                        </select>
                      </div>

                      <div className="field admin-field">
                        <label htmlFor="admin-included-minutes">Included minutes per month</label>
                        <input defaultValue={selectedBusiness.includedMinutes} id="admin-included-minutes" min="0" name="includedMinutesPerMonth" step="1" type="number" />
                      </div>

                      <div className="field admin-field admin-field-full">
                        <label htmlFor="admin-overage-rate">Overage rate per minute</label>
                        <input defaultValue={selectedBusiness.overageRatePerMinute} id="admin-overage-rate" min="0" name="overageRatePerMinute" step="0.01" type="number" />
                      </div>
                    </div>

                    <div className="button-row admin-action-row">
                      <button className="button" disabled={savingBilling} type="submit">
                        {savingBilling ? "Saving billing settings..." : "Save billing settings"}
                      </button>
                    </div>
                  </form>

                  <form key={resetFormKey} className="surface-card stack-md admin-panel-card" onSubmit={onResetPassword}>
                    <div className="page-intro admin-page-intro compact">
                      <span className="eyebrow">Access controls</span>
                      <h2 className="section-title admin-section-title">Reset user password</h2>
                      <p className="lead admin-lead">
                        Choose any member in this business and reset their password safely from admin.
                      </p>
                    </div>

                    {passwordResetSuccess ? <div className="status-banner success">{passwordResetSuccess}</div> : null}

                    <div className="detail-block admin-team-block">
                      <div className="helper-row admin-team-header">
                        <div>
                          <span className="eyebrow">Members</span>
                          <p className="lead admin-team-copy">
                            Admin can see member names, emails, and roles. Existing passwords are never shown, but you can reset them.
                          </p>
                        </div>
                      </div>

                      <div className="stack-sm admin-member-list">
                        {selectedBusiness.members.map((member) => (
                          <div className="member-card admin-member-card" key={member.id}>
                            <div className="member-head">
                              <div>
                                <strong>{member.fullName || member.email}</strong>
                                <span>{member.email}</span>
                              </div>
                              <span className="inline-badge">{statusLabel(member.role)}</span>
                            </div>

                            <div className="button-row admin-member-actions">
                              <button
                                className="button-ghost"
                                onClick={() => setPasswordDraftEmail(member.email)}
                                type="button"
                              >
                                Use this email
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="form-grid admin-form-grid">
                      <div className="field admin-field">
                        <label htmlFor="admin-reset-email">User email</label>
                        <input id="admin-reset-email" name="email" onChange={(event) => setPasswordDraftEmail(event.target.value)} type="email" value={passwordDraftEmail} />
                      </div>

                      <div className="field admin-field">
                        <label htmlFor="admin-reset-password">New password</label>
                        <input id="admin-reset-password" minLength={8} name="newPassword" type="password" />
                      </div>
                    </div>

                    <div className="button-row admin-action-row">
                      <button className="button-secondary" disabled={resettingPassword} type="submit">
                        {resettingPassword ? "Resetting password..." : "Reset password"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            ) : null}
          </section>
        ) : null}

        <PasswordChangeForm email={session.admin.email} eyebrow="Admin security" title="Change admin password" />

        {activeAppointment ? (
          <div className="modal-backdrop" role="presentation">
            <form className="appointment-modal" onSubmit={saveActiveAdminAppointment}>
              <div className="appointment-modal-header">
                <h2>{isCreatingAppointment ? "New appointment" : "Edit appointment"}</h2>
                <button className="modal-close" type="button" onClick={() => setActiveAppointment(null)} aria-label="Close appointment editor">
                  ×
                </button>
              </div>

              <div className="appointment-modal-body">
                <div className="form-group appointment-field-full">
                  <label className="form-label" htmlFor="admin-appointment-title">Title *</label>
                  <input
                    id="admin-appointment-title"
                    className="form-input"
                    value={activeAppointment.title}
                    onChange={(event) => setActiveAppointment({ ...activeAppointment, title: event.target.value })}
                    required
                  />
                </div>

                <div className="appointment-form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-appointment-start">Date &amp; Time *</label>
                    <input
                      id="admin-appointment-start"
                      className="form-input"
                      type="datetime-local"
                      value={toAdminInputDateTime(activeAppointment.startsAt)}
                      onChange={(event) => setActiveAppointment({ ...activeAppointment, startsAt: fromAdminInputDateTime(event.target.value) })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Duration (min)</label>
                    <div className="duration-options">
                      {ADMIN_DURATION_OPTIONS.map((duration) => (
                        <button
                          key={duration}
                          className={`duration-chip${activeAppointment.durationMinutes === duration ? " active" : ""}`}
                          type="button"
                          onClick={() => setActiveAppointment({ ...activeAppointment, durationMinutes: duration })}
                        >
                          {duration}
                        </button>
                      ))}
                      <input
                        className="duration-input"
                        min={5}
                        max={480}
                        type="number"
                        value={activeAppointment.durationMinutes}
                        onChange={(event) =>
                          setActiveAppointment({
                            ...activeAppointment,
                            durationMinutes: Number(event.target.value || 30),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-appointment-customer">Customer name</label>
                    <input
                      id="admin-appointment-customer"
                      className="form-input"
                      value={activeAppointment.customerName}
                      onChange={(event) => setActiveAppointment({ ...activeAppointment, customerName: event.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-appointment-phone">Customer phone</label>
                    <input
                      id="admin-appointment-phone"
                      className="form-input"
                      value={activeAppointment.customerPhone}
                      onChange={(event) => setActiveAppointment({ ...activeAppointment, customerPhone: event.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-appointment-email">Customer email</label>
                    <input
                      id="admin-appointment-email"
                      className="form-input"
                      placeholder="customer@example.com"
                      value={activeAppointment.customerEmail}
                      onChange={(event) => setActiveAppointment({ ...activeAppointment, customerEmail: event.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="admin-appointment-service">Service / Type</label>
                    <input
                      id="admin-appointment-service"
                      className="form-input"
                      value={activeAppointment.serviceType}
                      onChange={(event) => setActiveAppointment({ ...activeAppointment, serviceType: event.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group appointment-field-full">
                  <label className="form-label" htmlFor="admin-appointment-status">Status</label>
                  <select
                    id="admin-appointment-status"
                    className="form-select"
                    value={activeAppointment.status}
                    onChange={(event) =>
                      setActiveAppointment({
                        ...activeAppointment,
                        status: event.target.value as AppointmentStatus,
                        accent: event.target.value === "CANCELED" ? "red" : activeAppointment.accent,
                      })
                    }
                  >
                    {Object.entries(ADMIN_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group appointment-field-full">
                  <label className="form-label" htmlFor="admin-appointment-notes">Notes</label>
                  <textarea
                    id="admin-appointment-notes"
                    className="form-textarea appointment-notes"
                    value={activeAppointment.notes}
                    onChange={(event) => setActiveAppointment({ ...activeAppointment, notes: event.target.value })}
                  />
                </div>

                <div className="appointment-modal-actions">
                  {!isCreatingAppointment ? (
                    <button className="button-ghost destructive" type="button" onClick={deleteActiveAdminAppointment} disabled={savingAppointments}>
                      Delete
                    </button>
                  ) : <span />}
                  <div className="appointment-modal-action-group">
                    <button className="button-secondary" type="button" onClick={() => setActiveAppointment(null)} disabled={savingAppointments}>
                      Cancel
                    </button>
                    <button className="button" type="submit" disabled={savingAppointments}>
                      {savingAppointments ? "Saving..." : "Save appointment"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  );
}
