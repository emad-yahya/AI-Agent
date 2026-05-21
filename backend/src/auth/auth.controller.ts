import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtAuthService } from './jwt.service';
import { AuthRequest, JwtAuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private users: UsersService,
    private jwt: JwtAuthService,
  ) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    if (!body?.email || !body?.password) {
      throw new BadRequestException('email and password required');
    }
    const found = await this.users.verifyCredentials(body.email, body.password);
    if (!found) {
      throw new BadRequestException('Invalid email or password');
    }
    await this.users.touchLogin(found.id);

    // TTL: demo accounts get JWT that expires when account expires (capped 30d).
    // Owner gets 7d.
    let ttl = 7 * 24 * 60 * 60;
    if (found.data.role === 'demo' && found.data.expiresAt) {
      const remaining = Math.floor(
        (found.data.expiresAt.toDate().getTime() - Date.now()) / 1000,
      );
      ttl = Math.max(60, Math.min(remaining, 30 * 24 * 60 * 60));
    }

    const token = this.jwt.sign(
      { sub: found.id, email: found.data.email, role: found.data.role },
      ttl,
    );
    return {
      token,
      user: this.users.publicShape(found.id, found.data),
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AuthRequest['user']) {
    const found = await this.users.findById(current.id);
    if (!found) throw new BadRequestException('user not found');
    return this.users.publicShape(found.id, found.data);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() current: AuthRequest['user'],
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    if (!body?.oldPassword || !body?.newPassword) {
      throw new BadRequestException('oldPassword and newPassword required');
    }
    return this.users.changeOwnPassword(
      current.id,
      body.oldPassword,
      body.newPassword,
    );
  }
}
