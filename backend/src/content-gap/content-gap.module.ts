import { Module } from '@nestjs/common';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { SeoModule } from 'src/seo/seo.module';
import { AIModule } from 'src/ai/ai.module';
import { ContentGapController } from './content-gap.controller';
import { ContentGapService } from './content-gap.service';

@Module({
  imports: [FirebaseModule, SeoModule, AIModule],
  controllers: [ContentGapController],
  providers: [ContentGapService],
})
export class ContentGapModule {}
