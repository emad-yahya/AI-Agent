import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BrandPresenceService } from './brand-presence.service';
import { CreateBrandPresenceDto } from './dto';

@Controller('brand-presence')
export class BrandPresenceController {
  constructor(private service: BrandPresenceService) {}

  @Post('check')
  create(@Body() dto: CreateBrandPresenceDto) {
    return this.service.createReport(dto);
  }

  @Get()
  list(@Query('brand') brand: string) {
    if (!brand || brand.trim().length < 2) {
      throw new BadRequestException('brand query param required (min 2 chars)');
    }
    return this.service.listReports(brand);
  }

  @Get(':brandId/:reportId')
  get(
    @Param('brandId') brandId: string,
    @Param('reportId') reportId: string,
  ) {
    return this.service.getReport(brandId, reportId);
  }
}
