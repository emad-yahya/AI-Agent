import { Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { SeoModule } from 'src/seo/seo.module';
import { CompetitorAuditController } from './competitor-audit.controller';
import { CompetitorAuditService } from './competitor-audit.service';

@Module({
  imports: [FirebaseModule, SeoModule],
  controllers: [CompetitorAuditController],
  providers: [CompetitorAuditService],
  exports: [CompetitorAuditService],
})
export class CompetitorAuditModule {}
