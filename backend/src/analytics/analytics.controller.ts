import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { AuthRequest } from '../auth/auth.guard';
import {
  getDemoAnalytics,
  getDemoBrandsList,
  getDemoCompetitorTrends,
  getDemoPromptCoverage,
} from './demo-analytics-fixtures';

function isDemo(req: Request): boolean {
  return (req as AuthRequest).user?.role === 'demo';
}

@Controller('analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('brands')
  getAllBrands(@Req() req: Request) {
    if (isDemo(req)) return getDemoBrandsList();
    return this.analytics.getAllBrands();
  }

  @Get('competitors')
  getCompetitorTrends(@Req() req: Request, @Query('brands') brands: string) {
    const names = (brands ?? '')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    if (isDemo(req)) return getDemoCompetitorTrends(names);
    return this.analytics.getCompetitorTrends(names);
  }

  @Get('coverage')
  getPromptCoverage(@Req() req: Request, @Query('brand') brand: string) {
    if (isDemo(req)) return getDemoPromptCoverage(brand);
    return this.analytics.getPromptCoverage(brand);
  }

  @Get()
  getBrandAnalytics(@Req() req: Request, @Query('brand') brand: string) {
    if (isDemo(req)) return getDemoAnalytics(brand);
    return this.analytics.getBrandAnalytics(brand);
  }
}
