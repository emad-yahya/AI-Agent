import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import { ScansService } from './scans.service';
import { ScanEventsService } from './scan-events.service';
import { CreateScanDto } from './dto';
import { CompareDto } from './compare.dto';
import { GenerateContentDto } from './generate-content.dto';

@Controller('scans')
export class ScanController {
  constructor(
    private scans: ScansService,
    private scanEvents: ScanEventsService,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(ThrottlerGuard)
  create(@Body() dto: CreateScanDto) {
    return this.scans.createScan(dto);
  }

  @Post('compare')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  compare(@Body() dto: CompareDto) {
    return this.scans.compareBrands(dto);
  }

  @Post('content')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  async generateContent(@Body() dto: GenerateContentDto) {
    const content = await this.scans.generateContent(dto);
    return { content };
  }

  @Get()
  listByBrand(@Query('brand') brand: string) {
    if (!brand) throw new BadRequestException('brand query param required');
    return this.scans.listScansByBrand(brand);
  }

  @Sse('stream/:scanId')
  stream(@Param('scanId') scanId: string): Observable<MessageEvent> {
    return new Observable((observer) => {
      const unsub = this.scanEvents.subscribe(scanId, (event) => {
        observer.next({ data: event } as MessageEvent);
        if (event.type === 'done' || event.type === 'error') {
          observer.complete();
          unsub();
        }
      });
      return unsub;
    });
  }

  @Get(':brandId/:scanId')
  getResults(
    @Param('brandId') brandId: string,
    @Param('scanId') scanId: string,
  ) {
    return this.scans.getScanResults(brandId, scanId);
  }
}
