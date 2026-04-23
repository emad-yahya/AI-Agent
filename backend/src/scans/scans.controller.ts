import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ScansService } from './scans.service';
import { CreateScanDto } from './dto';

@Controller('scans')
export class ScanController {
  constructor(private scans: ScansService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateScanDto) {
    return this.scans.createScan(dto);
  }

  @Get(':brandId/:scanId')
  getResults(
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
  ) {
    return this.scans.getScanResults(brandId, scanId);
  }
}
