import { Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { SeoModule } from 'src/seo/seo.module';
import { OnPageSeoController } from './on-page-seo.controller';
import { OnPageSeoService } from './on-page-seo.service';
import { PageSpeedService } from './page-speed.service';

@Module({
  imports: [FirebaseModule, SeoModule],
  controllers: [OnPageSeoController],
  providers: [OnPageSeoService, PageSpeedService],
  exports: [OnPageSeoService, PageSpeedService],
})
export class OnPageSeoModule {}
