import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BusinessCategory, UserRole } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { BusinessMemberCreateInput } from "./business-members.schemas";
import {
  BusinessAiSettingsInput,
  BusinessAppointmentsUpdateInput,
  BusinessBillingSettingsInput,
  BusinessCalendarIntegrationInput,
  BusinessKnowledgeBaseInput,
  BusinessMenuImportInput,
  BusinessMenuUpdateInput,
  BusinessOnboardingInput,
  BusinessProfileUpdateInput,
  BusinessTelephonySettingsInput,
  PharmacyCallbackRequestsUpdateInput,
  PharmacyRefillRequestsUpdateInput,
} from "./businesses.schemas";

const medicalCategories = new Set<BusinessCategory>([
  BusinessCategory.CLINIC,
  BusinessCategory.DOCTOR,
  BusinessCategory.DENTAL,
  BusinessCategory.PHARMACY,
  BusinessCategory.PHYSIOTHERAPY,
  BusinessCategory.VETERINARY,
]);

function isMedicalBusinessCategory(category: string | BusinessCategory | null | undefined) {
  return medicalCategories.has(String(category ?? "").trim().toUpperCase() as BusinessCategory);
}

function resolveMedicalMode(business: { category: string | BusinessCategory; medicalModeEnabled: boolean }) {
  return business.medicalModeEnabled || isMedicalBusinessCategory(business.category);
}

function resolveOnboardingCompleted(
  business: {
    onboardingCompleted: boolean;
    name?: string | null;
    category?: string | BusinessCategory | null;
    phoneNumber?: string | null;
    address?: string | null;
    timezone?: string | null;
    description?: string | null;
    servicesSummary?: string | null;
  },
) {
  if (business.onboardingCompleted) {
    return true;
  }

  const hasCoreIdentity =
    String(business.name ?? "").trim().length >= 2 &&
    String(business.category ?? "").trim().length >= 2 &&
    String(business.phoneNumber ?? "").trim().length >= 7 &&
    String(business.address ?? "").trim().length >= 4 &&
    String(business.timezone ?? "").trim().length >= 3;

  const hasBusinessContext =
    String(business.description ?? "").trim().length >= 10 ||
    String(business.servicesSummary ?? "").trim().length >= 10;

  return hasCoreIdentity && hasBusinessContext;
}

function normalizeCategory(industryType: string): BusinessCategory {
  const value = industryType.trim().toUpperCase().replace(/[\s/-]+/g, "_");
  return BusinessCategory[value as keyof typeof BusinessCategory] ?? BusinessCategory.OTHER;
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function readBusinessRules(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function extractMenuItems(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rules = value as Record<string, unknown>;
  const menu = rules.menu;

  if (!menu || typeof menu !== "object" || Array.isArray(menu)) {
    return [];
  }

  const items = (menu as Record<string, unknown>).items;

  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const record = item as Record<string, unknown>;

      return {
        name: String(record.name ?? "").trim(),
        category: String(record.category ?? "").trim(),
        description: String(record.description ?? "").trim(),
        price: String(record.price ?? "").trim(),
        available: record.available !== false,
        availabilityMode:
          record.availabilityMode === "DISABLED_TODAY" || record.availabilityMode === "DISABLED_UNTIL"
            ? record.availabilityMode
            : "AVAILABLE",
        disabledUntil: String(record.disabledUntil ?? "").trim(),
      };
    })
    .filter((item) => item.name.length > 0 && item.category.length > 0);
}

function extractMenuSource(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const rules = value as Record<string, unknown>;
  const menu = rules.menu;

  if (!menu || typeof menu !== "object" || Array.isArray(menu)) {
    return null;
  }

  const source = (menu as Record<string, unknown>).source;

  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  return {
    filename: String((source as Record<string, unknown>).filename ?? "").trim(),
    mimeType: String((source as Record<string, unknown>).mimeType ?? "").trim(),
    importedAt: String((source as Record<string, unknown>).importedAt ?? "").trim(),
  };
}

type BillingPreset = {
  includedMinutesPerMonth: number;
  overageRatePerMinute: number;
  status: "TRIAL" | "ACTIVE";
};

const BILLING_PLAN_PRESETS: Record<string, BillingPreset> = {
  FREE_TRIAL: {
    includedMinutesPerMonth: 100,
    overageRatePerMinute: 0.5,
    status: "TRIAL",
  },
  STARTER: {
    includedMinutesPerMonth: 300,
    overageRatePerMinute: 0.35,
    status: "ACTIVE",
  },
  GROWTH: {
    includedMinutesPerMonth: 750,
    overageRatePerMinute: 0.3,
    status: "ACTIVE",
  },
  PRO: {
    includedMinutesPerMonth: 1500,
    overageRatePerMinute: 0.25,
    status: "ACTIVE",
  },
};

function normalizePlanKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, "_");
}

function roundBillingMinutes(value: number) {
  return Math.round(value * 10) / 10;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function addMonthsAnchored(base: Date, monthsToAdd: number, anchorDay: number) {
  const next = new Date(base);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + monthsToAdd);
  const daysInTargetMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(anchorDay, daysInTargetMonth));
  return next;
}

