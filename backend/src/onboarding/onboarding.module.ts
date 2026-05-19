import { Module } from '@nestjs/common';
import { AIModule } from 'src/ai/ai.module';
import { SeoModule } from 'src/seo/seo.module';
import { ScansModule } from 'src/scans/scans.module';
import { CompetitorAuditModule } from 'src/competitor-audit/competitor-audit.module';
import { BrandPresenceModule } from 'src/brand-presence/brand-presence.module';
import { OnPageSeoModule } from 'src/on-page-seo/on-page-seo.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [
    AIModule,
    SeoModule,
    ScansModule,
    CompetitorAuditModule,
    BrandPresenceModule,
    OnPageSeoModule,
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
