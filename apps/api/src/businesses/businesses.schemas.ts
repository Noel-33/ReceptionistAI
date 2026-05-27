import { z } from "zod";

export const businessOnboardingSchema = z.object({
  businessName: z.string().min(2),
  industryType: z.string().min(2),
  phone: z.string().min(7),
  timezone: z.string().min(3),
  address: z.string().min(4),
  businessSummary: z.string().min(10),
  servicesSummary: z.string().optional().default(""),
  priceListSummary: z.string().optional().default(""),
  officeHours: z.array(z.string()).default([]),
  answeringRule: z.string().optional().default("Answer all calls"),
  greetingMessage: z.string().optional().default(""),
  voicePreference: z.string().optional().default("Professional female"),
  selectedPlan: z.string().optional().default("Free Trial"),
  billingCycle: z.string().optional().default("Monthly"),
});

export type BusinessOnboardingInput = z.infer<typeof businessOnboardingSchema>;

export const businessAiSettingsSchema = z.object({
  aiEnabled: z.boolean().default(false),
  callHandlingMode: z.enum(["LIVE_AI", "MESSAGE_CAPTURE", "HYBRID", "STAFF_FIRST"]).default("LIVE_AI"),
  answerMode: z.enum(["ALL_CALLS", "BUSINESS_HOURS", "AFTER_MISSED_RINGS"]).default("ALL_CALLS"),
  ringCount: z.coerce.number().int().min(1).max(8).default(3),
  greetingMessage: z.string().min(6).max(500),
  voicePreference: z.string().min(2).max(120),
  afterHoursEnabled: z.boolean().default(true),
  afterHoursMessage: z.string().min(6).max(500),
  emergencyMessage: z.string().max(500).optional().default(""),
  recordCalls: z.boolean().default(true),
  sendSummaryEmail: z.boolean().default(true),
});

export type BusinessAiSettingsInput = z.infer<typeof businessAiSettingsSchema>;

export const businessTelephonySettingsSchema = z.object({
  provider: z.enum(["TWILIO"]).default("TWILIO"),
  connectionMode: z.enum(["DIRECT_TO_AI", "AI_AFTER_MISSED_RINGS", "BUSINESS_HOURS_ONLY"]).default("DIRECT_TO_AI"),
  businessNumber: z.string().max(40).optional().default(""),
  twilioAccountSid: z.string().max(64).optional().default(""),
  twilioAuthToken: z.string().max(128).optional().default(""),
  twilioNumber: z.string().max(40).optional().default(""),
  fallbackNumber: z.string().max(40).optional().default(""),
  aiReceptionistEnabled: z.boolean().default(true),
  routingMode: z.enum(["AI_IMMEDIATELY", "STAFF_FIRST_THEN_AI", "STAFF_ONLY"]).default("AI_IMMEDIATELY"),
  aiTakeoverDelaySeconds: z.coerce.number().int().min(0).max(120).default(15),
  afterHoursRouting: z.enum(["AI", "VOICEMAIL", "MISSED_CALL_CAPTURE"]).default("AI"),
  handoffEnabled: z.boolean().default(true),
  voicemailFallbackEnabled: z.boolean().default(true),
  recordingEnabled: z.boolean().default(true),
  consentMessage: z.string().min(6).max(500),
  postCallSmsEnabled: z.boolean().default(false),
});

export type BusinessTelephonySettingsInput = z.infer<typeof businessTelephonySettingsSchema>;

export const businessBillingSettingsSchema = z.object({
  planName: z.string().min(2).max(80),
  billingCycle: z.enum(["Monthly", "Yearly"]).default("Monthly"),
  status: z.enum(["TRIAL", "ACTIVE", "PAUSED", "PAST_DUE", "CANCELED"]).default("TRIAL"),
  includedMinutesPerMonth: z.coerce.number().int().min(0).max(100000).default(100),
  overageRatePerMinute: z.coerce.number().min(0).max(1000).default(0.5),
});

export type BusinessBillingSettingsInput = z.infer<typeof businessBillingSettingsSchema>;

export const businessProfileUpdateSchema = z.object({
  businessName: z.string().min(2),
  phoneNumber: z.string().min(7),
  timezone: z.string().min(3),
  address: z.string().min(4),
  description: z.string().optional().default(""),
  servicesSummary: z.string().optional().default(""),
  priceListSummary: z.string().optional().default(""),
  officeHours: z.array(z.string()).default([]),
});

export type BusinessProfileUpdateInput = z.infer<typeof businessProfileUpdateSchema>;

export const businessMenuItemSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional().default(""),
  price: z.string().optional().default(""),
  available: z.boolean().default(true),
  availabilityMode: z.enum(["AVAILABLE", "DISABLED_TODAY", "DISABLED_UNTIL"]).default("AVAILABLE"),
  disabledUntil: z.string().optional().default(""),
});

export const businessMenuUpdateSchema = z.object({
  items: z.array(businessMenuItemSchema).default([]),
  source: z
    .object({
      filename: z.string().optional().default(""),
      mimeType: z.string().optional().default(""),
      importedAt: z.string().optional().default(""),
    })
    .optional(),
});

export type BusinessMenuUpdateInput = z.infer<typeof businessMenuUpdateSchema>;

export const businessMenuImportSchema = z.object({
  filename: z.string().min(3),
  mimeType: z.string().min(3),
  contentBase64: z.string().min(20),
});

