import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { businessMemberCreateSchema } from "./business-members.schemas";
import { BusinessesService } from "./businesses.service";
import {
  businessAiSettingsSchema,
  businessAppointmentsUpdateSchema,
  businessBillingSettingsSchema,
  businessCalendarIntegrationSchema,
  businessKnowledgeBaseSchema,
  businessMenuImportSchema,
  businessMenuUpdateSchema,
  businessOnboardingSchema,
  businessProfileUpdateSchema,
  businessTelephonySettingsSchema,
  pharmacyCallbackRequestsUpdateSchema,
  pharmacyRefillRequestsUpdateSchema,
} from "./businesses.schemas";

@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get("admin/overview")
  async listAdminBusinesses() {
    return this.businessesService.listAdminBusinesses();
  }

  @Get(":businessId")
  async getBusiness(@Param("businessId") businessId: string) {
    return this.businessesService.getBusinessById(businessId);
  }

  @Patch(":businessId/profile")
  async updateProfile(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessProfileUpdateSchema.parse(body);
    return this.businessesService.updateProfile(businessId, input);
  }

  @Patch(":businessId/menu")
  async updateMenu(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessMenuUpdateSchema.parse(body);
    return this.businessesService.updateMenu(businessId, input);
  }

  @Patch(":businessId/menu/import")
  async importMenu(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessMenuImportSchema.parse(body);
    return this.businessesService.importMenu(businessId, input);
  }

  @Get(":businessId/members")
  async listMembers(@Param("businessId") businessId: string) {
    return this.businessesService.listMembers(businessId);
  }

  @Get(":businessId/calls")
  async listCalls(@Param("businessId") businessId: string) {
    return this.businessesService.listCalls(businessId);
  }

  @Patch(":businessId/members")
  async addMember(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessMemberCreateSchema.parse(body);
    return this.businessesService.addMember(businessId, input);
  }

  @Patch(":businessId/onboarding")
  async updateOnboarding(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessOnboardingSchema.parse(body);
    return this.businessesService.updateOnboarding(businessId, input);
  }

  @Patch(":businessId/ai-settings")
  async updateAiSettings(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessAiSettingsSchema.parse(body);
    return this.businessesService.updateAiSettings(businessId, input);
  }

  @Patch(":businessId/knowledge-base")
  async updateKnowledgeBase(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessKnowledgeBaseSchema.parse(body);
    return this.businessesService.updateKnowledgeBase(businessId, input);
  }

  @Patch(":businessId/appointments")
  async updateAppointments(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessAppointmentsUpdateSchema.parse(body);
    return this.businessesService.updateAppointments(businessId, input);
  }

  @Patch(":businessId/calendar-integration")
  async updateCalendarIntegration(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessCalendarIntegrationSchema.parse(body);
    return this.businessesService.updateCalendarIntegration(businessId, input);
  }

  @Patch(":businessId/telephony-settings")
  async updateTelephonySettings(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessTelephonySettingsSchema.parse(body);
    return this.businessesService.updateTelephonySettings(businessId, input);
  }

  @Patch(":businessId/billing-settings")
  async updateBillingSettings(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = businessBillingSettingsSchema.parse(body);
    return this.businessesService.updateBillingSettings(businessId, input);
  }

  @Get(":businessId/pharmacy/refill-requests")
  async listPharmacyRefillRequests(@Param("businessId") businessId: string) {
    return this.businessesService.listPharmacyRefillRequests(businessId);
  }

  @Patch(":businessId/pharmacy/refill-requests")
  async updatePharmacyRefillRequests(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = pharmacyRefillRequestsUpdateSchema.parse(body);
    return this.businessesService.updatePharmacyRefillRequests(businessId, input);
  }

  @Get(":businessId/pharmacy/callback-requests")
  async listPharmacyCallbackRequests(@Param("businessId") businessId: string) {
    return this.businessesService.listPharmacyCallbackRequests(businessId);
  }

  @Patch(":businessId/pharmacy/callback-requests")
  async updatePharmacyCallbackRequests(@Param("businessId") businessId: string, @Body() body: unknown) {
    const input = pharmacyCallbackRequestsUpdateSchema.parse(body);
    return this.businessesService.updatePharmacyCallbackRequests(businessId, input);
  }
}
