import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { GeoActionsService } from './geo-actions.service';

interface ActionCompletionDto {
  brand: string;
  actionId: string;
  completed: boolean;
  notes?: string;
}

interface ProgressQuery {
  brand: string;
}

@Controller('geo-actions')
export class GeoActionsController {
  constructor(private service: GeoActionsService) {}

  @Get()
  generate(@Query('brand') brand: string) {
    if (!brand || brand.trim().length < 2) {
      throw new BadRequestException('brand query param required (min 2 chars)');
    }
    return this.service.generate(brand.trim());
  }

  @Get('completions')
  completions(@Query('brand') brand: string) {
    if (!brand || brand.trim().length < 2) {
      throw new BadRequestException('brand query param required');
    }
    return this.service.listCompletions(brand.trim());
  }

  @Post('completion')
  setCompletion(@Body() dto: ActionCompletionDto) {
    if (!dto.brand || dto.brand.trim().length < 2) {
      throw new BadRequestException('brand required');
    }
    if (!dto.actionId) {
      throw new BadRequestException('actionId required');
    }
    return this.service.setCompletion(
      dto.brand.trim(),
      dto.actionId,
      !!dto.completed,
      dto.notes,
    );
  }

  @Get('progress')
  progress(@Query() q: ProgressQuery) {
    if (!q.brand || q.brand.trim().length < 2) {
      throw new BadRequestException('brand required');
    }
    return this.service.brandProgress(q.brand.trim());
  }

  @Get('benchmark')
  benchmark(@Query('brand') brand: string) {
    if (!brand || brand.trim().length < 2) {
      throw new BadRequestException('brand required');
    }
    return this.service.brandBenchmark(brand.trim());
  }

  @Get('digest')
  digest(@Query('brand') brand: string) {
    if (!brand || brand.trim().length < 2) {
      throw new BadRequestException('brand required');
    }
    return this.service.brandDigest(brand.trim());
  }
}
