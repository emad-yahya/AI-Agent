import { Body, Controller, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AnalyzeSiteDto, StartOnboardingDto } from './dto';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { AuthRequest } from 'src/auth/auth.guard';
import { UsersService } from 'src/users/users.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly service: OnboardingService,
    private readonly users: UsersService,
  ) {}

  @Post('analyze')
  analyze(@Body() dto: AnalyzeSiteDto) {
    return this.service.analyze(dto);
  }

  @Post('start')
  async start(
    @Body() dto: StartOnboardingDto,
    @CurrentUser() current: AuthRequest['user'],
  ) {
    await this.users.checkScanQuota(current.id, true); // master scan
    const result = await this.service.start(dto);
    await this.users.incrementUsage(current.id, true);
    return result;
  }
}