export type BusinessMenuImportInput = z.infer<typeof businessMenuImportSchema>;

export const pharmacyRefillRequestSchema = z.object({
  id: z.string().min(2),
  patientName: z.string().min(2),
  phoneNumber: z.string().min(7),
  medicationName: z.string().min(2),
  prescriptionNumber: z.string().optional().default(""),
  requestedOn: z.string().min(4),
  preferredPickupTime: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  assignedTo: z.string().optional().default(""),
  status: z
    .enum(["NEW", "UNDER_REVIEW", "APPROVED", "READY_FOR_PICKUP", "COMPLETED", "REJECTED", "NEED_CALLBACK"])
    .default("NEW"),
});

export const pharmacyRefillRequestsUpdateSchema = z.object({
  requests: z.array(pharmacyRefillRequestSchema).default([]),
});

export type PharmacyRefillRequestsUpdateInput = z.infer<typeof pharmacyRefillRequestsUpdateSchema>;

export const pharmacyCallbackRequestSchema = z.object({
  id: z.string().min(2),
  patientName: z.string().min(2),
  phoneNumber: z.string().min(7),
  reason: z.string().min(4),
  notes: z.string().optional().default(""),
  requestedOn: z.string().min(4),
  priority: z.enum(["NORMAL", "URGENT"]).default("NORMAL"),
  assignedTo: z.string().optional().default(""),
  lastAttemptAt: z.string().optional().default(""),
  status: z.enum(["NEW", "ASSIGNED", "PENDING_CALLBACK", "CALLED", "COMPLETED", "UNABLE_TO_REACH"]).default("NEW"),
});

export const pharmacyCallbackRequestsUpdateSchema = z.object({
  requests: z.array(pharmacyCallbackRequestSchema).default([]),
});

export type PharmacyCallbackRequestsUpdateInput = z.infer<typeof pharmacyCallbackRequestsUpdateSchema>;

// ─── Knowledge Base schemas ───────────────────────────────────────────────────

export const kbFaqSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(2),
  answer: z.string().min(2),
  isActive: z.boolean().default(true),
});

export const kbObjectionSchema = z.object({
  id: z.string().min(1),
  objection: z.string().min(2),
  response: z.string().min(2),
  isActive: z.boolean().default(true),
});

export const leadCaptureFieldNameEnum = z.enum(["name", "phone", "businessName", "industry", "requirement"]);

export const kbLeadCaptureQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(2),
  fieldName: leadCaptureFieldNameEnum,
  order: z.coerce.number().int().min(1),
  isRequired: z.boolean().default(true),
});

export const kbServiceSchema = z.object({
  id: z.string().min(1),
  serviceName: z.string().min(2),
  description: z.string().optional().default(""),
  whoItsFor: z.string().optional().default(""),
  problemItSolves: z.string().optional().default(""),
  isActive: z.boolean().default(true),
});

export const conversationGoalEnum = z.enum(["TAKE_MESSAGES", "TAKE_ORDERS", "BOOK_APPOINTMENTS", "CAPTURE_LEADS"]);

export const businessKnowledgeBaseSchema = z.object({
  faqs: z.array(kbFaqSchema).default([]),
  objections: z.array(kbObjectionSchema).default([]),
  leadCaptureFlow: z.array(kbLeadCaptureQuestionSchema).default([]),
  services: z.array(kbServiceSchema).default([]),
  differentiators: z.string().max(2000).optional().default(""),
  conversationGoal: conversationGoalEnum.default("TAKE_MESSAGES"),
});

export type BusinessKnowledgeBaseInput = z.infer<typeof businessKnowledgeBaseSchema>;

// ─── Appointment and calendar schemas ────────────────────────────────────────

export const appointmentStatusEnum = z.enum(["CONFIRMED", "PENDING", "COMPLETED", "CANCELED"]);
export const appointmentSourceEnum = z.enum(["AI_BOOKED", "MANUAL", "MICROSOFT_SYNC"]);
export const appointmentAccentEnum = z.enum(["blue", "green", "red"]);

export const businessAppointmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(160),
  startsAt: z.string().min(4),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
  customerName: z.string().max(120).optional().default(""),
  customerPhone: z.string().max(40).optional().default(""),
  customerEmail: z.string().max(160).optional().default(""),
  serviceType: z.string().max(120).optional().default(""),
  status: appointmentStatusEnum.default("CONFIRMED"),
  notes: z.string().max(1200).optional().default(""),
  source: appointmentSourceEnum.default("MANUAL"),
  accent: appointmentAccentEnum.default("blue"),
});

export const businessAppointmentsUpdateSchema = z.object({
  appointments: z.array(businessAppointmentSchema).default([]),
});

export type BusinessAppointmentsUpdateInput = z.infer<typeof businessAppointmentsUpdateSchema>;

export const businessCalendarIntegrationSchema = z.object({
  provider: z.enum(["MICROSOFT_OUTLOOK"]).default("MICROSOFT_OUTLOOK"),
  connected: z.boolean().default(false),
  connectedEmail: z.string().max(160).optional().default(""),
  connectedAt: z.string().optional().default(""),
  syncAppointments: z.boolean().default(true),
  respectBusyTimes: z.boolean().default(true),
});

export type BusinessCalendarIntegrationInput = z.infer<typeof businessCalendarIntegrationSchema>;
