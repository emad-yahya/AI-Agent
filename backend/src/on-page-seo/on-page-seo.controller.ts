import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OnPageSeoService } from './on-page-seo.service';
import { CreateOnPageSeoScanDto } from './dto';

@Controller('on-page-seo')
export class OnPageSeoController {
  constructor(private readonly service: OnPageSeoService) {}

  @Post('scan')
  scan(@Body() dto: CreateOnPageSeoScanDto) {
    return this.service.createScan(dto);
  }

  @Get(':brandId/:reportId')
  get(
    @Param('brandId') brandId: string,
    @Param('reportId') reportId: string,
  ) {
    return this.service.getReport(brandId, reportId);
  }

  @Get()
  list(@Query('brand') brand: string) {
    return this.service.listReports(brand);
  }
}
