import { Module } from '@nestjs/common';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { CrawlerService } from './crawler.service';
import { SerperService } from './serper.service';

@Module({
  controllers: [SeoController],
  providers: [SeoService, CrawlerService, SerperService],
  exports: [SeoService, SerperService],
})
export class SeoModule {}
