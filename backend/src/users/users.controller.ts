import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, OwnerOnlyGuard, AuthRequest } from 'src/auth/auth.guard';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, OwnerOnlyGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.listAll();
  }

  @Post()
  create(
    @CurrentUser() current: AuthRequest['user'],
    @Body()
    body: {
      email: string;
      password: string;
      daysValid: number;
      maxMasterScans: number;
      maxScans: number;
    },
  ) {
    return this.users.createTrial(body, current.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      active?: boolean;
      addDaysValid?: number;
      maxMasterScans?: number;
      maxScans?: number;
      resetUsage?: boolean;
      newPassword?: string;
    },
  ) {
    return this.users.updateDemo(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.users.deleteDemo(id);
  }
}
