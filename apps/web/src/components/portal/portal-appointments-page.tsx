"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import { PortalShell } from "./portal-shell";
import { usePortalData } from "./use-portal-data";

type Props = {
  businessId?: string;
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

type AppointmentsResponse = {
  message: string;
  appointments: AppointmentItem[];
};

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  CONFIRMED: "Confirmed",
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELED: "Canceled",
};

function uid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function nextHourDateTime() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return `${dateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toInputDateTime(value: string) {
  const date = parseDate(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromInputDateTime(value: string) {
  return value.length === 16 ? `${value}:00` : value;
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parseDate(value));
}

function formatFullDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parseDate(value));
}

function buildMonthCells(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function buildDefaultAppointments(businessName: string): AppointmentItem[] {
  return [
    {
      id: "demo-jenex",
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
      id: "demo-abc",
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
      id: "demo-canceled-call",
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
      id: "demo-ai-strategy",
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
      id: "demo-vishant",
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
      id: "demo-call-review",
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
      id: "demo-call-21",
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
      id: "demo-call-25",
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

function emptyAppointment(businessName: string, startsAt = nextHourDateTime()): AppointmentItem {
  return {
    id: uid(),
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

export function PortalAppointmentsPage({ businessId = "" }: Props) {
  const portal = usePortalData(businessId);
  const businessName = portal.business?.name || "DeltaPrompt AI";
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<"month" | "list">("month");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [activeAppointment, setActiveAppointment] = useState<AppointmentItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!portal.business?.id) {
      return;
    }

    const savedAppointments = portal.business.appointmentsConfigured
      ? portal.business.appointments ?? []
      : buildDefaultAppointments(portal.business.name);
    setAppointments(savedAppointments);
  }, [portal.business?.id, portal.business?.name]);

  const cells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const eventsByDay = useMemo(() => {
    return appointments.reduce<Record<string, AppointmentItem[]>>((acc, appointment) => {
      const key = dateKey(parseDate(appointment.startsAt));
      acc[key] = [...(acc[key] ?? []), appointment].sort(
        (a, b) => parseDate(a.startsAt).getTime() - parseDate(b.startsAt).getTime(),
      );
      return acc;
    }, {});
  }, [appointments]);

  const sortedAppointments = useMemo(
    () => [...appointments].sort((a, b) => parseDate(a.startsAt).getTime() - parseDate(b.startsAt).getTime()),
    [appointments],
  );

  if (portal.loading) return <main className="app-shell"><section className="container"><div className="status-banner neutral">Loading appointments...</div></section></main>;
  if (portal.error) return <main className="app-shell"><section className="container"><div className="status-banner error">{portal.error}</div></section></main>;
  if (!portal.business) return <main className="app-shell"><section className="container"><div className="status-banner neutral">No business data found yet.</div></section></main>;

  function moveMonth(delta: number) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1));
  }

  function openNewAppointment(startsAt?: string) {
    setError("");
    setNotice("");
    setIsCreating(true);
    setActiveAppointment(emptyAppointment(businessName, startsAt));
  }

  function openEditAppointment(appointment: AppointmentItem) {
    setError("");
    setNotice("");
    setIsCreating(false);
    setActiveAppointment({ ...appointment });
  }

  async function persistAppointments(nextAppointments: AppointmentItem[], message: string) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest<AppointmentsResponse>(`/api/businesses/${portal.business!.id}/appointments`, {
        method: "PATCH",
        body: { appointments: nextAppointments },
      });
      setAppointments(response.appointments ?? nextAppointments);
      setNotice(response.message || message);
      setActiveAppointment(null);
      await portal.refreshBusiness();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save appointments.");
    } finally {
      setSaving(false);
    }
  }

  function saveActiveAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeAppointment) {
      return;
    }

    if (!activeAppointment.title.trim()) {
      setError("Appointment title is required.");
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

    const nextAppointments = isCreating
      ? [...appointments, normalizedAppointment]
      : appointments.map((appointment) => (appointment.id === normalizedAppointment.id ? normalizedAppointment : appointment));

    void persistAppointments(nextAppointments, "Appointment saved.");
  }

  function deleteActiveAppointment() {
    if (!activeAppointment || isCreating) {
      return;
    }

    const nextAppointments = appointments.filter((appointment) => appointment.id !== activeAppointment.id);
    void persistAppointments(nextAppointments, "Appointment removed.");
  }

  return (
    <PortalShell
      active="appointments"
      portal={portal}
      subtitle="View, create, and manage every appointment your AI books - plus manual ones you add."
      title="Appointments"
    >
      {!portal.canViewCallLogs ? (
        <div className="status-banner neutral">Your role does not have access to appointments.</div>
      ) : (
        <>
          <section className="calendar-toolbar surface-card">
            <div className="calendar-toolbar-left">
              <button className="icon-button" type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
                ‹
              </button>
              <h2>{formatMonthTitle(visibleMonth)}</h2>
              <button className="icon-button" type="button" onClick={() => moveMonth(1)} aria-label="Next month">
                ›
              </button>
              <button className="button-secondary calendar-today-button" type="button" onClick={() => setVisibleMonth(startOfMonth(new Date()))}>
                Today
              </button>
            </div>

            <div className="calendar-toolbar-right">
              <div className="segmented-control" aria-label="Appointment view">
                <button className={viewMode === "month" ? "active" : ""} type="button" onClick={() => setViewMode("month")}>
                  Month
                </button>
                <button className={viewMode === "list" ? "active" : ""} type="button" onClick={() => setViewMode("list")}>
                  List
                </button>
              </div>
              <button className="button calendar-new-button" type="button" onClick={() => openNewAppointment()}>
                + New Appointment
              </button>
            </div>
          </section>

          {notice ? <div className="status-banner success">{notice}</div> : null}
          {error ? <div className="status-banner error">{error}</div> : null}

          {viewMode === "month" ? (
            <section className="appointment-calendar surface-card" aria-label="Appointment calendar">
              <div className="calendar-weekdays">
                {WEEKDAYS.map((weekday) => (
                  <div key={weekday}>{weekday}</div>
                ))}
              </div>
              <div className="calendar-grid">
                {cells.map((cellDate) => {
                  const key = dateKey(cellDate);
                  const isOutsideMonth = cellDate.getMonth() !== visibleMonth.getMonth();
                  const isToday = key === dateKey(today);
                  const dayEvents = eventsByDay[key] ?? [];

                  return (
                    <div key={key} className={`calendar-day${isOutsideMonth ? " muted-day" : ""}`}>
                      <button
                        className={`calendar-day-number${isToday ? " today" : ""}`}
                        type="button"
                        onClick={() => openNewAppointment(`${key}T09:00:00`)}
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
                            onClick={() => openEditAppointment(appointment)}
                            title={`${formatEventTime(appointment.startsAt)} ${appointment.title}`}
                          >
                            <span>{formatEventTime(appointment.startsAt)}</span>
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
              {sortedAppointments.map((appointment) => (
                <article key={appointment.id} className="appointment-list-card">
                  <div>
                    <span className={`appointment-status ${appointment.status.toLowerCase()}`}>{STATUS_LABELS[appointment.status]}</span>
                    <h3>{appointment.title}</h3>
                    <p>{formatFullDateTime(appointment.startsAt)} · {appointment.durationMinutes} min</p>
                  </div>
                  <div>
                    <strong>{appointment.customerName || "No customer name"}</strong>
                    <span>{appointment.customerPhone || "No phone captured"}</span>
                    <span>{appointment.serviceType || "General Consultation"}</span>
                  </div>
                  <button className="button-secondary" type="button" onClick={() => openEditAppointment(appointment)}>
                    Edit
                  </button>
                </article>
              ))}
            </section>
          )}

          {activeAppointment ? (
            <div className="modal-backdrop" role="presentation">
              <form className="appointment-modal" onSubmit={saveActiveAppointment}>
                <div className="appointment-modal-header">
                  <h2>{isCreating ? "New appointment" : "Edit appointment"}</h2>
                  <button className="modal-close" type="button" onClick={() => setActiveAppointment(null)} aria-label="Close appointment editor">
                    ×
                  </button>
                </div>

                <div className="appointment-modal-body">
                  <div className="form-group appointment-field-full">
                    <label className="form-label" htmlFor="appointment-title">Title *</label>
                    <input
                      id="appointment-title"
                      className="form-input"
                      value={activeAppointment.title}
                      onChange={(event) => setActiveAppointment({ ...activeAppointment, title: event.target.value })}
                      required
                    />
                  </div>

                  <div className="appointment-form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor="appointment-start">Date &amp; Time *</label>
                      <input
                        id="appointment-start"
                        className="form-input"
                        type="datetime-local"
                        value={toInputDateTime(activeAppointment.startsAt)}
                        onChange={(event) => setActiveAppointment({ ...activeAppointment, startsAt: fromInputDateTime(event.target.value) })}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Duration (min)</label>
                      <div className="duration-options">
                        {DURATION_OPTIONS.map((duration) => (
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
                      <label className="form-label" htmlFor="appointment-customer">Customer name</label>
                      <input
                        id="appointment-customer"
                        className="form-input"
                        value={activeAppointment.customerName}
                        onChange={(event) => setActiveAppointment({ ...activeAppointment, customerName: event.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="appointment-phone">Customer phone</label>
                      <input
                        id="appointment-phone"
                        className="form-input"
                        value={activeAppointment.customerPhone}
                        onChange={(event) => setActiveAppointment({ ...activeAppointment, customerPhone: event.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="appointment-email">Customer email</label>
                      <input
                        id="appointment-email"
                        className="form-input"
                        placeholder="customer@example.com"
                        value={activeAppointment.customerEmail}
                        onChange={(event) => setActiveAppointment({ ...activeAppointment, customerEmail: event.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="appointment-service">Service / Type</label>
                      <input
                        id="appointment-service"
                        className="form-input"
                        value={activeAppointment.serviceType}
                        onChange={(event) => setActiveAppointment({ ...activeAppointment, serviceType: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group appointment-field-full">
                    <label className="form-label" htmlFor="appointment-status">Status</label>
                    <select
                      id="appointment-status"
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
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group appointment-field-full">
                    <label className="form-label" htmlFor="appointment-notes">Notes</label>
                    <textarea
                      id="appointment-notes"
                      className="form-textarea appointment-notes"
                      value={activeAppointment.notes}
                      onChange={(event) => setActiveAppointment({ ...activeAppointment, notes: event.target.value })}
                    />
                  </div>

                  <div className="appointment-modal-actions">
                    {!isCreating ? (
                      <button className="button-ghost destructive" type="button" onClick={deleteActiveAppointment} disabled={saving}>
                        Delete
                      </button>
                    ) : <span />}
                    <div className="appointment-modal-action-group">
                      <button className="button-secondary" type="button" onClick={() => setActiveAppointment(null)} disabled={saving}>
                        Cancel
                      </button>
                      <button className="button" type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save appointment"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          ) : null}
        </>
      )}
    </PortalShell>
  );
}
