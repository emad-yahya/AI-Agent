import { Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { SeoModule } from 'src/seo/seo.module';
import { ContentGapController } from './content-gap.controller';
import { ContentGapService } from './content-gap.service';

@Module({
  imports: [FirebaseModule, SeoModule],
  controllers: [ContentGapController],
  providers: [ContentGapService],
})
export class ContentGapModule {}
