import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from 'src/users/users.service';
import { DemoTrackingService } from 'src/admin/demo-tracking.service';
import { JwtAuthService } from './jwt.service';
import { AuthRequest, JwtAuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private users: UsersService,
    private jwt: JwtAuthService,
    private demoTracking: DemoTrackingService,
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

  /**
   * Public, credential-less demo entry. Issues a short-lived JWT for the
   * pre-seeded demo account so a "View Demo" button on the login page can drop
   * a visitor straight into a read-only tour without exposing credentials.
   *
   * Demo writes are blocked at the route level by DemoBlockGuard; this
   * endpoint just hands out a token. Quota is irrelevant for demo (writes
   * blocked anyway), but the JWT TTL still respects the account's expiresAt.
   */
  @Post('demo-login')
  async demoLogin(@Req() req: Request) {
    const found = await this.users.findDemoSeed();
    if (!found) {
      throw new BadRequestException(
        'Demo account not provisioned — set DEMO_EMAIL / DEMO_PASSWORD env vars',
      );
    }
    if (!found.data.active) {
      throw new BadRequestException('Demo account disabled');
    }
    await this.users.touchLogin(found.id);
    let ttl = 24 * 60 * 60; // 1 day
    if (found.data.expiresAt) {
      const remaining = Math.floor(
        (found.data.expiresAt.toDate().getTime() - Date.now()) / 1000,
      );
      if (remaining > 0) ttl = Math.min(remaining, 30 * 24 * 60 * 60);
    }
    const token = this.jwt.sign(
      { sub: found.id, email: found.data.email, role: found.data.role },
      ttl,
    );
    // Track this visit. Failures are non-fatal — we never want a Firestore
    // hiccup to block the demo from being usable.
    let sessionId: string | null = null;
    try {
      sessionId = await this.demoTracking.startSession(req);
    } catch {
      sessionId = null;
    }
    return {
      token,
      sessionId,
      user: this.users.publicShape(found.id, found.data),
    };
  }

  /**
   * Idempotent heartbeat from the demo SPA. Frontend pings every 60s while
   * the demo tab is foregrounded so we can compute session duration without
   * relying on an explicit logout signal.
   */
  @Post('demo-heartbeat')
  async demoHeartbeat(@Body() body: { sessionId?: string }) {
    if (body?.sessionId) {
      await this.demoTracking.heartbeat(body.sessionId);
    }
    return { ok: true };
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
