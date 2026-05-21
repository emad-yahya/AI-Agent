import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtAuthService } from './jwt.service';
import { UsersService } from 'src/users/users.service';
import { AuthRequest } from './auth.guard';

// Global middleware version of JwtAuthGuard. Used in AppModule to gate every
// route except explicit exclusions in app.module.ts.
@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  constructor(
    private jwt: JwtAuthService,
    private users: UsersService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7);
    const payload = this.jwt.verify(token);

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

    (req as AuthRequest).user = { ...payload, id: payload.sub };
    next();
  }
}
