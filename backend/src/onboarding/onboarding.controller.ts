import { Body, Controller, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AnalyzeSiteDto, StartOnboardingDto } from './dto';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Post('analyze')
  analyze(@Body() dto: AnalyzeSiteDto) {
    return this.service.analyze(dto);
  }

  @Post('start')
  start(@Body() dto: StartOnboardingDto) {
    return this.service.start(dto);
  }
}
