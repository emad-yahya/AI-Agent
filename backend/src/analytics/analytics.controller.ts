import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('brands')
  getAllBrands() {
    return this.analytics.getAllBrands();
  }

  @Get('competitors')
  getCompetitorTrends(@Query('brands') brands: string) {
    const names = (brands ?? '')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    return this.analytics.getCompetitorTrends(names);
  }

  @Get('coverage')
  getPromptCoverage(@Query('brand') brand: string) {
    return this.analytics.getPromptCoverage(brand);
  }

  @Get()
  getBrandAnalytics(@Query('brand') brand: string) {
    return this.analytics.getBrandAnalytics(brand);
  }
}
