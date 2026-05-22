import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthService, JwtPayload } from './jwt.service';
import { UsersService } from 'src/users/users.service';

export interface AuthRequest extends Request {
  user: JwtPayload & { id: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtAuthService,
    private users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7);
    const payload = this.jwtService.verify(token);

    // Re-check user still active / not expired (token may outlive policy)
    const found = await this.users.findById(payload.sub);
    if (!found || !found.data.active) {
      throw new UnauthorizedException('Account disabled');
    }
    if (
      found.data.expiresAt &&
      found.data.expiresAt.toDate().getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Account expired');
    }

    req.user = { ...payload, id: payload.sub };
    return true;
  }
}

@Injectable()
export class OwnerOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    if (!req.user || req.user.role !== 'owner') {
      throw new ForbiddenException('Owner only');
    }
    return true;
  }
}

/**
 * Blocks demo-role users from executing the action. Used to wrap any endpoint
 * that would consume API credits, mutate persisted data, or trigger external
 * calls (scans, real generator runs, user mgmt, settings writes).
 *
 * Generators do NOT use this guard — they fall through to a demo-aware service
 * that returns pre-built fixtures instead of hitting the LLM.
 */
@Injectable()
export class DemoBlockGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    if (req.user?.role === 'demo') {
      throw new ForbiddenException(
        'Disabled in demo mode — contact Emad for a live audit.',
      );
    }
    return true;
  }
}
