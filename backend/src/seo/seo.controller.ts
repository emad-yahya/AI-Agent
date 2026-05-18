import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { SeoService } from './seo.service';
import { CreateSeoScanDto } from './create-seo-scan.dto';
import { CreateSeoSiteDto } from './create-seo-site.dto';

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
  listSites(@Query('brand') brand?: string) {
    return this.seo.listSites(brand);
  }

  @Get('sites/:siteId')
  getSite(@Param('siteId') siteId: string) {
    return this.seo.getSite(siteId);
  }

  @Post('sites/:siteId/scan')
  runSiteScan(@Param('siteId') siteId: string) {
    return this.seo.runSiteScan(siteId);
  }

  @Get('sites/:siteId/scans')
  listSiteScans(@Param('siteId') siteId: string) {
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
