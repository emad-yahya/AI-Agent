import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { FirebaseModule } from './firebase/firebase.module';
import { AIModule } from './ai/ai.module';
import { ScansModule } from './scans/scans.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { SeoModule } from './seo/seo.module';
import { AlertsModule } from './alerts/alerts.module';
import { ListicleGapModule } from './listicle-gap/listicle-gap.module';
import { CompetitorAuditModule } from './competitor-audit/competitor-audit.module';
import { GeoActionsModule } from './geo-actions/geo-actions.module';
import { BrandPresenceModule } from './brand-presence/brand-presence.module';
import { GeneratorsModule } from './generators/generators.module';
import { OnPageSeoModule } from './on-page-seo/on-page-seo.module';
import { ContentGapModule } from './content-gap/content-gap.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { SystemHealthModule } from './system-health/system-health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthMiddleware } from './auth/auth.middleware';
import { DemoWriteBlockMiddleware } from './auth/demo-write-block.middleware';

const redisUrl = process.env.REDIS_URL;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL_MS', 60000),
          limit: config.get<number>('THROTTLE_SCAN_LIMIT', 5),
        },
      ],
    }),
    ...(redisUrl
      ? [
          BullModule.forRoot({
            connection: { url: redisUrl },
          }),
        ]
      : []),
    FirebaseModule,
    UsersModule,
    AuthModule,
    AdminModule,
    AIModule,
    ScansModule,
    AnalyticsModule,
    SchedulerModule,
    SeoModule,
    AlertsModule,
    ListicleGapModule,
    CompetitorAuditModule,
    GeoActionsModule,
    BrandPresenceModule,
    GeneratorsModule,
    OnPageSeoModule,
    ContentGapModule,
    OnboardingModule,
    SystemHealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Public endpoints (no auth required):
    //   - POST /auth/login         (obvious — login needs to be reachable)
    //   - GET  /scans/stream/:id   (SSE; EventSource cannot send Authorization
    //                                header. scanId is a random Firestore ID
    //                                only known to the authenticated creator.)
    //   - GET  /system/health/integrations (health probe used by login screen
    //                                to show readiness; safe to expose)
    consumer
      .apply(JwtAuthMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/demo-login', method: RequestMethod.POST },
        { path: 'auth/demo-heartbeat', method: RequestMethod.POST },
        { path: 'scans/stream/:scanId', method: RequestMethod.GET },
        { path: 'system/health/integrations', method: RequestMethod.GET },
      )
      .forRoutes('*');

    // Hard barrier: demo role cannot trigger any write/external API call,
    // except a small allowlist (generators short-circuit to fixtures,
    // /auth/demo-login is the entry point). Runs AFTER JwtAuthMiddleware so
    // req.user is populated.
    consumer
      .apply(DemoWriteBlockMiddleware)
      .exclude(
        { path: 'auth/login', method: RequestMethod.POST },
        { path: 'auth/demo-login', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
