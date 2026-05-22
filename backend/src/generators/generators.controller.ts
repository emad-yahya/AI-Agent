import { Body, Controller, Post } from '@nestjs/common';
import { GeneratorsService } from './generators.service';
import { AuthRequest } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { DEMO_FIXTURES } from './demo-fixtures';
import {
  GenerateArticleSchemaDto,
  GenerateFaqFromPaaDto,
  GenerateFaqSchemaDto,
  GenerateLlmsTxtDto,
  GenerateOrgSchemaDto,
  GenerateReviewSchemaDto,
  GenerateRobotsPatchDto,
} from './dto';

/**
 * All generator endpoints are auth-guarded. For demo-role users we short-
 * circuit to hardcoded fixtures (DEMO_FIXTURES) so the demo tour can showcase
 * every generator end-to-end without touching the LLM or consuming credits.
 *
 * Owner-role users get the real generators.
 */
@Controller('generators')
export class GeneratorsController {
  constructor(private readonly service: GeneratorsService) {}

  private isDemo(user: AuthRequest['user']) {
    return user?.role === 'demo';
  }

  @Post('schema/faq')
  faq(
    @Body() dto: GenerateFaqSchemaDto,
    @CurrentUser() user: AuthRequest['user'],
  ) {
    if (this.isDemo(user)) return DEMO_FIXTURES.faqSchema();
    return this.service.generateFaqSchema(dto);
  }

  @Post('schema/faq-from-paa')
  faqFromPaa(
    @Body() dto: GenerateFaqFromPaaDto,
    @CurrentUser() user: AuthRequest['user'],
  ) {
    if (this.isDemo(user)) return DEMO_FIXTURES.faqSchema();
    return this.service.generateFaqFromPaa({
      questions: dto.questions,
      brand: dto.brand,
      category: dto.category,
    });
  }

  @Post('schema/organization')
  organization(
    @Body() dto: GenerateOrgSchemaDto,
    @CurrentUser() user: AuthRequest['user'],
  ) {
    if (this.isDemo(user)) return DEMO_FIXTURES.orgSchema();
    return this.service.generateOrgSchema(dto);
  }

  @Post('schema/article')
  article(
    @Body() dto: GenerateArticleSchemaDto,
    @CurrentUser() user: AuthRequest['user'],
  ) {
    if (this.isDemo(user)) return DEMO_FIXTURES.articleSchema();
    return this.service.generateArticleSchema(dto);
  }

  @Post('schema/review')
  review(
    @Body() dto: GenerateReviewSchemaDto,
    @CurrentUser() user: AuthRequest['user'],
  ) {
    if (this.isDemo(user)) return DEMO_FIXTURES.reviewSchema();
    return this.service.generateReviewSchema(dto);
  }

  @Post('llms-txt')
  llmsTxt(
    @Body() dto: GenerateLlmsTxtDto,
    @CurrentUser() user: AuthRequest['user'],
  ) {
    if (this.isDemo(user)) return DEMO_FIXTURES.llmsTxt();
    return this.service.generateLlmsTxt(dto);
  }

  @Post('robots-patch')
  robotsPatch(
    @Body() dto: GenerateRobotsPatchDto,
    @CurrentUser() user: AuthRequest['user'],
  ) {
    if (this.isDemo(user)) return DEMO_FIXTURES.robotsPatch();
    return this.service.generateRobotsPatch(dto);
  }
}
