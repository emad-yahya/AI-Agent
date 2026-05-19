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
import { ApiKeyMiddleware } from './auth/api-key.middleware';

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
    AIModule,
    ScansModule,
    AnalyticsModule,
    SchedulerModule,
    SeoModule,
    AlertsModule,
    ListicleGapModule,
    CompetitorAuditModule,
    GeoActionsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // SSE endpoint excluded: EventSource API cannot send Authorization headers.
    // The scanId path param is a Firestore-generated random ID (~20 char base64)
    // that is only known to the client that created the scan via authenticated POST.
    consumer
      .apply(ApiKeyMiddleware)
      .exclude({ path: 'scans/stream/:scanId', method: RequestMethod.GET })
      .forRoutes('*');
  }
}
