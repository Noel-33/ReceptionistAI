/**
 * DeltaPrompt AI — Business Account Seed Script
 *
 * Creates the DeltaPrompt AI business account inside the Receptionist AI platform
 * with full configuration: profile, AI settings, telephony, and knowledge base.
 *
 * Run from the project root:
 *   npx ts-node --project apps/api/tsconfig.json -r tsconfig-paths/register scripts/seed-deltaprompt.ts
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import * as dotenv from "dotenv";
import * as path from "path";
import { Pool } from "pg";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/receptionist_ai";

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Configuration ─────────────────────────────────────────────────────────────

const DELTAPROMPT_EMAIL    = "admin@deltaprompt.ai";
const DELTAPROMPT_PASSWORD = "DeltaPrompt@2026";  // Change after first login
const DELTAPROMPT_FULLNAME = "DeltaPrompt AI Admin";

const BUSINESS_CONFIG = {
  name:             "DeltaPrompt AI",
  category:         "OTHER" as const,
  email:            "admin@deltaprompt.ai",
  phoneNumber:      "+1 (437) 214-4761",
  address:          "Windsor, Ontario, Canada",
  timezone:         "America/Toronto",
  description:
    "DeltaPrompt AI is a full-service AI solutions agency based in Windsor, Ontario. We solve any business problem using AI — from custom applications and automation pipelines to digital marketing and creative design. Our tagline: Stop Waiting, Start Winning with AI.",
  servicesSummary:
    "AI Call Handling (24/7 AI receptionist), WhatsApp Automation (auto-replies, chat flows, broadcasts), Lead Generation & Ads (Meta and Google), Sales Pipeline Setup (automated lead nurturing), Social Media Management, SEO & Website Optimization, Google & Local SEO, Creative Design & Branding, Custom AI Applications (sales apps, inventory systems, CRM).",
  priceListSummary:
    "Pricing is custom based on your business needs and scope. We offer a free strategy call and demo before any commitment. Contact us at +1 (437) 214-4761 or visit www.deltaprompt.ai.",
  greetingMessage:
    "Thank you for calling DeltaPrompt AI — helping businesses Stop Waiting and Start Winning with AI. How can I help you today?",
  voicePreference:  "American Female - Professional",
  selectedPlan:     "Growth",
  billingCycle:     "Monthly",
  aiEnabled:        true,
  onboardingCompleted: true,
};

const OFFICE_HOURS = [
  "Monday: 9:00 AM – 6:00 PM EST",
  "Tuesday: 9:00 AM – 6:00 PM EST",
  "Wednesday: 9:00 AM – 6:00 PM EST",
  "Thursday: 9:00 AM – 6:00 PM EST",
  "Friday: 9:00 AM – 6:00 PM EST",
  "Saturday: Closed",
  "Sunday: Closed",
];

const ANSWERING_RULES = {
  // AI behaviour
  callHandlingMode:  "LIVE_AI",
  primaryMode:       "ALL_CALLS",
  ringCount:         3,
  afterHoursEnabled: true,
  afterHoursMessage:
    "You've reached DeltaPrompt AI outside our office hours of Monday to Friday, 9 AM to 6 PM Eastern Time. Please leave your name, number, and what you're looking for and our team will reach out on the next business day.",
  emergencyMessage:  "",
  recordCalls:       true,
  sendSummaryEmail:  true,

  // Conversation goal
  conversationGoal: "CAPTURE_LEADS",

  // Telephony
  telephony: {
    provider:               "TWILIO",
    connectionMode:         "DIRECT_TO_AI",
    businessNumber:         "+1 (437) 214-4761",
    twilioAccountSid:       "",
    twilioAuthToken:        "",
    twilioNumber:           "+14372144761",
    fallbackNumber:         "+1 (437) 214-4761",
    aiReceptionistEnabled:  true,
    routingMode:            "AI_IMMEDIATELY",
    aiTakeoverDelaySeconds: 0,
    afterHoursRouting:      "AI",
    handoffEnabled:         true,
    voicemailFallbackEnabled: true,
    recordingEnabled:       true,
    consentMessage:
      "This call may be recorded and transcribed to ensure we understand your needs and follow up accurately.",
    postCallSmsEnabled:     false,
  },

  // Billing
  billing: {
    planName:               "Growth",
    billingCycle:           "Monthly",
    status:                 "ACTIVE",
    includedMinutesPerMonth: 750,
    overageRatePerMinute:   0.30,
  },

  // Knowledge base
  knowledgeBase: {

    // ── Services ─────────────────────────────────────────────────────────────
    services: [
      {
        id: uid(),
        serviceName:    "AI Call Handling",
        description:    "A 24/7 AI receptionist that answers every call, qualifies leads, captures information, and books appointments automatically.",
        whoItsFor:      "Any business that receives phone calls and cannot afford to miss a lead — clinics, salons, restaurants, legal firms, real estate agents.",
        problemItSolves:"Missed calls mean lost revenue. Our AI answers instantly, day or night, so you never lose a lead again.",
        isActive: true,
      },
      {
        id: uid(),
        serviceName:    "WhatsApp Automation",
        description:    "Automated WhatsApp replies, smart chat flows, broadcast messages, and click-to-WhatsApp ad integrations.",
        whoItsFor:      "Businesses that get customer inquiries on WhatsApp and want to respond instantly without manual effort.",
        problemItSolves:"Slow WhatsApp replies lose customers. Our automation replies in seconds, 24/7, and nurtures leads automatically.",
        isActive: true,
      },
      {
        id: uid(),
        serviceName:    "Lead Generation & Ads",
        description:    "High-converting Meta (Facebook & Instagram) and Google ad campaigns designed to bring quality leads to your business.",
        whoItsFor:      "Businesses looking to grow their customer base through targeted digital advertising.",
        problemItSolves:"Generic ads waste budget. We use data and AI to create campaigns that bring in the right leads at the lowest cost.",
        isActive: true,
      },
      {
        id: uid(),
        serviceName:    "Sales Pipeline Setup",
        description:    "Fully automated sales pipelines that capture leads, send follow-ups, and nurture prospects until they are ready to buy.",
        whoItsFor:      "Sales-driven businesses that need a system to manage and convert leads without manual effort.",
        problemItSolves:"Leads fall through the cracks without a system. We build automated pipelines so no opportunity is ever missed.",
        isActive: true,
      },
      {
        id: uid(),
        serviceName:    "Social Media Management",
        description:    "Complete social media management including content creation (Reels, carousels, captions), posting, community management, and monthly analytics.",
        whoItsFor:      "Businesses that want a strong social media presence but do not have time to manage it themselves.",
        problemItSolves:"Inconsistent posting hurts brand trust. We handle everything so your brand stays active and engaging online.",
        isActive: true,
      },
      {
        id: uid(),
        serviceName:    "SEO & Website Optimization",
        description:    "Keyword research, on-page SEO, technical SEO, content writing, backlink building, Google Business Profile setup, and local SEO.",
        whoItsFor:      "Businesses that want to rank higher on Google and attract organic traffic without paid ads.",
        problemItSolves:"If customers cannot find you on Google, you lose to competitors. We make sure your business shows up first.",
        isActive: true,
      },
      {
        id: uid(),
        serviceName:    "Custom AI Applications",
        description:    "Custom-built AI-powered business applications — sales apps, inventory management systems, CRM tools, booking systems, and any workflow automation.",
        whoItsFor:      "Businesses with specific operational problems that off-the-shelf software cannot solve.",
        problemItSolves:"Generic tools create workarounds and inefficiencies. We build exactly what your business needs using AI.",
        isActive: true,
      },
      {
        id: uid(),
        serviceName:    "Creative Design & Branding",
        description:    "Brand identity, social media creatives, promotional posters, marketing collateral, and AI-driven campaign design.",
        whoItsFor:      "Businesses that want to look professional, stand out visually, and communicate clearly to their audience.",
        problemItSolves:"Poor design loses trust. We create on-brand visuals quickly and cost-effectively using AI-powered design tools.",
        isActive: true,
      },
    ],

    // ── Why Choose Us ─────────────────────────────────────────────────────────
    differentiators:
      "We are a full-service AI agency — one partner for everything, from call handling to custom applications to marketing. We build custom solutions, not off-the-shelf plugins. We use our own products — DeltaPrompt AI itself runs on the same Receptionist AI platform we sell. We have a full team: sales specialists, marketing experts, AI engineers, data analysts, and creative designers. We are a local Windsor, Ontario company — accessible, accountable, and reachable. Most clients go live within days, not weeks. We are industry-agnostic — we have served restaurants, bakeries, clinics, salons, law firms, real estate agents, retailers, and more.",

    // ── FAQs ─────────────────────────────────────────────────────────────────
    faqs: [
      {
        id: uid(),
        question: "What does DeltaPrompt AI do?",
        answer:   "DeltaPrompt AI is a full-service AI agency. We help businesses solve their problems using AI — whether that is answering calls 24/7, automating WhatsApp replies, running digital ads, building custom sales or inventory applications, or managing social media. Think of us as your AI-powered growth partner.",
        isActive: true,
      },
      {
        id: uid(),
        question: "What industries do you work with?",
        answer:   "We work with all industries — restaurants, clinics, salons, law firms, real estate agents, pharmacies, retailers, home services, agriculture, manufacturing, finance, and more. If your business has a problem, we can build an AI solution for it.",
        isActive: true,
      },
      {
        id: uid(),
        question: "How long does setup take?",
        answer:   "Most clients are up and running within days, not weeks. After our discovery call, we send a proposal and onboarding form. Once that is completed, we move fast.",
        isActive: true,
      },
      {
        id: uid(),
        question: "How do I get started or book a demo?",
        answer:   "The best next step is a free strategy call with our team. I can take your details right now — name, business name, and the best number to reach you — and our sales team will call you back to set up the demo. Would you like me to do that?",
        isActive: true,
      },
      {
        id: uid(),
        question: "Where are you located?",
        answer:   "We are based in Windsor, Ontario, Canada. We serve clients across Canada and internationally. You can reach us at plus one four three seven two one four four seven six one or visit www.deltaprompt.ai.",
        isActive: true,
      },
      {
        id: uid(),
        question: "What are your business hours?",
        answer:   "Our team is available Monday to Friday, 9 AM to 6 PM Eastern Time. However, I am your AI receptionist and I am available 24 hours a day, 7 days a week to take your information and make sure the team follows up with you.",
        isActive: true,
      },
      {
        id: uid(),
        question: "How much does it cost?",
        answer:   "Our pricing is custom based on your specific needs and the scope of the solution. We do not have a one-size-fits-all package because every business is different. The best way to get an accurate number is to have a quick 15-minute call with our team. Can I take your details so someone can reach out?",
        isActive: true,
      },
      {
        id: uid(),
        question: "Do you only do AI call handling?",
        answer:   "Not at all. AI call handling is one of our services. We also do WhatsApp automation, lead generation and ads, sales pipeline setup, social media management, SEO, custom AI application development, and creative design. We are a full AI solutions agency.",
        isActive: true,
      },
    ],

    // ── Objection Handling ────────────────────────────────────────────────────
    objections: [
      {
        id: uid(),
        objection: "I already have someone doing my marketing",
        response:  "That is great — we actually work alongside existing teams. We handle the AI automation side so your team can focus on higher-value work. Most of our clients already had someone when they came to us. Can I take your details so our team can show you exactly where AI fills the gaps?",
        isActive: true,
      },
      {
        id: uid(),
        objection: "This sounds expensive or AI is too expensive",
        response:  "We completely understand that concern. Our pricing is based on your specific needs, so you only pay for what actually solves your problem. Many of our clients find that the AI pays for itself within the first month through recovered leads and saved staff hours. Can I get your details so our team can give you an accurate quote?",
        isActive: true,
      },
      {
        id: uid(),
        objection: "Will the AI actually understand my business",
        response:  "Absolutely. We do not use a generic AI. We train it specifically on your business — your services, your prices, your hours, your industry, and even how you want to handle different types of callers. You have full control through your portal. Can I take your details so we can show you a live demo?",
        isActive: true,
      },
      {
        id: uid(),
        objection: "We tried something like this before and it did not work",
        response:  "We hear that often and we take it seriously. Most AI tools people have tried are generic plug-and-play bots. We build and configure custom solutions specific to your business. We would love the chance to show you the difference. Can I get your details so our team can reach out and understand what did not work before?",
        isActive: true,
      },
      {
        id: uid(),
        objection: "I need to think about it or I need to talk to my partner",
        response:  "Of course, that makes complete sense for a business decision. What I can do is take your details and have our team send you a summary and demo video so you have something concrete to review together. Would that work for you?",
        isActive: true,
      },
      {
        id: uid(),
        objection: "Is this a real person or AI",
        response:  "I am DeltaPrompt AI's AI receptionist — I am here 24/7 to make sure you never wait to get the information you need or have your call go unanswered. Our human team is available Monday to Friday 9 AM to 6 PM Eastern, and they will follow up with you directly. Can I take your details so they can reach out?",
        isActive: true,
      },
      {
        id: uid(),
        objection: "I am not ready yet or maybe later",
        response:  "No pressure at all. What I can do is take your name and number so our team can reach out at a time that works better for you — even just to answer questions, no commitment needed. Would that be okay?",
        isActive: true,
      },
    ],

    // ── Lead Capture Flow ─────────────────────────────────────────────────────
    leadCaptureFlow: [
      {
        id: uid(),
        question:   "May I start with your full name?",
        fieldName:  "name",
        order:      1,
        isRequired: true,
      },
      {
        id: uid(),
        question:   "What is the name of your business?",
        fieldName:  "businessName",
        order:      2,
        isRequired: true,
      },
      {
        id: uid(),
        question:   "What industry or type of business are you in?",
        fieldName:  "industry",
        order:      3,
        isRequired: true,
      },
      {
        id: uid(),
        question:   "What is the best phone number for our team to reach you on?",
        fieldName:  "phone",
        order:      4,
        isRequired: true,
      },
      {
        id: uid(),
        question:   "What problem are you looking to solve, or which of our services are you interested in?",
        fieldName:  "requirement",
        order:      5,
        isRequired: false,
      },
    ],
  },
};

const DEMO_CALLS = [
  {
    status: "ANSWERED_BY_AI",
    callerName: "Amit Patel",
    callerNumber: "+1 519-555-0184",
    callerEmail: "amit@windsorhvac.example",
    summary:
      "Qualified a local service-business lead interested in 24/7 AI call handling and WhatsApp automation.",
    transcript:
      "AI: Thank you for calling DeltaPrompt AI. How can I help you today?\nCaller: I run a local HVAC company and we miss calls after hours.\nAI: I can help. May I take your name, business name, industry, best phone number, and what problem you want to solve?\nCaller: Amit Patel, Windsor HVAC, home services, 519-555-0184. We need after-hours call capture and appointment requests.\nAI: Perfect. I will send this to the DeltaPrompt AI team so they can follow up with a strategy call.",
    recordingUrl: "https://example.com/recordings/deltaprompt-demo-lead-1",
    startedOffsetMinutes: 34,
    durationMinutes: 6,
  },
  {
    status: "ANSWERED_BY_AI",
    callerName: "Priya Sharma",
    callerNumber: "+1 226-555-0139",
    callerEmail: "priya@salonstudio.example",
    summary:
      "Captured a demo request from a salon owner asking about AI appointment intake and social media support.",
    transcript:
      "AI: Thanks for calling DeltaPrompt AI. Are you looking for AI call handling, automation, marketing, or a custom AI application?\nCaller: I own a salon and want appointments handled when my staff are busy. I also need help with Instagram.\nAI: I can capture that. What is your business name and the best number for the team?\nCaller: Priya Sharma, Glow Salon Studio, 226-555-0139.\nAI: Great. I will have the team reach out with a demo and strategy-call options.",
    recordingUrl: "https://example.com/recordings/deltaprompt-demo-lead-2",
    startedOffsetMinutes: 118,
    durationMinutes: 5,
  },
  {
    status: "ESCALATED",
    callerName: "Daniel Brooks",
    callerNumber: "+1 437-555-0168",
    callerEmail: "daniel@retailops.example",
    summary:
      "After-hours caller asked about a custom inventory and CRM workflow; AI captured details for next-business-day follow-up.",
    transcript:
      "AI: You have reached DeltaPrompt AI outside regular office hours. I can still take your details for the team.\nCaller: We need a custom AI inventory system and maybe a CRM pipeline.\nAI: Absolutely. May I take your name, business name, industry, phone number, and what you want to build?\nCaller: Daniel Brooks, RetailOps North, retail, 437-555-0168. We want inventory alerts and automated lead follow-up.\nAI: I have captured that. The team will follow up on the next business day.",
    recordingUrl: "https://example.com/recordings/deltaprompt-demo-lead-3",
    startedOffsetMinutes: 246,
    durationMinutes: 7,
  },
];

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function preferSavedString(value: unknown, fallback: string) {
  const saved = String(value ?? "").trim();
  return saved || fallback;
}

function preferSavedNumber(value: unknown, fallback: number) {
  const saved = Number(value);
  return Number.isFinite(saved) ? saved : fallback;
}

function preferSavedBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function buildAnsweringRules(previousAnsweringRules: unknown) {
  const previousRules = readRecord(previousAnsweringRules);
  const previousTelephony = readRecord(previousRules.telephony);
  const previousBilling = readRecord(previousRules.billing);

  return {
    ...ANSWERING_RULES,
    telephony: {
      ...ANSWERING_RULES.telephony,
      businessNumber: preferSavedString(previousTelephony.businessNumber, ANSWERING_RULES.telephony.businessNumber),
      twilioAccountSid: preferSavedString(previousTelephony.twilioAccountSid, ANSWERING_RULES.telephony.twilioAccountSid),
      twilioAuthToken: preferSavedString(previousTelephony.twilioAuthToken, ANSWERING_RULES.telephony.twilioAuthToken),
      twilioNumber: preferSavedString(previousTelephony.twilioNumber, ANSWERING_RULES.telephony.twilioNumber),
      fallbackNumber: preferSavedString(previousTelephony.fallbackNumber, ANSWERING_RULES.telephony.fallbackNumber),
      aiReceptionistEnabled: preferSavedBoolean(
        previousTelephony.aiReceptionistEnabled,
        ANSWERING_RULES.telephony.aiReceptionistEnabled,
      ),
      routingMode: preferSavedString(previousTelephony.routingMode, ANSWERING_RULES.telephony.routingMode),
      aiTakeoverDelaySeconds: preferSavedNumber(
        previousTelephony.aiTakeoverDelaySeconds,
        ANSWERING_RULES.telephony.aiTakeoverDelaySeconds,
      ),
      afterHoursRouting: preferSavedString(previousTelephony.afterHoursRouting, ANSWERING_RULES.telephony.afterHoursRouting),
      handoffEnabled: preferSavedBoolean(previousTelephony.handoffEnabled, ANSWERING_RULES.telephony.handoffEnabled),
      voicemailFallbackEnabled: preferSavedBoolean(
        previousTelephony.voicemailFallbackEnabled,
        ANSWERING_RULES.telephony.voicemailFallbackEnabled,
      ),
      recordingEnabled: preferSavedBoolean(previousTelephony.recordingEnabled, ANSWERING_RULES.telephony.recordingEnabled),
      consentMessage: preferSavedString(previousTelephony.consentMessage, ANSWERING_RULES.telephony.consentMessage),
      postCallSmsEnabled: preferSavedBoolean(
        previousTelephony.postCallSmsEnabled,
        ANSWERING_RULES.telephony.postCallSmsEnabled,
      ),
    },
    billing: {
      ...ANSWERING_RULES.billing,
      planName: preferSavedString(previousBilling.planName, ANSWERING_RULES.billing.planName),
      billingCycle: preferSavedString(previousBilling.billingCycle, ANSWERING_RULES.billing.billingCycle),
      status: preferSavedString(previousBilling.status, ANSWERING_RULES.billing.status),
      includedMinutesPerMonth: preferSavedNumber(
        previousBilling.includedMinutesPerMonth,
        ANSWERING_RULES.billing.includedMinutesPerMonth,
      ),
      overageRatePerMinute: preferSavedNumber(
        previousBilling.overageRatePerMinute,
        ANSWERING_RULES.billing.overageRatePerMinute,
      ),
    },
  };
}

async function ensureDeltaPromptDemoCalls(businessId: string) {
  const existingCallCount = await prisma.call.count({
    where: { businessId },
  });

  if (existingCallCount > 0) {
    return false;
  }

  await prisma.call.createMany({
    data: DEMO_CALLS.map((call) => {
      const startedAt = new Date(Date.now() - call.startedOffsetMinutes * 60 * 1000);
      const endedAt = new Date(startedAt.getTime() + call.durationMinutes * 60 * 1000);

      return {
        businessId,
        status: call.status as "ANSWERED_BY_AI" | "ESCALATED",
        callerName: call.callerName,
        callerNumber: call.callerNumber,
        callerEmail: call.callerEmail,
        summary: call.summary,
        transcript: call.transcript,
        recordingUrl: call.recordingUrl,
        startedAt,
        endedAt,
      };
    }),
  });

  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Seeding DeltaPrompt AI business account...\n");

  const existingUser = await prisma.user.findUnique({
    where: { email: DELTAPROMPT_EMAIL },
  });

  const existingBusiness = await prisma.business.findFirst({
    where: {
      OR: [{ email: DELTAPROMPT_EMAIL }, { name: BUSINESS_CONFIG.name }],
    },
  });

  const result = await prisma.$transaction(async (tx) => {
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            fullName:     DELTAPROMPT_FULLNAME,
            passwordHash: hashPassword(DELTAPROMPT_PASSWORD),
            role:         "BUSINESS_OWNER",
          },
        })
      : await tx.user.create({
          data: {
            email:        DELTAPROMPT_EMAIL,
            fullName:     DELTAPROMPT_FULLNAME,
            passwordHash: hashPassword(DELTAPROMPT_PASSWORD),
            role:         "BUSINESS_OWNER",
          },
        });

    const businessData = {
      name:                BUSINESS_CONFIG.name,
      category:            BUSINESS_CONFIG.category,
      email:               BUSINESS_CONFIG.email,
      phoneNumber:         BUSINESS_CONFIG.phoneNumber,
      address:             BUSINESS_CONFIG.address,
      timezone:            BUSINESS_CONFIG.timezone,
      description:         BUSINESS_CONFIG.description,
      servicesSummary:     BUSINESS_CONFIG.servicesSummary,
      priceListSummary:    BUSINESS_CONFIG.priceListSummary,
      greetingMessage:     BUSINESS_CONFIG.greetingMessage,
      voicePreference:     BUSINESS_CONFIG.voicePreference,
      selectedPlan:        BUSINESS_CONFIG.selectedPlan,
      billingCycle:        BUSINESS_CONFIG.billingCycle,
      aiEnabled:           BUSINESS_CONFIG.aiEnabled,
      onboardingCompleted: BUSINESS_CONFIG.onboardingCompleted,
      medicalModeEnabled:  false,
      officeHours:         OFFICE_HOURS,
      answeringRules:      buildAnsweringRules(existingBusiness?.answeringRules),
    };

    const business = existingBusiness
      ? await tx.business.update({
          where: { id: existingBusiness.id },
          data: businessData,
        })
      : await tx.business.create({
          data: {
            ...businessData,
            members: {
              create: {
                userId: user.id,
                role:   "BUSINESS_OWNER",
              },
            },
          },
        });

    if (existingBusiness) {
      await tx.businessMember.upsert({
        where: {
          businessId_userId: {
            businessId: business.id,
            userId: user.id,
          },
        },
        update: {
          role: "BUSINESS_OWNER",
        },
        create: {
          businessId: business.id,
          userId: user.id,
          role: "BUSINESS_OWNER",
        },
      });
    }

    await tx.subscription.upsert({
      where: {
        businessId: business.id,
      },
      update: {
        planName:   "Growth",
        status:     "ACTIVE",
        renewsAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      create: {
        businessId: business.id,
        planName:   "Growth",
        status:     "ACTIVE",
        renewsAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user,
      business,
      createdUser: !existingUser,
      createdBusiness: !existingBusiness,
    };
  });

  const demoCallsCreated = await ensureDeltaPromptDemoCalls(result.business.id);

  console.log(`✅ DeltaPrompt AI account ${result.createdBusiness ? "created" : "updated"} successfully!\n`);
  console.log("─────────────────────────────────────────────");
  console.log(`  Business Name : ${result.business.name}`);
  console.log(`  Business ID   : ${result.business.id}`);
  console.log(`  Login Email   : ${DELTAPROMPT_EMAIL}`);
  console.log(`  Password      : ${DELTAPROMPT_PASSWORD}`);
  console.log(`  Portal URL    : http://localhost:3000/signin`);
  console.log("─────────────────────────────────────────────");
  console.log("\n⚠️  Please change the password after your first login.\n");
  console.log("📋 What's pre-configured:");
  console.log(`   ✓ ${result.createdUser ? "New" : "Existing"} owner user with the requested login credentials`);
  console.log("   ✓ Business profile (name, phone, address, hours, description)");
  console.log("   ✓ AI settings (enabled, voice, greeting, call mode)");
  console.log("   ✓ Conversation goal: CAPTURE_LEADS");
  console.log("   ✓ 8 services with full detail cards");
  console.log("   ✓ Company differentiators");
  console.log("   ✓ 8 FAQs");
  console.log("   ✓ 7 objection handlers");
  console.log("   ✓ 5-step lead capture flow");
  console.log("   ✓ After-hours message");
  console.log("   ✓ Billing: Growth plan, Active\n");
  console.log(`   ${demoCallsCreated ? "✓" : "•"} DeltaPrompt demo call logs ${demoCallsCreated ? "created" : "already existed, left untouched"}\n`);
  console.log("🔧 Still needed:");
  console.log("   • Add or confirm Twilio credentials in Telephony settings");
  console.log("   • Add your own Twilio phone number if you are testing with a new Twilio account");
  console.log("   • Review and adjust knowledge base content in the portal");
  console.log("   • Set up Resend email for call summaries\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
