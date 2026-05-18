import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { SchedulerService } from './scheduler.service';

class EnableSchedulerDto {
  @IsString()
  @MinLength(7)
  cron: string;
}

@Controller('scheduler')
export class SchedulerController {
  constructor(private scheduler: SchedulerService) {}

  @Get('status')
  status() {
    return this.scheduler.getStatus();
  }

  @Post('enable')
  async enable(@Body() dto: EnableSchedulerDto) {
    try {
      return await this.scheduler.enable(dto.cron);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('disable')
  disable() {
    return this.scheduler.disable();
  }

  @Post('run-now')
  runNow() {
    return this.scheduler.runNow();
  }
}
