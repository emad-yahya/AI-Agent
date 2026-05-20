import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ContentGapService } from './content-gap.service';
import { ContentBriefDto, CreateContentGapDto, PaaDto } from './dto';

@Controller('content-gap')
export class ContentGapController {
  constructor(private readonly service: ContentGapService) {}

  @Post('scan')
  scan(@Body() dto: CreateContentGapDto) {
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

  @Post('paa')
  paa(@Body() dto: PaaDto) {
    return this.service.fetchPaa(dto);
  }

  @Post('brief')
  brief(@Body() dto: ContentBriefDto) {
    return this.service.generateBrief(dto);
  }
}
