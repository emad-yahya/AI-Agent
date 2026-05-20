import { Module } from '@nestjs/common';
import { AIModule } from 'src/ai/ai.module';
import { GeneratorsController } from './generators.controller';
import { GeneratorsService } from './generators.service';

@Module({
  imports: [AIModule],
  controllers: [GeneratorsController],
  providers: [GeneratorsService],
})
export class GeneratorsModule {}
