import { Module } from '@nestjs/common';
import { AIModule } from 'src/ai/ai.module';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { SeoModule } from 'src/seo/seo.module';
import { ListicleGapController } from './listicle-gap.controller';
import { ListicleGapService } from './listicle-gap.service';

@Module({
  imports: [FirebaseModule, AIModule, SeoModule],
  controllers: [ListicleGapController],
  providers: [ListicleGapService],
  exports: [ListicleGapService],
})
export class ListicleGapModule {}
