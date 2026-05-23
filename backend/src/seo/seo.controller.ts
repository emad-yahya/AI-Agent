import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SeoService } from './seo.service';
import { CreateSeoScanDto } from './create-seo-scan.dto';
import { CreateSeoSiteDto } from './create-seo-site.dto';
import { AuthRequest } from '../auth/auth.guard';
import {
  getDemoSeoSites,
  getDemoSeoSite,
  getDemoSeoSiteScans,
} from '../analytics/demo-analytics-fixtures';

function isDemo(req: Request): boolean {
  return (req as AuthRequest).user?.role === 'demo';
}

@Controller('seo')
export class SeoController {
  constructor(private seo: SeoService) {}

  // ── Legacy: per-brand keyword scan ──
  @Post('scans')
  createScan(@Body() dto: CreateSeoScanDto) {
    return this.seo.createScan(dto.brand, dto.keywords);
  }

  @Get('scans')
  listScans(@Query('brand') brand: string) {
    return this.seo.listScans(brand);
  }

  @Get('scans/:brandId/:scanId')
  getScan(@Param('brandId') brandId: string, @Param('scanId') scanId: string) {
    return this.seo.getScan(brandId, scanId);
  }

  // ── Semrush-style: Site management ──
  @Post('sites')
  createSite(@Body() dto: CreateSeoSiteDto) {
    return this.seo.createSite({
      brand: dto.brand,
      domain: dto.domain,
      country: dto.country,
      language: dto.language,
    });
  }

  @Get('sites')
  listSites(@Req() req: Request, @Query('brand') brand?: string) {
    if (isDemo(req)) return getDemoSeoSites(brand);
    return this.seo.listSites(brand);
  }

  @Get('sites/:siteId')
  getSite(@Req() req: Request, @Param('siteId') siteId: string) {
    if (isDemo(req)) return getDemoSeoSite(siteId);
    return this.seo.getSite(siteId);
  }

  @Post('sites/:siteId/scan')
  runSiteScan(@Param('siteId') siteId: string) {
    return this.seo.runSiteScan(siteId);
  }

  @Get('sites/:siteId/scans')
  listSiteScans(@Req() req: Request, @Param('siteId') siteId: string) {
    if (isDemo(req)) return getDemoSeoSiteScans(siteId);
    return this.seo.listSiteScans(siteId);
  }

  @Get('sites/:siteId/scans/:scanId')
  getSiteScan(
    @Param('siteId') siteId: string,
    @Param('scanId') scanId: string,
  ) {
    return this.seo.getSiteScan(siteId, scanId);
  }

  @Get('compare')
  compare(@Query('siteIds') siteIds: string) {
    const ids = (siteIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.seo.compareSites(ids);
  }
}
