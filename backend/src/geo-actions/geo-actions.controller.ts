import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GeoActionsService } from './geo-actions.service';

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
}
