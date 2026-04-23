import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";


@Controller('analytics')
export class AnalyticsController {
    constructor(private analytics: AnalyticsService) {}

    @Get('brands')
    getAllBrands() {
        return this.analytics.getAllBrands();
    }

    @Get()
    getBrandAnalytics(@Query('brand') brand: string) {
        return this.analytics.getBrandAnalytics(brand);
    }
}