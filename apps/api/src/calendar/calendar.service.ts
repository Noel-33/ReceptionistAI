import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CalendarConnection, CalendarProvider } from "@prisma/client";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

export type CalendarSyncAppointment = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceType: string;
  status: "CONFIRMED" | "PENDING" | "COMPLETED" | "CANCELED";
  notes: string;
  source: "AI_BOOKED" | "MANUAL" | "GOOGLE_SYNC" | "MICROSOFT_SYNC";
  accent: "blue" | "green" | "red";
  googleEventId?: string;
  googleCalendarId?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleProfileResponse = {
  email?: string;
};

type CalendarIntegrationSettings = {
  connected: boolean;
  connectedEmail: string;
  connectedAt: string;
  syncAppointments: boolean;
  respectBusyTimes: boolean;
};

type CalendarSyncBusiness = {
  id: string;
  name: string;
  timezone: string;
};

type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  updated?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
};

type GoogleEventsListPayload = GoogleApiErrorPayload & {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

type CalendarHealthStatus = "DISCONNECTED" | "HEALTHY" | "ERROR";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

function calendarKey() {
  const secret = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;

  if (!secret) {
    throw new BadRequestException("Missing CALENDAR_TOKEN_ENCRYPTION_KEY in .env.");
  }

  const decoded = Buffer.from(secret, "base64");
  return decoded.length === 32 ? decoded : createHash("sha256").update(secret).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", calendarKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

function decryptToken(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");

  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new BadRequestException("Stored Google calendar token is invalid.");
  }

  const decipher = createDecipheriv("aes-256-gcm", calendarKey(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

function signState(payload: string) {
  return createHmac("sha256", calendarKey()).update(payload).digest("base64url");
}

function encodeState(businessId: string, returnTo: "admin" | "portal") {
  const payload = Buffer.from(
    JSON.stringify({
      businessId,
      returnTo,
      expiresAt: Date.now() + 1000 * 60 * 10,
    }),
  ).toString("base64url");

  return `${payload}.${signState(payload)}`;
}

function decodeState(state: string) {
  const [payload, signature] = state.split(".");

  if (!payload || !signature) {
    throw new BadRequestException("Invalid Google calendar connection state.");
  }

  const expectedSignature = signState(payload);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new BadRequestException("Invalid Google calendar connection state.");
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    businessId?: string;
    returnTo?: "admin" | "portal";
    expiresAt?: number;
  };

  if (!parsed.businessId || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
    throw new BadRequestException("Google calendar connection expired. Please try again.");
  }

  return {
    businessId: parsed.businessId,
    returnTo: parsed.returnTo === "admin" ? "admin" : "portal",
  };
}

function addMinutes(value: string, minutes: number) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("Appointment date/time is invalid.");
  }

  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function toGoogleDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("Appointment date/time is invalid.");
  }

  return value.length === 19 ? value : date.toISOString();
}

function hasOverlap(start: string, end: string, busyStart: string, busyEnd: string) {
  return new Date(start).getTime() < new Date(busyEnd).getTime() && new Date(busyStart).getTime() < new Date(end).getTime();
}

function hasAppointmentSyncChange(previous: CalendarSyncAppointment, next: CalendarSyncAppointment) {
  return (
    previous.title !== next.title ||
    previous.startsAt !== next.startsAt ||
    previous.durationMinutes !== next.durationMinutes ||
    previous.customerName !== next.customerName ||
    previous.customerPhone !== next.customerPhone ||
    previous.customerEmail !== next.customerEmail ||
    previous.serviceType !== next.serviceType ||
    previous.status !== next.status ||
    previous.notes !== next.notes
  );
}

function decodeGoogleEmailFromIdToken(idToken?: string) {
  if (!idToken) {
    return "";
  }

  try {
    const [, payload] = idToken.split(".");
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string };
    return parsed.email || "";
  } catch {
    return "";
  }
}

type GoogleApiErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function googleApiErrorMessage(payload: GoogleApiErrorPayload, fallback: string) {
  const message = payload.error?.message?.trim();

  if (!message) {
    return fallback;
  }

  if (message.includes("Google Calendar API has not been used") || message.includes("it is disabled")) {
    return "Google Calendar API is disabled in Google Cloud. Enable it for this OAuth project, wait a few minutes, then try again.";
  }

  return message;
}

function readBusinessRules(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sortAppointments(appointments: CalendarSyncAppointment[]) {
  return [...appointments].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function normalizeAppointmentStatus(value: unknown): CalendarSyncAppointment["status"] {
  const status = String(value ?? "CONFIRMED").trim().toUpperCase();
  return status === "PENDING" || status === "COMPLETED" || status === "CANCELED" ? status : "CONFIRMED";
}

function normalizeAppointmentSource(value: unknown): CalendarSyncAppointment["source"] {
  const source = String(value ?? "MANUAL").trim().toUpperCase();
  return source === "AI_BOOKED" || source === "GOOGLE_SYNC" || source === "MICROSOFT_SYNC" ? source : "MANUAL";
}

function normalizeAppointmentAccent(value: unknown): CalendarSyncAppointment["accent"] {
  const accent = String(value ?? "blue").trim().toLowerCase();
  return accent === "green" || accent === "red" ? accent : "blue";
}

function extractAppointments(value: unknown): CalendarSyncAppointment[] {
  const rules = readBusinessRules(value);
  const appointments = rules.appointments;

  if (!Array.isArray(appointments)) {
    return [];
  }

  return appointments
    .filter((appointment) => appointment && typeof appointment === "object" && !Array.isArray(appointment))
    .map((appointment) => {
      const record = appointment as Record<string, unknown>;

      return {
        id: String(record.id ?? "").trim(),
        title: String(record.title ?? "").trim(),
        startsAt: String(record.startsAt ?? "").trim(),
        durationMinutes: Number(record.durationMinutes ?? 30),
        customerName: String(record.customerName ?? "").trim(),
        customerPhone: String(record.customerPhone ?? "").trim(),
        customerEmail: String(record.customerEmail ?? "").trim(),
        serviceType: String(record.serviceType ?? "").trim(),
        status: normalizeAppointmentStatus(record.status),
        notes: String(record.notes ?? "").trim(),
        source: normalizeAppointmentSource(record.source),
        accent: normalizeAppointmentAccent(record.accent),
        googleEventId: String(record.googleEventId ?? "").trim(),
        googleCalendarId: String(record.googleCalendarId ?? "").trim(),
      };
    })
    .filter((appointment) => appointment.id && appointment.title && appointment.startsAt)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function googleEventDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function googleEventDurationMinutes(event: GoogleCalendarEvent) {
  const start = googleEventDate(event.start?.dateTime);
  const end = googleEventDate(event.end?.dateTime);

  if (!start || !end) {
    return 30;
  }

  return Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function googleEventStartsAt(event: GoogleCalendarEvent) {
  const startsAt = event.start?.dateTime;

  if (!startsAt) {
    return "";
  }

  const date = new Date(startsAt);
  return Number.isNaN(date.getTime()) ? "" : startsAt.length === 19 ? startsAt : date.toISOString();
}

function appointmentFromGoogleEvent(business: CalendarSyncBusiness, event: GoogleCalendarEvent, calendarId: string): CalendarSyncAppointment | null {
  const eventId = String(event.id ?? "").trim();
  const startsAt = googleEventStartsAt(event);

  if (!eventId || !startsAt) {
    return null;
  }

  const summary = String(event.summary ?? "").trim() || "Google Calendar event";

  return {
    id: `google-${eventId}`,
    title: summary,
    startsAt,
    durationMinutes: googleEventDurationMinutes(event),
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    serviceType: "Google Calendar",
    status: event.status === "cancelled" ? "CANCELED" : "CONFIRMED",
    notes: `Imported from Google Calendar for ${business.name}.`,
    source: "GOOGLE_SYNC",
    accent: event.status === "cancelled" ? "red" : "blue",
    googleEventId: eventId,
    googleCalendarId: calendarId,
  };
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  resolveGoogleIntegration(connection?: CalendarConnection | null) {
    return {
      provider: "GOOGLE_CALENDAR" as const,
      connected: Boolean(connection),
      connectedEmail: connection?.providerAccountId || "",
      connectedAt: connection?.createdAt.toISOString() || "",
      syncAppointments: connection?.syncAppointments ?? true,
      respectBusyTimes: connection?.respectBusyTimes ?? true,
    };
  }

  async buildGoogleConnectUrl(businessId: string, returnTo: "admin" | "portal" = "portal") {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/api/calendar/google/callback";

    if (!clientId) {
      throw new BadRequestException("Missing GOOGLE_CLIENT_ID in .env.");
    }

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", encodeState(businessId, returnTo));

    return url.toString();
  }

  async handleGoogleCallback(code: string, state: string) {
    const statePayload = decodeState(state);
    const businessId = statePayload.businessId;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/api/calendar/google/callback";

    if (!clientId || !clientSecret) {
      throw new BadRequestException("Missing Google OAuth client credentials in .env.");
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const tokenResponse = await this.exchangeGoogleToken({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    if (!tokenResponse.access_token) {
      throw new BadRequestException(tokenResponse.error_description || tokenResponse.error || "Google did not return an access token.");
    }

    const existing = await this.prisma.calendarConnection.findUnique({
      where: {
        businessId_provider: {
          businessId,
          provider: CalendarProvider.GOOGLE,
        },
      },
    });
    const refreshToken = tokenResponse.refresh_token || (existing ? decryptToken(existing.refreshTokenEncrypted) : "");

    if (!refreshToken) {
      throw new BadRequestException("Google did not return a refresh token. Please disconnect and connect again.");
    }

    const connectedEmail =
      decodeGoogleEmailFromIdToken(tokenResponse.id_token) || (await this.fetchGoogleProfileEmail(tokenResponse.access_token));
    const expiresAt =
      typeof tokenResponse.expires_in === "number"
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : new Date(Date.now() + 55 * 60 * 1000);

    await this.prisma.calendarConnection.upsert({
      where: {
        businessId_provider: {
          businessId,
          provider: CalendarProvider.GOOGLE,
        },
      },
      update: {
        providerAccountId: connectedEmail,
        accessTokenEncrypted: encryptToken(tokenResponse.access_token),
        refreshTokenEncrypted: encryptToken(refreshToken),
        tokenExpiresAt: expiresAt,
        calendarId: existing?.calendarId || "primary",
        syncAppointments: true,
        respectBusyTimes: true,
      },
      create: {
        businessId,
        provider: CalendarProvider.GOOGLE,
        providerAccountId: connectedEmail,
        accessTokenEncrypted: encryptToken(tokenResponse.access_token),
        refreshTokenEncrypted: encryptToken(refreshToken),
        tokenExpiresAt: expiresAt,
        calendarId: "primary",
        syncAppointments: true,
        respectBusyTimes: true,
      },
    });

    return statePayload;
  }

  async updateGoogleSettings(businessId: string, input: CalendarIntegrationSettings) {
    if (!input.connected) {
      return this.disconnectGoogle(businessId);
    }

    const connection = await this.prisma.calendarConnection.update({
      where: {
        businessId_provider: {
          businessId,
          provider: CalendarProvider.GOOGLE,
        },
      },
      data: {
        syncAppointments: input.syncAppointments,
        respectBusyTimes: input.respectBusyTimes,
      },
    });

    return this.resolveGoogleIntegration(connection);
  }

  async disconnectGoogle(businessId: string) {
    await this.prisma.calendarConnection.deleteMany({
      where: {
        businessId,
        provider: CalendarProvider.GOOGLE,
      },
    });

    return this.resolveGoogleIntegration(null);
  }

  async getGoogleHealth(businessId: string) {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: {
        businessId_provider: {
          businessId,
          provider: CalendarProvider.GOOGLE,
        },
      },
    });

    if (!connection) {
      return this.toGoogleHealthResponse(null, "DISCONNECTED", "Google Calendar is not connected.");
    }

    try {
      const accessToken = await this.getGoogleAccessToken(connection);
      const now = new Date();
      await this.hasBusyConflict(accessToken, connection.calendarId, now.toISOString(), new Date(now.getTime() + 15 * 60_000).toISOString());
      const updatedConnection = await this.prisma.calendarConnection.update({
        where: {
          businessId_provider: {
            businessId,
            provider: CalendarProvider.GOOGLE,
          },
        },
        data: {
          lastHealthCheckedAt: new Date(),
          lastHealthStatus: "HEALTHY",
          lastHealthError: null,
        },
      });

      return this.toGoogleHealthResponse(updatedConnection, "HEALTHY", "Google Calendar is connected and reachable.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to check Google Calendar health.";
      const updatedConnection = await this.prisma.calendarConnection.update({
        where: {
          businessId_provider: {
            businessId,
            provider: CalendarProvider.GOOGLE,
          },
        },
        data: {
          lastHealthCheckedAt: new Date(),
          lastHealthStatus: "ERROR",
          lastHealthError: message,
        },
      });

      return this.toGoogleHealthResponse(updatedConnection, "ERROR", message);
    }
  }

  async syncGoogleCalendar(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const connection = await this.prisma.calendarConnection.findUnique({
      where: {
        businessId_provider: {
          businessId,
          provider: CalendarProvider.GOOGLE,
        },
      },
    });

    if (!connection) {
      throw new BadRequestException("Connect Google Calendar before syncing.");
    }

    try {
      const accessToken = await this.getGoogleAccessToken(connection);
      const googleEvents = await this.listGoogleEvents(accessToken, connection.calendarId);
      const previousRules = readBusinessRules(business.answeringRules);
      const appointments = extractAppointments(business.answeringRules);
      const nextAppointments = [...appointments];
      let importedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;

      for (const googleEvent of googleEvents.items) {
        const eventId = String(googleEvent.id ?? "").trim();

        if (!eventId) {
          continue;
        }

        const appAppointmentId = googleEvent.extendedProperties?.private?.deltapromptAppointmentId || "";
        const existingIndex = nextAppointments.findIndex(
          (appointment) => appointment.id === appAppointmentId || appointment.googleEventId === eventId,
        );

        if (googleEvent.status === "cancelled") {
          if (existingIndex >= 0 && nextAppointments[existingIndex].status !== "CANCELED") {
            nextAppointments[existingIndex] = {
              ...nextAppointments[existingIndex],
              status: "CANCELED",
              accent: "red",
            };
            deletedCount += 1;
          }
          continue;
        }

        const importedAppointment = appointmentFromGoogleEvent(business, googleEvent, connection.calendarId);

        if (!importedAppointment) {
          continue;
        }

        if (existingIndex >= 0) {
          const previousAppointment = nextAppointments[existingIndex];
          const nextAppointment: CalendarSyncAppointment = {
            ...previousAppointment,
            title: importedAppointment.title,
            startsAt: importedAppointment.startsAt,
            durationMinutes: importedAppointment.durationMinutes,
            status: "CONFIRMED",
            accent: previousAppointment.accent === "red" ? "blue" : previousAppointment.accent,
            googleEventId: eventId,
            googleCalendarId: connection.calendarId,
          };

          if (
            hasAppointmentSyncChange(previousAppointment, nextAppointment) ||
            previousAppointment.googleEventId !== nextAppointment.googleEventId ||
            previousAppointment.googleCalendarId !== nextAppointment.googleCalendarId
          ) {
            nextAppointments[existingIndex] = nextAppointment;
            updatedCount += 1;
          }

          continue;
        }

        nextAppointments.push({
          ...importedAppointment,
          id: appAppointmentId || importedAppointment.id,
        });
        importedCount += 1;
      }

      const syncedAppointments = sortAppointments(nextAppointments);
      await this.prisma.business.update({
        where: { id: businessId },
        data: {
          answeringRules: {
            ...previousRules,
            appointments: syncedAppointments,
            appointmentsUpdatedAt: new Date().toISOString(),
          },
        },
      });

      const syncedAt = new Date();
      const updatedConnection = await this.prisma.calendarConnection.update({
        where: {
          businessId_provider: {
            businessId,
            provider: CalendarProvider.GOOGLE,
          },
        },
        data: {
          syncToken: googleEvents.nextSyncToken || connection.syncToken,
          lastSyncAt: syncedAt,
          lastSyncStatus: "SUCCESS",
          lastSyncError: null,
          lastSyncImportedCount: importedCount,
          lastSyncUpdatedCount: updatedCount,
          lastSyncDeletedCount: deletedCount,
          lastHealthCheckedAt: syncedAt,
          lastHealthStatus: "HEALTHY",
          lastHealthError: null,
        },
      });

      return {
        message: "Google Calendar sync completed.",
        sync: {
          importedCount,
          updatedCount,
          deletedCount,
          syncedAt: syncedAt.toISOString(),
        },
        health: this.toGoogleHealthResponse(updatedConnection, "HEALTHY", "Google Calendar sync completed."),
        appointments: syncedAppointments,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync Google Calendar.";
      await this.prisma.calendarConnection.update({
        where: {
          businessId_provider: {
            businessId,
            provider: CalendarProvider.GOOGLE,
          },
        },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: "ERROR",
          lastSyncError: message,
        },
      });
      throw new BadRequestException(message);
    }
  }

  async syncGoogleAppointments(input: {
    business: CalendarSyncBusiness;
    previousAppointments: CalendarSyncAppointment[];
    nextAppointments: CalendarSyncAppointment[];
  }) {
    const connection = await this.prisma.calendarConnection.findUnique({
      where: {
        businessId_provider: {
          businessId: input.business.id,
          provider: CalendarProvider.GOOGLE,
        },
      },
    });

    if (!connection || !connection.syncAppointments) {
      return input.nextAppointments;
    }

    const accessToken = await this.getGoogleAccessToken(connection);
    const previousById = new Map(input.previousAppointments.map((appointment) => [appointment.id, appointment]));
    const nextById = new Map(input.nextAppointments.map((appointment) => [appointment.id, appointment]));

    for (const previousAppointment of input.previousAppointments) {
      if (!nextById.has(previousAppointment.id) && previousAppointment.googleEventId) {
        await this.deleteGoogleEvent(accessToken, previousAppointment.googleCalendarId || connection.calendarId, previousAppointment.googleEventId);
      }
    }

    const syncedAppointments: CalendarSyncAppointment[] = [];

    for (const appointment of input.nextAppointments) {
      const previousAppointment = previousById.get(appointment.id);
      const googleEventId = appointment.googleEventId || previousAppointment?.googleEventId || "";
      const googleCalendarId = appointment.googleCalendarId || previousAppointment?.googleCalendarId || connection.calendarId;
      const needsProviderWrite = !previousAppointment || hasAppointmentSyncChange(previousAppointment, appointment);

      if (!needsProviderWrite) {
        syncedAppointments.push({
          ...appointment,
          googleEventId,
          googleCalendarId: googleEventId ? googleCalendarId : "",
        });
        continue;
      }

      if (appointment.status === "CANCELED") {
        if (googleEventId) {
          await this.deleteGoogleEvent(accessToken, googleCalendarId, googleEventId);
        }
        syncedAppointments.push({ ...appointment, googleEventId: "", googleCalendarId: "" });
        continue;
      }

      if (connection.respectBusyTimes && !googleEventId) {
        const end = addMinutes(appointment.startsAt, appointment.durationMinutes);
        const hasConflict = await this.hasBusyConflict(accessToken, googleCalendarId, appointment.startsAt, end);

        if (hasConflict) {
          throw new BadRequestException(`Google Calendar is busy during "${appointment.title}". Choose another time.`);
        }
      }

      const eventId = googleEventId
        ? await this.updateGoogleEvent(accessToken, googleCalendarId, googleEventId, input.business, appointment)
        : await this.createGoogleEvent(accessToken, googleCalendarId, input.business, appointment);

      syncedAppointments.push({
        ...appointment,
        googleEventId: eventId,
        googleCalendarId,
      });
    }

    return syncedAppointments;
  }

  private toGoogleHealthResponse(connection: CalendarConnection | null, status: CalendarHealthStatus, message: string) {
    return {
      provider: "GOOGLE_CALENDAR" as const,
      connected: Boolean(connection),
      connectedEmail: connection?.providerAccountId || "",
      calendarId: connection?.calendarId || "primary",
      status,
      message,
      syncAppointments: connection?.syncAppointments ?? true,
      respectBusyTimes: connection?.respectBusyTimes ?? true,
      tokenExpiresAt: connection?.tokenExpiresAt?.toISOString() || "",
      lastHealthCheckedAt: connection?.lastHealthCheckedAt?.toISOString() || "",
      lastHealthStatus: connection?.lastHealthStatus || status,
      lastHealthError: connection?.lastHealthError || "",
      lastSyncAt: connection?.lastSyncAt?.toISOString() || "",
      lastSyncStatus: connection?.lastSyncStatus || "",
      lastSyncError: connection?.lastSyncError || "",
      lastSyncImportedCount: connection?.lastSyncImportedCount ?? 0,
      lastSyncUpdatedCount: connection?.lastSyncUpdatedCount ?? 0,
      lastSyncDeletedCount: connection?.lastSyncDeletedCount ?? 0,
      twoWaySyncMode: "manual-pull",
      pushNotificationsEnabled: false,
      pushNotificationsNote: "Google push sync needs a deployed HTTPS webhook. Manual two-way sync is available now.",
    };
  }

  private async listGoogleEvents(accessToken: string, calendarId: string) {
    const items: GoogleCalendarEvent[] = [];
    const timeMin = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
    const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
    let nextPageToken = "";
    let nextSyncToken = "";

    do {
      const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId || "primary")}/events`);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("showDeleted", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("maxResults", "2500");

      if (nextPageToken) {
        url.searchParams.set("pageToken", nextPageToken);
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const payload = (await response.json().catch(() => ({}))) as GoogleEventsListPayload;

      if (!response.ok) {
        throw new BadRequestException(googleApiErrorMessage(payload, "Unable to list Google Calendar events."));
      }

      items.push(...(payload.items ?? []));
      nextPageToken = payload.nextPageToken || "";
      nextSyncToken = payload.nextSyncToken || nextSyncToken;
    } while (nextPageToken);

    return {
      items,
      nextSyncToken,
    };
  }

  private async exchangeGoogleToken(input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    return (await response.json()) as GoogleTokenResponse;
  }

  private async fetchGoogleProfileEmail(accessToken: string) {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return "";
    }

    const profile = (await response.json()) as GoogleProfileResponse;
    return profile.email || "";
  }

  private async getGoogleAccessToken(connection: CalendarConnection) {
    const existingToken = connection.accessTokenEncrypted ? decryptToken(connection.accessTokenEncrypted) : "";
    const expiresAt = connection.tokenExpiresAt?.getTime() ?? 0;

    if (existingToken && expiresAt > Date.now() + 60_000) {
      return existingToken;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException("Missing Google OAuth client credentials in .env.");
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: decryptToken(connection.refreshTokenEncrypted),
        grant_type: "refresh_token",
      }),
    });
    const tokenResponse = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !tokenResponse.access_token) {
      throw new BadRequestException(tokenResponse.error_description || "Unable to refresh Google calendar access.");
    }

    await this.prisma.calendarConnection.update({
      where: {
        businessId_provider: {
          businessId: connection.businessId,
          provider: CalendarProvider.GOOGLE,
        },
      },
      data: {
        accessTokenEncrypted: encryptToken(tokenResponse.access_token),
        tokenExpiresAt: new Date(Date.now() + (tokenResponse.expires_in ?? 3300) * 1000),
      },
    });

    return tokenResponse.access_token;
  }

  private async hasBusyConflict(accessToken: string, calendarId: string, startsAt: string, endsAt: string) {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: new Date(startsAt).toISOString(),
        timeMax: new Date(endsAt).toISOString(),
        items: [{ id: calendarId || "primary" }],
      }),
    });

    const payload = (await response.json()) as GoogleApiErrorPayload & {
      calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
    };

    if (!response.ok) {
      throw new BadRequestException(googleApiErrorMessage(payload, "Unable to check Google Calendar availability."));
    }

    const busy = payload.calendars?.[calendarId || "primary"]?.busy ?? [];

    return busy.some((slot) => hasOverlap(startsAt, endsAt, slot.start, slot.end));
  }

  private async createGoogleEvent(
    accessToken: string,
    calendarId: string,
    business: CalendarSyncBusiness,
    appointment: CalendarSyncAppointment,
  ) {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId || "primary")}/events?sendUpdates=none`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.toGoogleEventBody(business, appointment)),
    });
    const payload = (await response.json()) as GoogleApiErrorPayload & { id?: string };

    if (!response.ok || !payload.id) {
      throw new BadRequestException(googleApiErrorMessage(payload, "Unable to create Google Calendar event."));
    }

    return payload.id;
  }

  private async updateGoogleEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    business: CalendarSyncBusiness,
    appointment: CalendarSyncAppointment,
  ) {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.toGoogleEventBody(business, appointment)),
      },
    );

    if (response.status === 404 || response.status === 410) {
      return this.createGoogleEvent(accessToken, calendarId, business, appointment);
    }

    const payload = (await response.json().catch(() => ({}))) as GoogleApiErrorPayload & { id?: string };

    if (!response.ok) {
      throw new BadRequestException(googleApiErrorMessage(payload, "Unable to update Google Calendar event."));
    }

    return payload.id || eventId;
  }

  private async deleteGoogleEvent(accessToken: string, calendarId: string, eventId: string) {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok && response.status !== 404 && response.status !== 410) {
      const payload = (await response.json().catch(() => ({}))) as GoogleApiErrorPayload;
      throw new BadRequestException(googleApiErrorMessage(payload, "Unable to delete Google Calendar event."));
    }
  }

  private toGoogleEventBody(business: CalendarSyncBusiness, appointment: CalendarSyncAppointment) {
    const end = addMinutes(appointment.startsAt, appointment.durationMinutes);
    const details = [
      appointment.customerName ? `Customer: ${appointment.customerName}` : "",
      appointment.customerPhone ? `Phone: ${appointment.customerPhone}` : "",
      appointment.customerEmail ? `Email: ${appointment.customerEmail}` : "",
      appointment.serviceType ? `Service: ${appointment.serviceType}` : "",
      appointment.notes ? `Notes: ${appointment.notes}` : "",
      `Business: ${business.name}`,
      "Booked through DeltaPrompt AI.",
    ].filter(Boolean);

    return {
      summary: appointment.title,
      description: details.join("\n"),
      start: {
        dateTime: toGoogleDateTime(appointment.startsAt),
        timeZone: business.timezone || "America/Toronto",
      },
      end: {
        dateTime: toGoogleDateTime(end),
        timeZone: business.timezone || "America/Toronto",
      },
      extendedProperties: {
        private: {
          deltapromptAppointmentId: appointment.id,
          deltapromptBusinessId: business.id,
        },
      },
    };
  }
}
