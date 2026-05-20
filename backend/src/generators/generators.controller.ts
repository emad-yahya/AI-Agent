import { Body, Controller, Post } from '@nestjs/common';
import { GeneratorsService } from './generators.service';
import {
  GenerateArticleSchemaDto,
  GenerateFaqFromPaaDto,
  GenerateFaqSchemaDto,
  GenerateLlmsTxtDto,
  GenerateOrgSchemaDto,
  GenerateReviewSchemaDto,
  GenerateRobotsPatchDto,
} from './dto';

@Controller('generators')
export class GeneratorsController {
  constructor(private readonly service: GeneratorsService) {}

  @Post('schema/faq')
  faq(@Body() dto: GenerateFaqSchemaDto) {
    return this.service.generateFaqSchema(dto);
  }

  @Post('schema/faq-from-paa')
  faqFromPaa(@Body() dto: GenerateFaqFromPaaDto) {
    return this.service.generateFaqFromPaa({
      questions: dto.questions,
      brand: dto.brand,
      category: dto.category,
    });
  }

  @Post('schema/organization')
  organization(@Body() dto: GenerateOrgSchemaDto) {
    return this.service.generateOrgSchema(dto);
  }

  @Post('schema/article')
  article(@Body() dto: GenerateArticleSchemaDto) {
    return this.service.generateArticleSchema(dto);
  }

  @Post('schema/review')
  review(@Body() dto: GenerateReviewSchemaDto) {
    return this.service.generateReviewSchema(dto);
  }

  @Post('llms-txt')
  llmsTxt(@Body() dto: GenerateLlmsTxtDto) {
    return this.service.generateLlmsTxt(dto);
  }

  @Post('robots-patch')
  robotsPatch(@Body() dto: GenerateRobotsPatchDto) {
    return this.service.generateRobotsPatch(dto);
  }
}
