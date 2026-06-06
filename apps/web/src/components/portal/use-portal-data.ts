"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../lib/api";
import { AuthSession, getSession } from "../../lib/session";

type BusinessData = {
  business: {
    id: string;
    name: string;
    category: string;
    email?: string | null;
    phoneNumber?: string | null;
    address?: string | null;
    description?: string | null;
    servicesSummary?: string | null;
    priceListSummary?: string | null;
    greetingMessage?: string | null;
    voicePreference?: string | null;
    selectedPlan?: string | null;
    billingCycle?: string | null;
    billingOverview?: {
      planName: string;
      billingCycle: string;
      status: string;
      cycleStart: string;
      cycleEnd: string;
      includedMinutes: number;
      usedMinutes: number;
      remainingMinutes: number;
      overageMinutes: number;
      overageRatePerMinute: number;
      estimatedOverageCharge: number;
    };
    onboardingCompleted: boolean;
    medicalModeEnabled: boolean;
    aiEnabled: boolean;
    timezone: string;
    officeHours?: unknown;
    answeringRules?: unknown;
    telephonySettings?: unknown;
    menuItems?: Array<{
      name: string;
      category: string;
      description?: string;
      price?: string;
      available?: boolean;
      availabilityMode?: "AVAILABLE" | "DISABLED_TODAY" | "DISABLED_UNTIL";
      disabledUntil?: string;
    }>;
    menuSource?: {
      filename?: string;
      mimeType?: string;
      importedAt?: string;
    } | null;
    pharmacyRefillRequests?: Array<{
      id: string;
      patientName: string;
      phoneNumber: string;
      medicationName: string;
      prescriptionNumber?: string;
      requestedOn: string;
      preferredPickupTime?: string;
      notes?: string;
      assignedTo?: string;
      status: string;
    }>;
    pharmacyCallbackRequests?: Array<{
      id: string;
      patientName: string;
      phoneNumber: string;
      reason: string;
      notes?: string;
      requestedOn: string;
      priority: string;
      assignedTo?: string;
      lastAttemptAt?: string;
      status: string;
    }>;
    knowledgeBase?: {
      faqs: Array<{ id: string; question: string; answer: string; isActive: boolean }>;
      objections: Array<{ id: string; objection: string; response: string; isActive: boolean }>;
      leadCaptureFlow: Array<{ id: string; question: string; fieldName: string; order: number; isRequired: boolean }>;
      services: Array<{ id: string; serviceName: string; description: string; whoItsFor: string; problemItSolves: string; isActive: boolean }>;
      differentiators: string;
    };
    conversationGoal?: string;
    appointments?: Array<{
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
    }>;
    appointmentsConfigured?: boolean;
    calendarIntegration?: {
      provider: "GOOGLE_CALENDAR";
      connected: boolean;
      connectedEmail: string;
      connectedAt: string;
      syncAppointments: boolean;
      respectBusyTimes: boolean;
    };
  };
};

type MembersResponse = {
  members: Array<{
    id: string;
    role: string;
    createdAt: string;
    user: {
      id: string;
      email: string;
      fullName?: string | null;
    };
  }>;
};

const FOOD_BUSINESS_CATEGORIES = new Set([
  "RESTAURANT",
  "BAKERY",
  "CAFE",
  "CATERING",
  "DESSERT_SHOP",
  "FOOD_TRUCK",
]);

const PHARMACY_BUSINESS_CATEGORIES = new Set(["PHARMACY"]);

export function isFoodBusinessCategory(category?: string | null) {
  return FOOD_BUSINESS_CATEGORIES.has(String(category ?? "").trim().toUpperCase());
}

export function isPharmacyBusinessCategory(category?: string | null) {
  return PHARMACY_BUSINESS_CATEGORIES.has(String(category ?? "").trim().toUpperCase());
}

export type PortalData = {
  session: AuthSession | null;
  business: BusinessData["business"] | null;
  members: MembersResponse["members"];
  loading: boolean;
  error: string;
  role: string;
  canManageTeam: boolean;
  canViewBilling: boolean;
  canViewCallLogs: boolean;
  canManageTelephony: boolean;
  canEditConfiguration: boolean;
  canManageMenu: boolean;
  canViewPharmacyWorkflows: boolean;
  canManagePharmacyWorkflows: boolean;
  isPharmacyBusiness: boolean;
  refreshBusiness: () => Promise<void>;
  refreshMembers: () => Promise<void>;
};

export function usePortalData(businessId = ""): PortalData {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [business, setBusiness] = useState<BusinessData["business"] | null>(null);
  const [members, setMembers] = useState<MembersResponse["members"]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const activeRole = session?.business?.role ?? "STAFF";

  async function refreshBusiness() {
    const activeBusinessId = businessId || getSession()?.business?.id;
    if (!activeBusinessId) return;
    const businessResponse = await apiRequest<BusinessData>(`/api/businesses/${activeBusinessId}`);
    setBusiness(businessResponse.business);
  }

  async function refreshMembers() {
    const activeBusinessId = businessId || getSession()?.business?.id;
    if (!activeBusinessId) return;
    const membersResponse = await apiRequest<MembersResponse>(`/api/businesses/${activeBusinessId}/members`);
    setMembers(membersResponse.members);
  }

  useEffect(() => {
    const activeSession = getSession();
    setSession(activeSession);

    const activeBusinessId = businessId || activeSession?.business?.id;
    if (!activeBusinessId) {
      setError("No business session found. Please sign in first.");
      setLoading(false);
      return;
    }

    Promise.all([
      apiRequest<BusinessData>(`/api/businesses/${activeBusinessId}`),
      apiRequest<MembersResponse>(`/api/businesses/${activeBusinessId}/members`),
    ])
      .then(([businessResponse, membersResponse]) => {
        setBusiness(businessResponse.business);
        setMembers(membersResponse.members);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "Unable to load portal data.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [businessId]);

  return useMemo(
    () => ({
      session,
      business,
      members,
      loading,
      error,
      role: activeRole,
      canManageTeam: activeRole === "BUSINESS_OWNER",
      canViewBilling: activeRole === "BUSINESS_OWNER" || activeRole === "BILLING_ADMIN",
      canViewCallLogs: activeRole === "BUSINESS_OWNER" || activeRole === "MANAGER" || activeRole === "STAFF",
      canManageTelephony: activeRole === "BUSINESS_OWNER" || activeRole === "MANAGER",
      canEditConfiguration: activeRole === "BUSINESS_OWNER" || activeRole === "MANAGER",
      canManageMenu: (activeRole === "BUSINESS_OWNER" || activeRole === "MANAGER") && isFoodBusinessCategory(business?.category),
      canViewPharmacyWorkflows:
        (activeRole === "BUSINESS_OWNER" || activeRole === "MANAGER" || activeRole === "STAFF") &&
        isPharmacyBusinessCategory(business?.category),
      canManagePharmacyWorkflows:
        (activeRole === "BUSINESS_OWNER" || activeRole === "MANAGER" || activeRole === "STAFF") &&
        isPharmacyBusinessCategory(business?.category),
      isPharmacyBusiness: isPharmacyBusinessCategory(business?.category),
      refreshBusiness,
      refreshMembers,
    }),
    [session, business, members, loading, error, activeRole],
  );
}