function addYearsAnchored(base: Date, yearsToAdd: number, anchorMonth: number, anchorDay: number) {
  const next = new Date(Date.UTC(base.getUTCFullYear() + yearsToAdd, anchorMonth, 1));
  const daysInTargetMonth = new Date(Date.UTC(next.getUTCFullYear(), anchorMonth + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(anchorDay, daysInTargetMonth));
  return next;
}

function calculateBillingWindow(anchorDate: Date, billingCycle: string | null | undefined, now = new Date()) {
  const cycleKey = String(billingCycle ?? "Monthly").trim().toUpperCase();
  const anchorDay = anchorDate.getUTCDate();
  const anchorMonth = anchorDate.getUTCMonth();
  let cycleStart = new Date(anchorDate);
  let cycleEnd =
    cycleKey === "YEARLY" || cycleKey === "ANNUAL"
      ? addYearsAnchored(cycleStart, 1, anchorMonth, anchorDay)
      : addMonthsAnchored(cycleStart, 1, anchorDay);

  while (cycleEnd <= now) {
    cycleStart = cycleEnd;
    cycleEnd =
      cycleKey === "YEARLY" || cycleKey === "ANNUAL"
        ? addYearsAnchored(cycleStart, 1, anchorMonth, anchorDay)
        : addMonthsAnchored(cycleStart, 1, anchorDay);
  }

  return {
    cycleStart,
    cycleEnd,
  };
}

function extractBillingSettings(value: unknown) {
  const rules = readBusinessRules(value);
  const billing = rules.billing;

  if (!billing || typeof billing !== "object" || Array.isArray(billing)) {
    return {};
  }

  const record = billing as Record<string, unknown>;

  return {
    includedMinutesPerMonth: Number(record.includedMinutesPerMonth ?? 0),
    overageRatePerMinute: Number(record.overageRatePerMinute ?? 0),
    status: String(record.status ?? "").trim(),
  };
}

// ─── Knowledge Base extractors ────────────────────────────────────────────────

function extractKnowledgeBase(value: unknown) {
  const rules = readBusinessRules(value);
  const kb = rules.knowledgeBase;
  if (!kb || typeof kb !== "object" || Array.isArray(kb)) {
    return { faqs: [], objections: [], leadCaptureFlow: [], services: [], differentiators: "" };
  }
  const record = kb as Record<string, unknown>;

  const faqs = Array.isArray(record.faqs)
    ? record.faqs
        .filter((f) => f && typeof f === "object")
        .map((f) => {
          const r = f as Record<string, unknown>;
          return { id: String(r.id ?? ""), question: String(r.question ?? ""), answer: String(r.answer ?? ""), isActive: r.isActive !== false };
        })
        .filter((f) => f.id && f.question && f.answer)
    : [];

  const objections = Array.isArray(record.objections)
    ? record.objections
        .filter((o) => o && typeof o === "object")
        .map((o) => {
          const r = o as Record<string, unknown>;
          return { id: String(r.id ?? ""), objection: String(r.objection ?? ""), response: String(r.response ?? ""), isActive: r.isActive !== false };
        })
        .filter((o) => o.id && o.objection && o.response)
    : [];

  const leadCaptureFlow = Array.isArray(record.leadCaptureFlow)
    ? record.leadCaptureFlow
        .filter((q) => q && typeof q === "object")
        .map((q) => {
          const r = q as Record<string, unknown>;
          return { id: String(r.id ?? ""), question: String(r.question ?? ""), fieldName: String(r.fieldName ?? ""), order: Number(r.order ?? 0), isRequired: r.isRequired !== false };
        })
        .filter((q) => q.id && q.question && q.fieldName)
        .sort((a, b) => a.order - b.order)
    : [];

  const services = Array.isArray(record.services)
    ? record.services
        .filter((s) => s && typeof s === "object")
        .map((s) => {
          const r = s as Record<string, unknown>;
          return { id: String(r.id ?? ""), serviceName: String(r.serviceName ?? ""), description: String(r.description ?? ""), whoItsFor: String(r.whoItsFor ?? ""), problemItSolves: String(r.problemItSolves ?? ""), isActive: r.isActive !== false };
        })
        .filter((s) => s.id && s.serviceName)
    : [];

  return {
    faqs,
    objections,
    leadCaptureFlow,
    services,
    differentiators: typeof record.differentiators === "string" ? record.differentiators : "",
  };
}

function extractConversationGoal(value: unknown): string {
  const rules = readBusinessRules(value);
  return typeof rules.conversationGoal === "string" ? rules.conversationGoal : "TAKE_MESSAGES";
}

function normalizeAppointmentStatus(value: unknown) {
  const status = String(value ?? "CONFIRMED").trim().toUpperCase();
  return status === "PENDING" || status === "COMPLETED" || status === "CANCELED" ? status : "CONFIRMED";
}

function normalizeAppointmentSource(value: unknown) {
  const source = String(value ?? "MANUAL").trim().toUpperCase();
  return source === "AI_BOOKED" || source === "MICROSOFT_SYNC" ? source : "MANUAL";
}

function normalizeAppointmentAccent(value: unknown) {
  const accent = String(value ?? "blue").trim().toLowerCase();
  return accent === "green" || accent === "red" ? accent : "blue";
}

function extractAppointments(value: unknown) {
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
      };
    })
    .filter((appointment) => appointment.id && appointment.title && appointment.startsAt)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

function hasConfiguredAppointments(value: unknown) {
  const rules = readBusinessRules(value);
  return Array.isArray(rules.appointments) || typeof rules.appointmentsUpdatedAt === "string";
}

