import { Body, Controller, Get, Post, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { CalendarService } from "./calendar.service";

@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("google/connect")
  async connectGoogle(@Query("businessId") businessId = "", @Query("returnTo") returnTo = "portal", @Res() response: Response) {
    const url = await this.calendarService.buildGoogleConnectUrl(businessId, returnTo === "admin" ? "admin" : "portal");
    return response.redirect(url);
  }

  @Get("google/health")
  async getGoogleHealth(@Query("businessId") businessId = "") {
    return this.calendarService.getGoogleHealth(businessId);
  }

  @Post("google/sync")
  async syncGoogleCalendar(@Body() body: { businessId?: string }) {
    return this.calendarService.syncGoogleCalendar(String(body?.businessId ?? ""));
  }

  @Get("google/callback")
  async handleGoogleCallback(
    @Query("code") code = "",
    @Query("state") state = "",
    @Query("error") error = "",
    @Res() response: Response,
  ) {
    const appUrl = process.env.APP_URL || "http://localhost:3000";

    if (error) {
      return response.redirect(`${appUrl}/portal/calendar-sync?calendar=error`);
    }

    try {
      const result = await this.calendarService.handleGoogleCallback(code, state);
      const redirectPath =
        result.returnTo === "admin"
          ? `/admin?businessId=${encodeURIComponent(result.businessId)}&calendar=connected`
          : `/portal/calendar-sync?businessId=${encodeURIComponent(result.businessId)}&calendar=connected`;
      return response.redirect(`${appUrl}${redirectPath}`);
    } catch {
      return response.redirect(`${appUrl}/portal/calendar-sync?calendar=error`);
    }
  }
}
