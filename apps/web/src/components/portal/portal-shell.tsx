"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { clearSession } from "../../lib/session";
import { PortalData } from "./use-portal-data";

type PortalShellProps = {
  active:
    | "dashboard"
    | "profile"
    | "menu"
    | "refills"
    | "callbacks"
    | "settings"
    | "knowledge-base"
    | "appointments"
    | "calendar-sync"
    | "telephony"
    | "calls"
    | "team"
    | "billing";
  title: string;
  subtitle: string;
  portal: PortalData;
  children: ReactNode;
};

export function PortalShell({ active, title, subtitle, portal, children }: PortalShellProps) {
  const businessId = portal.business?.id ?? portal.session?.business?.id ?? "";
  const roleLabel = portal.role.replaceAll("_", " ");
  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "D", href: `/portal/dashboard?businessId=${businessId}`, visible: true },
    { key: "profile", label: "Business Profile", icon: "P", href: `/portal/profile?businessId=${businessId}`, visible: true },
    {
      key: "menu",
      label: "Menu",
      icon: "M",
      href: `/portal/menu?businessId=${businessId}`,
      visible: portal.canManageMenu,
    },
    {
      key: "refills",
      label: "Refill Requests",
      icon: "RX",
      href: `/portal/refill-requests?businessId=${businessId}`,
      visible: portal.canViewPharmacyWorkflows,
    },
    {
      key: "callbacks",
      label: "Callback Requests",
      icon: "CB",
      href: `/portal/callback-requests?businessId=${businessId}`,
      visible: portal.canViewPharmacyWorkflows,
    },
    {
      key: "settings",
      label: "AI Settings",
      icon: "AI",
      href: `/portal/ai-settings?businessId=${businessId}`,
      visible: portal.canEditConfiguration,
    },
    {
      key: "knowledge-base",
      label: "Knowledge Base",
      icon: "KB",
      href: `/portal/knowledge-base?businessId=${businessId}`,
      visible: portal.canEditConfiguration,
    },
    {
      key: "appointments",
      label: "Appointments",
      icon: "AP",
      href: `/portal/appointments?businessId=${businessId}`,
      visible: portal.canViewCallLogs,
    },
    {
      key: "calendar-sync",
      label: "Calendar Sync",
      icon: "MS",
      href: `/portal/calendar-sync?businessId=${businessId}`,
      visible: portal.canEditConfiguration,
    },
    {
      key: "calls",
      label: "Call Logs",
      icon: "C",
      href: `/portal/call-logs?businessId=${businessId}`,
      visible: portal.canViewCallLogs,
    },
    {
      key: "telephony",
      label: "Telephony",
      icon: "PH",
      href: `/portal/telephony?businessId=${businessId}`,
      visible: portal.canManageTelephony,
    },
    { key: "team", label: "Team", icon: "T", href: `/portal/team?businessId=${businessId}`, visible: portal.canManageTeam },
    { key: "billing", label: "Billing", icon: "$", href: `/portal/billing?businessId=${businessId}`, visible: portal.canViewBilling },
  ];

  return (
    <main className="app-shell">
      <section className="portal-layout container">
        <aside className="portal-sidebar">
          <div className="portal-brand">
            <span className="brand-seal">RA</span>
            <div className="portal-brand-copy">
              <strong>{portal.business?.name || portal.session?.business?.name || portal.session?.admin?.email || "Receptionist AI"}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>

          <nav className="portal-nav">
            {navItems
              .filter((item) => item.visible)
              .map((item) => (
                <Link
                  key={item.key}
                  className={`portal-nav-item${item.key === active ? " active" : ""}`}
                  href={item.href}
                >
                  <span className="portal-nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
          </nav>

          <div className="portal-side-card">
            <span className="eyebrow">Workspace</span>
            <strong>{portal.session?.email || "-"}</strong>
            <p>{portal.business?.category || "Business"} workspace</p>
          </div>

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
        </aside>

        <section className="portal-main">
          <div className="portal-topbar">
            <div className="portal-topbar-copy">
              <span className="eyebrow">Business portal</span>
              <div className="portal-meta-row">
                <span>{portal.business?.name || portal.session?.business?.name || portal.session?.admin?.email || "Receptionist AI"}</span>
                <span>{roleLabel}</span>
              </div>
              <h1 className="portal-title">{title}</h1>
              <p className="lead portal-subtitle">{subtitle}</p>
            </div>
            <div className="portal-topbar-actions">
              {portal.canEditConfiguration ? (
                <Link className="button-secondary" href={`/onboarding?businessId=${businessId}`}>
                  Edit onboarding
                </Link>
              ) : null}
            </div>
          </div>
          {children}
        </section>
      </section>
    </main>
  );
}