function extractCalendarIntegration(value: unknown) {
  const rules = readBusinessRules(value);
  const calendar = rules.calendarIntegration;

  if (!calendar || typeof calendar !== "object" || Array.isArray(calendar)) {
    return {
      provider: "MICROSOFT_OUTLOOK",
      connected: false,
      connectedEmail: "",
      connectedAt: "",
      syncAppointments: true,
      respectBusyTimes: true,
    };
  }

  const record = calendar as Record<string, unknown>;

  return {
    provider: "MICROSOFT_OUTLOOK",
    connected: Boolean(record.connected),
    connectedEmail: String(record.connectedEmail ?? "").trim(),
    connectedAt: String(record.connectedAt ?? "").trim(),
    syncAppointments: record.syncAppointments !== false,
    respectBusyTimes: record.respectBusyTimes !== false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function extractPharmacyRefillRequests(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rules = value as Record<string, unknown>;
  const pharmacy = rules.pharmacy;

  if (!pharmacy || typeof pharmacy !== "object" || Array.isArray(pharmacy)) {
    return [];
  }

  const requests = (pharmacy as Record<string, unknown>).refillRequests;

  if (!Array.isArray(requests)) {
    return [];
  }

  return requests
    .filter((request) => request && typeof request === "object" && !Array.isArray(request))
    .map((request) => {
      const record = request as Record<string, unknown>;

      return {
        id: String(record.id ?? "").trim(),
        patientName: String(record.patientName ?? "").trim(),
        phoneNumber: String(record.phoneNumber ?? "").trim(),
        medicationName: String(record.medicationName ?? "").trim(),
        prescriptionNumber: String(record.prescriptionNumber ?? "").trim(),
        requestedOn: String(record.requestedOn ?? "").trim(),
        preferredPickupTime: String(record.preferredPickupTime ?? "").trim(),
        notes: String(record.notes ?? "").trim(),
        assignedTo: String(record.assignedTo ?? "").trim(),
        status: String(record.status ?? "NEW").trim() || "NEW",
      };
    })
    .filter((request) => request.id && request.patientName && request.phoneNumber && request.medicationName);
}

function extractDismissedPharmacyRefillRequestIds(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rules = value as Record<string, unknown>;
  const pharmacy = rules.pharmacy;

  if (!pharmacy || typeof pharmacy !== "object" || Array.isArray(pharmacy)) {
    return [];
  }

  const dismissed = (pharmacy as Record<string, unknown>).dismissedRefillRequestIds;

  if (!Array.isArray(dismissed)) {
    return [];
  }

  return dismissed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function extractPharmacyCallbackRequests(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rules = value as Record<string, unknown>;
  const pharmacy = rules.pharmacy;

  if (!pharmacy || typeof pharmacy !== "object" || Array.isArray(pharmacy)) {
    return [];
  }

  const requests = (pharmacy as Record<string, unknown>).callbackRequests;

  if (!Array.isArray(requests)) {
    return [];
  }

  return requests
    .filter((request) => request && typeof request === "object" && !Array.isArray(request))
    .map((request) => {
      const record = request as Record<string, unknown>;

      return {
        id: String(record.id ?? "").trim(),
        patientName: String(record.patientName ?? "").trim(),
        phoneNumber: String(record.phoneNumber ?? "").trim(),
        reason: String(record.reason ?? "").trim(),
        notes: String(record.notes ?? "").trim(),
        requestedOn: String(record.requestedOn ?? "").trim(),
        priority: String(record.priority ?? "NORMAL").trim() || "NORMAL",
        assignedTo: String(record.assignedTo ?? "").trim(),
        lastAttemptAt: String(record.lastAttemptAt ?? "").trim(),
        status: String(record.status ?? "NEW").trim() || "NEW",
      };
    })
    .filter((request) => request.id && request.patientName && request.phoneNumber && request.reason);
}

function extractDismissedPharmacyCallbackRequestIds(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const rules = value as Record<string, unknown>;
  const pharmacy = rules.pharmacy;

  if (!pharmacy || typeof pharmacy !== "object" || Array.isArray(pharmacy)) {
    return [];
  }

  const dismissed = (pharmacy as Record<string, unknown>).dismissedCallbackRequestIds;

  if (!Array.isArray(dismissed)) {
    return [];
  }

  return dismissed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function normalizePhoneNumber(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function extractCallerTranscriptLines(transcript: string | null | undefined) {
  return String(transcript ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("Caller:"))
    .map((line) => line.replace(/^Caller:\s*/i, "").trim())
    .filter(Boolean);
}

function firstMatchingCallerLine(lines: string[], expression: RegExp) {
  return lines.find((line) => expression.test(line)) || "";
}

function findMedicationCallerLine(lines: string[]) {
  return (
    lines.find((line) => /\b\d+\s*(?:mg|mcg|ml)\b/i.test(line) && /(order|refill|prescription|medicine|medication|it'?s|it is)/i.test(line)) ||
    lines.find((line) => /(order|refill)\s+(?:a|an|my)?\s*[A-Za-z]/i.test(line) && !/\b(?:medicine|medication|prescription)\b$/i.test(line.trim())) ||
    firstMatchingCallerLine(lines, /(?:it'?s|it is|order|refill|prescription|medicine|medication)/i)
  );
}

function findPickupCallerLine(lines: string[]) {
  return (
    lines.find((line) => /(tomorrow|today|\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.|am|pm))/i.test(line) && /(pickup|pick up|at|after|around|for)/i.test(line)) ||
    firstMatchingCallerLine(lines, /(?:pickup|pick up|a\.m\.|p\.m\.|am|pm|tomorrow|today)/i)
  );
}

function extractPatientName(source: string, fallbackName?: string | null) {
  const match =
    source.match(/(?:my full name is|my name is|this is)\s+([A-Za-z][A-Za-z\s'-]{1,80})/i) ||
    source.match(/name[:\s]+([A-Za-z][A-Za-z\s'-]{1,80})/i);

  return match?.[1]?.trim() || fallbackName?.trim() || "Not provided";
}

function extractSpokenPhoneNumber(source: string, fallbackPhone?: string | null) {
  const match =
    source.match(/(?:phone number is|reach me at|it's|it is|call me at|yeah[, ]*)\s*([0-9()\-\s+]{7,25})/i) ||
    source.match(/\b([0-9][0-9()\-\s+]{8,24})\b/);

  if (match?.[1]) {
    const raw = match[1].trim().replace(/\s+/g, " ");
    const digits = raw.replace(/\D/g, "");

    if (digits.length === 10) {
      return digits;
    }

    if (digits.length === 11 && digits.startsWith("1")) {
      return digits.slice(1);
    }

    return raw;
  }

  return String(fallbackPhone ?? "").trim();
}

function extractMedicationName(source: string) {
  const explicitMatch =
    source.match(/(?:it'?s|it is)\s+([A-Za-z][A-Za-z0-9\s/-]{1,60}(?:mg|mcg|ml)?)\.?/i) ||
    source.match(/(?:want|would like)(?:\s+to)?\s+(?:order|refill)\s+(?:a|an|my)?\s*([A-Za-z][A-Za-z0-9/-]*(?:\s+[A-Za-z0-9/-]+){0,4})/i) ||
    source.match(/(?:order|refill)\s+(?:a|an|my)?\s*([A-Za-z][A-Za-z0-9/-]*(?:\s+[A-Za-z0-9/-]+){0,4})/i) ||
    source.match(/(?:refill(?: my)? prescription for|refill(?: my)? medication for|prescription for|medication for)\s+([A-Za-z0-9][A-Za-z0-9\s/-]{1,80})/i);

  if (explicitMatch?.[1]) {
    const cleaned = explicitMatch[1]
      .trim()
      .replace(/[.,]$/, "")
      .replace(/^(?:a|an|my)\s+/i, "");

    if (!/^(medicine|medication|prescription)$/i.test(cleaned)) {
      return cleaned;
    }
  }

  const genericMatch = source.match(/(?:refill|prescription|medication|medicine)\s+([A-Za-z0-9][A-Za-z0-9\s/-]{1,80})/i);
  const genericValue = genericMatch?.[1]?.trim().replace(/[.,]$/, "") || "";

  if (genericValue && !/^(my medicine|my medication|my prescription|medicine|medication|prescription)$/i.test(genericValue)) {
    return genericValue;
  }

  return "Medication request captured by AI";
}

function extractPickupPreference(source: string) {
  const explicitTime =
    source.match(/(?:pickup|pick up).{0,20}\b(at|after|around|for)\s+([^.!?\n]{2,40})/i) ||
    source.match(/\b(at|after|around|for)\s+(\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.|am|pm)|tomorrow|today[^.!?\n]*)/i);

  if (explicitTime?.[2]) {
    return explicitTime[2].trim().replace(/[.,]$/, "");
  }

  return /\bpickup|pick up\b/i.test(source) ? "pickup" : "";
}

function buildRefillNotes(medicationName: string, pickupTime: string) {
  if (pickupTime) {
    return `Patient requested a refill for ${medicationName} and asked for pickup ${pickupTime}. Team should confirm prescription details.`;
  }

  return `Patient requested a refill for ${medicationName}. Team should confirm prescription details and pickup timing.`;
}

function buildCallbackNotes(reason: string) {
  return `Patient requested a pharmacist callback regarding: ${reason}.`;
}

function derivePharmacyRefillRequestFromCall(call: {
  id: string;
  callerName: string | null;
  callerNumber: string | null;
  summary: string | null;
  transcript: string | null;
  startedAt: Date;
}) {
  const source = `${call.summary || ""}\n${call.transcript || ""}`.trim();
  const callerLines = extractCallerTranscriptLines(call.transcript);
  const callerSource = callerLines.join(" ");

  if (!/(refill|prescription|pickup|medication|medicine)/i.test(source)) {
    return null;
  }

  const requestDate = call.startedAt.toISOString().slice(0, 10);
  const patientLine = firstMatchingCallerLine(callerLines, /(?:my full name is|my name is|this is|name[:\s]+)/i);
  const phoneLine = firstMatchingCallerLine(callerLines, /(?:phone number|reach me|it'?s|it is|call me at|yeah[, ]*|^\d[\d\s()+-]{8,})/i);
  const medicationLine = findMedicationCallerLine(callerLines);
  const pickupLine = findPickupCallerLine(callerLines);

  const patientName = extractPatientName(patientLine || callerSource, call.callerName);
  const phoneNumber = extractSpokenPhoneNumber(phoneLine || callerSource, call.callerNumber);
  const medicationName = extractMedicationName(medicationLine || callerSource || source);
  const preferredPickupTime = extractPickupPreference(pickupLine || callerSource);

  return {
    id: `call-${call.id}`,
    patientName,
    phoneNumber: normalizePhoneNumber(phoneNumber),
    medicationName,
    prescriptionNumber: "",
    requestedOn: requestDate,
    preferredPickupTime,
    notes: buildRefillNotes(medicationName, preferredPickupTime),
    assignedTo: "",
    status: "NEW",
  };
}

function derivePharmacyCallbackRequestFromCall(call: {
  id: string;
  callerName: string | null;
  callerNumber: string | null;
  summary: string | null;
  transcript: string | null;
  startedAt: Date;
}) {
  const source = `${call.summary || ""}\n${call.transcript || ""}`.trim();
  const callerLines = extractCallerTranscriptLines(call.transcript);
  const callerSource = callerLines.join(" ");

  if (!/(callback|call back|speak with pharmacist|pharmacist call)/i.test(source)) {
    return null;
  }

  const reasonMatch =
    callerSource.match(/(?:callback(?: request)?|call back(?: request)?|reason(?: for callback)?)[\s:]+([A-Za-z0-9][A-Za-z0-9\s,.'/-]{3,120})/i) ||
    callerSource.match(/^(.{8,180})$/i);
  const patientLine = firstMatchingCallerLine(callerLines, /(?:my full name is|my name is|this is|name[:\s]+)/i);
  const phoneLine = firstMatchingCallerLine(callerLines, /(?:phone number|reach me|it'?s|it is|call me at|yeah[, ]*|^\d[\d\s()+-]{8,})/i);
  const patientName = extractPatientName(patientLine || callerSource, call.callerName);
  const phoneNumber = extractSpokenPhoneNumber(phoneLine || callerSource, call.callerNumber);
  const reason = reasonMatch?.[1]?.trim() || "Patient requested a pharmacist callback.";

  return {
    id: `call-${call.id}`,
    patientName,
    phoneNumber: normalizePhoneNumber(phoneNumber),
    reason,
    notes: buildCallbackNotes(reason),
    requestedOn: call.startedAt.toISOString().slice(0, 10),
    priority: /(urgent|as soon as possible|right away)/i.test(source) ? "URGENT" : "NORMAL",
    assignedTo: "",
    lastAttemptAt: "",
    status: "NEW",
  };
}

function extractJsonObject(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return withoutFences.slice(firstBrace, lastBrace + 1);
  }

  const firstBracket = withoutFences.indexOf("[");
  const lastBracket = withoutFences.lastIndexOf("]");

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return `{"items":${withoutFences.slice(firstBracket, lastBracket + 1)}}`;
  }

  return "";
}

function extractResponseText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text;
  }

  const output = record.output;

  if (!Array.isArray(output)) {
    return "";
  }

  const parts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const content = (item as Record<string, unknown>).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const entry of content) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }

      const textValue = (entry as Record<string, unknown>).text;

      if (typeof textValue === "string" && textValue.trim()) {
        parts.push(textValue);
      }
    }
  }

  return parts.join("\n").trim();
}

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  private async calculateBillingOverview(business: {
    id: string;
    selectedPlan: string | null;
    billingCycle: string | null;
    answeringRules: unknown;
    createdAt: Date;
  }) {
    const planName = business.selectedPlan?.trim() || "Free Trial";
    const billingCycle = business.billingCycle?.trim() || "Monthly";
    const planKey = normalizePlanKey(planName);
    const preset = BILLING_PLAN_PRESETS[planKey] ?? BILLING_PLAN_PRESETS.FREE_TRIAL;
    const savedBilling = extractBillingSettings(business.answeringRules);
    const includedMinutes =
      typeof savedBilling.includedMinutesPerMonth === "number" &&
      Number.isFinite(savedBilling.includedMinutesPerMonth) &&
      savedBilling.includedMinutesPerMonth > 0
        ? savedBilling.includedMinutesPerMonth
        : preset.includedMinutesPerMonth;
    const overageRate =
      typeof savedBilling.overageRatePerMinute === "number" &&
      Number.isFinite(savedBilling.overageRatePerMinute) &&
      savedBilling.overageRatePerMinute > 0
        ? savedBilling.overageRatePerMinute
        : preset.overageRatePerMinute;
    const status =
      savedBilling.status === "ACTIVE" ||
      savedBilling.status === "PAUSED" ||
      savedBilling.status === "PAST_DUE" ||
      savedBilling.status === "CANCELED" ||
      savedBilling.status === "TRIAL"
        ? savedBilling.status
        : preset.status;
    const { cycleStart, cycleEnd } = calculateBillingWindow(business.createdAt, billingCycle);

    const calls = await this.prisma.call.findMany({
      where: {
        businessId: business.id,
        endedAt: {
          gte: cycleStart,
          lt: cycleEnd,
        },
      },
      select: {
        startedAt: true,
        endedAt: true,
      },
    });

    const usedMinutesRaw = calls.reduce((total, call) => {
      if (!call.endedAt) {
        return total;
      }

      const durationMs = Math.max(0, call.endedAt.getTime() - call.startedAt.getTime());
      return total + durationMs / 60000;
    }, 0);

    const usedMinutes = roundBillingMinutes(usedMinutesRaw);
    const remainingMinutes = roundBillingMinutes(Math.max(0, includedMinutes - usedMinutes));
    const overageMinutes = roundBillingMinutes(Math.max(0, usedMinutes - includedMinutes));
    const estimatedOverageCharge = roundCurrency(overageMinutes * overageRate);

    return {
      planName,
      billingCycle,
      status,
      cycleStart: cycleStart.toISOString(),
      cycleEnd: cycleEnd.toISOString(),
      includedMinutes,
      usedMinutes,
      remainingMinutes,
      overageMinutes,
      overageRatePerMinute: overageRate,
      estimatedOverageCharge,
    };
  }

  private assertPharmacyBusiness(category: BusinessCategory) {
    if (category !== BusinessCategory.PHARMACY) {
      throw new BadRequestException("This pharmacy workflow is only available for pharmacy businesses.");
    }
  }

  private async ensureDemoCalls(businessId: string, businessName: string, businessCategory: BusinessCategory) {
    const count = await this.prisma.call.count({
      where: { businessId },
    });

    if (count > 0) {
      return;
    }

    const businessLabel = businessName || "the business";
    const emergencyNote =
      businessCategory === BusinessCategory.CLINIC || businessCategory === BusinessCategory.DOCTOR
        ? "If this is a medical emergency, please call 911 immediately."
        : "";

    await this.prisma.call.createMany({
      data: [
        {
          businessId,
          status: "ANSWERED_BY_AI",
          callerName: "Michael Turner",
          callerNumber: "+1 519-555-0142",
          callerEmail: "michael.turner@example.com",
          summary: "Asked for pricing and placed a same-day pickup order.",
          transcript: `Caller asked whether ${businessLabel} was open after hours. AI explained pickup timing, confirmed menu pricing, and recorded a same-day order request.`,
          recordingUrl: "https://example.com/recordings/demo-call-1",
          startedAt: new Date(Date.now() - 1000 * 60 * 32),
          endedAt: new Date(Date.now() - 1000 * 60 * 27),
        },
        {
          businessId,
          status: "ANSWERED_BY_AI",
          callerName: "Sarah Collins",
          callerNumber: "+1 226-555-0194",
          callerEmail: "sarah.collins@example.com",
          summary: "Requested a callback and asked about available consultation times.",
          transcript: `Caller wanted a consultation slot next week. AI captured callback preference, caller email, and a short note for staff follow-up.`,
          recordingUrl: "https://example.com/recordings/demo-call-2",
          startedAt: new Date(Date.now() - 1000 * 60 * 115),
          endedAt: new Date(Date.now() - 1000 * 60 * 110),
        },
        {
          businessId,
          status: "ESCALATED",
          callerName: "Emma Wright",
          callerNumber: "+1 437-555-0177",
          callerEmail: "emma.wright@example.com",
          summary: `After-hours request captured. ${emergencyNote}`.trim(),
          transcript: `Caller reached ${businessLabel} outside office hours. AI recorded the message, explained after-hours fulfillment timing, and delivered the configured safety guidance when applicable.`,
          recordingUrl: "https://example.com/recordings/demo-call-3",
          startedAt: new Date(Date.now() - 1000 * 60 * 245),
          endedAt: new Date(Date.now() - 1000 * 60 * 240),
        },
      ],
    });
  }

  async getBusinessById(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const billingOverview = await this.calculateBillingOverview(business);

    return {
      business: {
        id: business.id,
        name: business.name,
        category: business.category,
        email: business.email,
        phoneNumber: business.phoneNumber,
        address: business.address,
        description: business.description,
        servicesSummary: business.servicesSummary,
        priceListSummary: business.priceListSummary,
        officeHours: business.officeHours,
        answeringRules: business.answeringRules,
        greetingMessage: business.greetingMessage,
        voicePreference: business.voicePreference,
        selectedPlan: business.selectedPlan,
        billingCycle: business.billingCycle,
        onboardingCompleted: resolveOnboardingCompleted(business),
        medicalModeEnabled: resolveMedicalMode(business),
        aiEnabled: business.aiEnabled,
        timezone: business.timezone,
        telephonySettings: readBusinessRules(business.answeringRules).telephony ?? null,
        menuItems: extractMenuItems(business.answeringRules),
        menuSource: extractMenuSource(business.answeringRules),
        pharmacyRefillRequests: extractPharmacyRefillRequests(business.answeringRules),
        pharmacyCallbackRequests: extractPharmacyCallbackRequests(business.answeringRules),
        knowledgeBase: extractKnowledgeBase(business.answeringRules),
        conversationGoal: extractConversationGoal(business.answeringRules),
        appointments: extractAppointments(business.answeringRules),
        appointmentsConfigured: hasConfiguredAppointments(business.answeringRules),
        calendarIntegration: extractCalendarIntegration(business.answeringRules),
        billingOverview,
      },
    };
  }

  async listAdminBusinesses() {
    const businesses = await this.prisma.business.findMany({
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const items = await Promise.all(
      businesses.map(async (business) => {
        const ownerMembership =
          business.members.find((membership) => membership.role === UserRole.BUSINESS_OWNER) || business.members[0] || null;
        const billingOverview = await this.calculateBillingOverview(business);
        const telephony = readBusinessRules(business.answeringRules).telephony;
        const telephonySettings =
          telephony && typeof telephony === "object" && !Array.isArray(telephony)
            ? (telephony as Record<string, unknown>)
            : {};

        return {
          id: business.id,
          name: business.name,
          category: business.category,
          businessEmail: business.email || "",
          ownerEmail: ownerMembership?.user.email || business.email || "",
          ownerName: ownerMembership?.user.fullName || business.name,
          phoneNumber: business.phoneNumber || "",
          address: business.address || "",
          timezone: business.timezone,
          twilioNumber: String(telephonySettings.twilioNumber ?? "").trim(),
          selectedPlan: business.selectedPlan || billingOverview.planName,
          billingCycle: business.billingCycle || billingOverview.billingCycle,
          billingStatus: billingOverview.status,
          includedMinutes: billingOverview.includedMinutes,
          usedMinutes: billingOverview.usedMinutes,
          overageMinutes: billingOverview.overageMinutes,
          overageRatePerMinute: billingOverview.overageRatePerMinute,
          remainingMinutes: billingOverview.remainingMinutes,
          aiEnabled: business.aiEnabled,
          medicalModeEnabled: resolveMedicalMode(business),
          onboardingCompleted: resolveOnboardingCompleted(business),
          memberCount: business.members.length,
          members: business.members.map((membership) => ({
            id: membership.user.id,
            email: membership.user.email,
            fullName: membership.user.fullName || "",
            role: membership.role,
          })),
          createdAt: business.createdAt.toISOString(),
        };
      }),
    );

    return {
      businesses: items,
    };
  }

  async updateProfile(businessId: string, input: BusinessProfileUpdateInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: input.businessName.trim(),
        phoneNumber: input.phoneNumber.trim(),
        timezone: input.timezone.trim(),
        address: input.address.trim(),
        description: input.description.trim(),
        servicesSummary: input.servicesSummary.trim(),
        priceListSummary: input.priceListSummary.trim() || null,
        officeHours: input.officeHours,
      },
    });

    return {
      message: "Business profile updated successfully.",
      business: {
        id: business.id,
        name: business.name,
        phoneNumber: business.phoneNumber,
        timezone: business.timezone,
        address: business.address,
        description: business.description,
        servicesSummary: business.servicesSummary,
        priceListSummary: business.priceListSummary,
        officeHours: business.officeHours,
      },
    };
  }

  async updateMenu(businessId: string, input: BusinessMenuUpdateInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const previousRules = readBusinessRules(existing.answeringRules);
    const nextMenuItems = input.items.map((item) => ({
      name: item.name.trim(),
      category: item.category.trim(),
      description: item.description.trim(),
      price: item.price.trim(),
      available: item.available,
      availabilityMode: item.availabilityMode,
      disabledUntil: item.disabledUntil.trim(),
    }));
    const previousMenu =
      previousRules.menu && typeof previousRules.menu === "object" && !Array.isArray(previousRules.menu)
        ? (previousRules.menu as Record<string, unknown>)
        : {};

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        answeringRules: {
          ...previousRules,
          menu: {
            items: nextMenuItems,
            source: input.source ?? previousMenu.source ?? null,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });

    return {
      message: "Menu updated successfully.",
      business: {
        id: business.id,
        menuItems: extractMenuItems(business.answeringRules),
        menuSource: extractMenuSource(business.answeringRules),
      },
    };
  }

  async importMenu(businessId: string, input: BusinessMenuImportInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      throw new BadRequestException("OPENAI_API_KEY is required to import PDF or image menus.");
    }

    const model = "gpt-4.1-mini";
    const isPdf = input.mimeType.toLowerCase().includes("pdf");
    let inputItem:
      | {
          type: "input_file";
          file_id: string;
        }
      | {
          type: "input_image";
          image_url: string;
          detail: "high";
        };

    if (isPdf) {
      const fileBuffer = Buffer.from(input.contentBase64, "base64");
      const fileForm = new FormData();
      fileForm.set("purpose", "user_data");
      fileForm.set("file", new Blob([fileBuffer], { type: input.mimeType }), input.filename);

      const uploadResponse = await fetch("https://api.openai.com/v1/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: fileForm,
      });

      const uploadPayload = (await uploadResponse.json()) as {
        id?: string;
        error?: { message?: string };
      };

      if (!uploadResponse.ok || !uploadPayload.id) {
        throw new BadRequestException(uploadPayload.error?.message || "PDF upload for menu extraction failed.");
      }

      inputItem = {
        type: "input_file",
        file_id: uploadPayload.id,
      };
    } else {
      inputItem = {
        type: "input_image",
        image_url: `data:${input.mimeType};base64,${input.contentBase64}`,
        detail: "high",
      };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "Extract a restaurant or bakery menu into strict JSON. Return only one JSON object with this shape: {\"items\":[{\"name\":\"string\",\"category\":\"string\",\"description\":\"string\",\"price\":\"string\"}]}. Use short categories like Appetizers, Soups, Salads, Pasta, Mains, Desserts, Drinks, Bakery, Cakes. Do not include explanations. If price is missing, use an empty string.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Read this uploaded menu and extract menu items into the requested JSON format.",
              },
              inputItem,
            ],
          },
        ],
      }),
    });

    const payload = (await response.json()) as {
      output_text?: string;
      output?: unknown;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new BadRequestException(payload.error?.message || "Menu extraction failed.");
    }

    const rawJson = extractJsonObject(extractResponseText(payload));

    if (!rawJson) {
      throw new BadRequestException("Menu extraction did not return valid structured data.");
    }

    const parsed = JSON.parse(rawJson) as {
      items?: Array<Record<string, unknown>>;
    };

    const extractedItems = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => ({
            name: String(item.name ?? "").trim(),
            category: String(item.category ?? "").trim(),
            description: String(item.description ?? "").trim(),
            price: String(item.price ?? "").trim(),
            available: true,
            availabilityMode: "AVAILABLE",
            disabledUntil: "",
          }))
          .filter((item) => item.name.length > 0 && item.category.length > 0)
      : [];

    return {
      message: extractedItems.length > 0 ? "Menu extracted successfully. Review the items before saving." : "No menu items were extracted.",
      items: extractedItems,
      source: {
        filename: input.filename,
        mimeType: input.mimeType,
        importedAt: new Date().toISOString(),
      },
    };
  }

  async updateAiSettings(businessId: string, input: BusinessAiSettingsInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const previousRules = readBusinessRules(existing.answeringRules);

    const previousOfficeHours = Array.isArray(existing.officeHours) ? existing.officeHours : [];

    const emergencyMessage =
      input.emergencyMessage.trim() ||
      (resolveMedicalMode(existing) ? "If this is a medical emergency, please call 911." : "");

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        aiEnabled: input.aiEnabled,
        greetingMessage: input.greetingMessage.trim(),
        voicePreference: input.voicePreference.trim(),
        answeringRules: {
          ...previousRules,
          callHandlingMode: input.callHandlingMode,
          primaryMode: input.answerMode,
          ringCount: input.ringCount,
          afterHoursEnabled: input.afterHoursEnabled,
          afterHoursMessage: input.afterHoursMessage.trim(),
          emergencyMessage,
          recordCalls: input.recordCalls,
          sendSummaryEmail: input.sendSummaryEmail,
        },
        officeHours: previousOfficeHours,
      },
    });

    return {
      message: "AI settings updated successfully.",
      business: {
        id: business.id,
        aiEnabled: business.aiEnabled,
        greetingMessage: business.greetingMessage,
        voicePreference: business.voicePreference,
        answeringRules: business.answeringRules,
        medicalModeEnabled: resolveMedicalMode(business),
      },
    };
  }

  async updateKnowledgeBase(businessId: string, input: BusinessKnowledgeBaseInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const previousRules = readBusinessRules(existing.answeringRules);

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        answeringRules: {
          ...previousRules,
          conversationGoal: input.conversationGoal,
          knowledgeBase: {
            faqs: input.faqs,
            objections: input.objections,
            leadCaptureFlow: input.leadCaptureFlow,
            services: input.services,
            differentiators: input.differentiators ?? "",
          },
        },
      },
    });

    return {
      message: "Knowledge base updated successfully.",
      business: {
        id: business.id,
        knowledgeBase: extractKnowledgeBase(business.answeringRules),
        conversationGoal: extractConversationGoal(business.answeringRules),
      },
    };
  }

  async updateAppointments(businessId: string, input: BusinessAppointmentsUpdateInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const previousRules = readBusinessRules(existing.answeringRules);
    const nextAppointments = input.appointments
      .map((appointment) => ({
        id: appointment.id.trim(),
        title: appointment.title.trim(),
        startsAt: appointment.startsAt.trim(),
        durationMinutes: appointment.durationMinutes,
        customerName: appointment.customerName.trim(),
        customerPhone: appointment.customerPhone.trim(),
        customerEmail: appointment.customerEmail.trim(),
        serviceType: appointment.serviceType.trim(),
        status: appointment.status,
        notes: appointment.notes.trim(),
        source: appointment.source,
        accent: appointment.accent,
      }))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        answeringRules: {
          ...previousRules,
          appointments: nextAppointments,
          appointmentsUpdatedAt: new Date().toISOString(),
        },
      },
    });

    return {
      message: "Appointments updated successfully.",
      appointments: extractAppointments(business.answeringRules),
    };
  }

  async updateCalendarIntegration(businessId: string, input: BusinessCalendarIntegrationInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const previousRules = readBusinessRules(existing.answeringRules);
    const nextIntegration = {
      provider: "MICROSOFT_OUTLOOK",
      connected: input.connected,
      connectedEmail: input.connectedEmail.trim(),
      connectedAt: input.connected ? input.connectedAt.trim() || new Date().toISOString() : "",
      syncAppointments: input.syncAppointments,
      respectBusyTimes: input.respectBusyTimes,
      updatedAt: new Date().toISOString(),
    };

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        answeringRules: {
          ...previousRules,
          calendarIntegration: nextIntegration,
        },
      },
    });

    return {
      message: input.connected ? "Calendar integration updated successfully." : "Calendar integration disconnected.",
      calendarIntegration: extractCalendarIntegration(business.answeringRules),
    };
  }

  async updateTelephonySettings(businessId: string, input: BusinessTelephonySettingsInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const previousRules = readBusinessRules(existing.answeringRules);
    const nextTelephonySettings = {
      provider: input.provider,
      connectionMode: input.connectionMode,
      businessNumber: input.businessNumber.trim(),
      twilioAccountSid: input.twilioAccountSid.trim(),
      twilioAuthToken: input.twilioAuthToken.trim(),
      twilioNumber: input.twilioNumber.trim(),
      fallbackNumber: input.fallbackNumber.trim(),
      aiReceptionistEnabled: input.aiReceptionistEnabled,
      routingMode: input.routingMode,
      aiTakeoverDelaySeconds: input.aiTakeoverDelaySeconds,
      afterHoursRouting: input.afterHoursRouting,
      handoffEnabled: input.handoffEnabled,
      voicemailFallbackEnabled: input.voicemailFallbackEnabled,
      recordingEnabled: input.recordingEnabled,
      consentMessage: input.consentMessage.trim(),
      postCallSmsEnabled: input.postCallSmsEnabled,
      preparedAt: new Date().toISOString(),
    };

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        aiEnabled: input.aiReceptionistEnabled,
        answeringRules: {
          ...previousRules,
          callHandlingMode: input.routingMode === "STAFF_ONLY" ? "STAFF_FIRST" : "LIVE_AI",
          primaryMode:
            input.routingMode === "AI_IMMEDIATELY"
              ? "ALL_CALLS"
              : input.afterHoursRouting === "AI"
                ? "AFTER_MISSED_RINGS"
                : "BUSINESS_HOURS",
          ringCount: Math.max(1, Math.round(input.aiTakeoverDelaySeconds / 5) || 1),
          afterHoursEnabled: input.afterHoursRouting === "AI" || input.afterHoursRouting === "MISSED_CALL_CAPTURE",
          recordCalls: input.recordingEnabled,
          telephony: nextTelephonySettings,
        },
      },
    });

    return {
      message: "Telephony preparation settings updated successfully.",
      business: {
        id: business.id,
        telephonySettings: readBusinessRules(business.answeringRules).telephony ?? null,
      },
    };
  }

  async updateBillingSettings(businessId: string, input: BusinessBillingSettingsInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const previousRules = readBusinessRules(existing.answeringRules);
    const previousBilling =
      previousRules.billing && typeof previousRules.billing === "object" && !Array.isArray(previousRules.billing)
        ? (previousRules.billing as Record<string, unknown>)
        : {};

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        selectedPlan: input.planName.trim(),
        billingCycle: input.billingCycle,
        answeringRules: {
          ...previousRules,
          billing: {
            ...previousBilling,
            planName: input.planName.trim(),
            status: input.status,
            includedMinutesPerMonth: input.includedMinutesPerMonth,
            overageRatePerMinute: input.overageRatePerMinute,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });

    return {
      message: "Billing settings updated successfully.",
      business: {
        id: business.id,
        selectedPlan: business.selectedPlan,
        billingCycle: business.billingCycle,
        billingOverview: await this.calculateBillingOverview(business),
      },
    };
  }

  async listPharmacyRefillRequests(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    this.assertPharmacyBusiness(business.category);

    const savedRequests = extractPharmacyRefillRequests(business.answeringRules);

    if (savedRequests.length > 0) {
      return {
        requests: savedRequests,
      };
    }

    const dismissedRequestIds = new Set(extractDismissedPharmacyRefillRequestIds(business.answeringRules));
    const calls = await this.prisma.call.findMany({
      where: { businessId },
      orderBy: {
        startedAt: "desc",
      },
    });

    const derivedRequests = calls
      .map((call) => derivePharmacyRefillRequestFromCall(call))
      .filter((request): request is NonNullable<ReturnType<typeof derivePharmacyRefillRequestFromCall>> => Boolean(request))
      .filter((request) => !dismissedRequestIds.has(request.id));

    const mergedRequests = new Map<string, (typeof savedRequests)[number]>();

    for (const request of derivedRequests) {
      mergedRequests.set(request.id, request);
    }

    for (const request of savedRequests) {
      mergedRequests.set(request.id, request);
    }

    return {
      requests: Array.from(mergedRequests.values()),
    };
  }

  async updatePharmacyRefillRequests(businessId: string, input: PharmacyRefillRequestsUpdateInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    this.assertPharmacyBusiness(existing.category);

    const previousRules = readBusinessRules(existing.answeringRules);
    const previousPharmacy =
      previousRules.pharmacy && typeof previousRules.pharmacy === "object" && !Array.isArray(previousRules.pharmacy)
        ? (previousRules.pharmacy as Record<string, unknown>)
        : {};

    const requests = input.requests.map((request) => ({
      id: request.id.trim(),
      patientName: request.patientName.trim(),
      phoneNumber: request.phoneNumber.trim(),
      medicationName: request.medicationName.trim(),
      prescriptionNumber: request.prescriptionNumber.trim(),
      requestedOn: request.requestedOn.trim(),
      preferredPickupTime: request.preferredPickupTime.trim(),
      notes: request.notes.trim(),
      assignedTo: request.assignedTo.trim(),
      status: request.status,
    }));

    const calls = await this.prisma.call.findMany({
      where: { businessId },
      orderBy: {
        startedAt: "desc",
      },
    });

    const derivedRequestIds = new Set(
      calls
        .map((call) => derivePharmacyRefillRequestFromCall(call))
        .filter((request): request is NonNullable<ReturnType<typeof derivePharmacyRefillRequestFromCall>> => Boolean(request))
        .map((request) => request.id),
    );
    const keptRequestIds = new Set(requests.map((request) => request.id));
    const dismissedRefillRequestIds = Array.from(derivedRequestIds).filter((requestId) => !keptRequestIds.has(requestId));

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        answeringRules: {
          ...previousRules,
          pharmacy: {
            ...previousPharmacy,
            refillRequests: requests,
            dismissedRefillRequestIds,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });

    return {
      message: "Refill requests updated successfully.",
      requests: extractPharmacyRefillRequests(business.answeringRules),
    };
  }

  async listPharmacyCallbackRequests(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    this.assertPharmacyBusiness(business.category);

    const savedRequests = extractPharmacyCallbackRequests(business.answeringRules);

    if (savedRequests.length > 0) {
      return {
        requests: savedRequests,
      };
    }

    const dismissedRequestIds = new Set(extractDismissedPharmacyCallbackRequestIds(business.answeringRules));
    const calls = await this.prisma.call.findMany({
      where: { businessId },
      orderBy: {
        startedAt: "desc",
      },
    });

    const derivedRequests = calls
      .map((call) => derivePharmacyCallbackRequestFromCall(call))
      .filter((request): request is NonNullable<ReturnType<typeof derivePharmacyCallbackRequestFromCall>> => Boolean(request))
      .filter((request) => !dismissedRequestIds.has(request.id));

    const mergedRequests = new Map<string, (typeof savedRequests)[number]>();

    for (const request of derivedRequests) {
      mergedRequests.set(request.id, request);
    }

    for (const request of savedRequests) {
      mergedRequests.set(request.id, request);
    }

    return {
      requests: Array.from(mergedRequests.values()),
    };
  }

  async updatePharmacyCallbackRequests(businessId: string, input: PharmacyCallbackRequestsUpdateInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    this.assertPharmacyBusiness(existing.category);

    const previousRules = readBusinessRules(existing.answeringRules);
    const previousPharmacy =
      previousRules.pharmacy && typeof previousRules.pharmacy === "object" && !Array.isArray(previousRules.pharmacy)
        ? (previousRules.pharmacy as Record<string, unknown>)
        : {};

    const requests = input.requests.map((request) => ({
      id: request.id.trim(),
      patientName: request.patientName.trim(),
      phoneNumber: request.phoneNumber.trim(),
      reason: request.reason.trim(),
      notes: request.notes.trim(),
      requestedOn: request.requestedOn.trim(),
      priority: request.priority,
      assignedTo: request.assignedTo.trim(),
      lastAttemptAt: request.lastAttemptAt.trim(),
      status: request.status,
    }));

    const calls = await this.prisma.call.findMany({
      where: { businessId },
      orderBy: {
        startedAt: "desc",
      },
    });

    const derivedRequestIds = new Set(
      calls
        .map((call) => derivePharmacyCallbackRequestFromCall(call))
        .filter((request): request is NonNullable<ReturnType<typeof derivePharmacyCallbackRequestFromCall>> => Boolean(request))
        .map((request) => request.id),
    );
    const keptRequestIds = new Set(requests.map((request) => request.id));
    const dismissedCallbackRequestIds = Array.from(derivedRequestIds).filter((requestId) => !keptRequestIds.has(requestId));

    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        answeringRules: {
          ...previousRules,
          pharmacy: {
            ...previousPharmacy,
            callbackRequests: requests,
            dismissedCallbackRequestIds,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });

    return {
      message: "Callback requests updated successfully.",
      requests: extractPharmacyCallbackRequests(business.answeringRules),
    };
  }

  async listMembers(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        members: {
          include: {
            user: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    return {
      members: business.members.map((member) => ({
        id: member.id,
        role: member.role,
        createdAt: member.createdAt,
        user: {
          id: member.user.id,
          email: member.user.email,
          fullName: member.user.fullName,
        },
      })),
    };
  }

  async listCalls(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    await this.ensureDemoCalls(business.id, business.name, business.category);

    const calls = await this.prisma.call.findMany({
      where: { businessId },
      orderBy: {
        startedAt: "desc",
      },
    });

    return {
      calls: calls.map((call) => ({
        id: call.id,
        status: call.status,
        direction: call.direction,
        callerName: call.callerName,
        callerNumber: call.callerNumber,
        callerEmail: call.callerEmail,
        summary: call.summary,
        transcript: call.transcript,
        recordingUrl: call.recordingUrl,
        startedAt: call.startedAt,
        endedAt: call.endedAt,
      })),
    };
  }

  async addMember(businessId: string, input: BusinessMemberCreateInput) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException("Business not found.");
    }

    const email = input.email.trim().toLowerCase();
    const role = UserRole[input.role];

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: true,
      },
    });

    if (existingUser?.memberships.some((membership) => membership.businessId === businessId)) {
      throw new BadRequestException("This user is already a member of the business.");
    }

    const createdMember = await this.prisma.$transaction(async (tx) => {
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email,
            fullName: input.fullName.trim(),
            passwordHash: hashPassword(input.password),
            role,
          },
        }));

      const member = await tx.businessMember.create({
        data: {
          businessId,
          userId: user.id,
          role,
        },
        include: {
          user: true,
        },
      });

      if (existingUser && (!existingUser.fullName || existingUser.role !== role)) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: input.fullName.trim(),
            role,
          },
        });
      }

      return member;
    });

    return {
      message: "Team member added successfully.",
      member: {
        id: createdMember.id,
        role: createdMember.role,
        user: {
          id: createdMember.user.id,
          email: createdMember.user.email,
          fullName: createdMember.user.fullName,
        },
      },
    };
  }

  async updateOnboarding(businessId: string, input: BusinessOnboardingInput) {
    const existing = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!existing) {
      throw new NotFoundException("Business not found.");
    }

    const category = normalizeCategory(input.industryType);
    const business = await this.prisma.business.update({
      where: { id: businessId },
      data: {
        name: input.businessName.trim(),
        category,
        phoneNumber: input.phone.trim(),
        timezone: input.timezone.trim(),
        address: input.address.trim(),
        description: input.businessSummary.trim(),
        servicesSummary: input.servicesSummary.trim() || input.businessSummary.trim(),
        priceListSummary: input.priceListSummary.trim() || null,
        officeHours: input.officeHours,
        answeringRules: {
          primaryMode: input.answeringRule.trim(),
        },
        greetingMessage: input.greetingMessage.trim() || null,
        voicePreference: input.voicePreference.trim() || null,
        selectedPlan: input.selectedPlan.trim() || null,
        billingCycle: input.billingCycle.trim() || null,
        onboardingCompleted: true,
        medicalModeEnabled: medicalCategories.has(category),
      },
    });

    return {
      message: "Business onboarding updated successfully.",
      business: {
        id: business.id,
        name: business.name,
        onboardingCompleted: resolveOnboardingCompleted(business),
        medicalModeEnabled: resolveMedicalMode(business),
      },
    };
  }
}
