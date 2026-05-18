import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CompetitorAuditService } from './competitor-audit.service';
import { CreateCompetitorAuditDto } from './dto';

@Controller('competitor-audit')
export class CompetitorAuditController {
  constructor(private service: CompetitorAuditService) {}

  @Post('scan')
  create(@Body() dto: CreateCompetitorAuditDto) {
    return this.service.createScan(dto);
  }

  @Get()
  list(@Query('brand') brand: string) {
    if (!brand || brand.trim().length < 2) {
      throw new BadRequestException('brand query param required (min 2 chars)');
    }
    return this.service.listScans(brand);
  }

  @Get(':brandId/:scanId')
  get(
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
  ) {
    return this.service.getScan(brandId, scanId);
  }
}
