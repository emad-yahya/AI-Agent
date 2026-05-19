import { Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { SeoModule } from 'src/seo/seo.module';
import { BrandPresenceController } from './brand-presence.controller';
import { BrandPresenceService } from './brand-presence.service';

@Module({
  imports: [FirebaseModule, SeoModule],
  controllers: [BrandPresenceController],
  providers: [BrandPresenceService],
  exports: [BrandPresenceService],
})
export class BrandPresenceModule {}
