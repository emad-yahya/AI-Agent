import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.guard';

/**
 * Hard barrier that prevents the demo account from triggering any write or
 * external API call — applied globally after JwtAuthMiddleware so it sees the
 * resolved user. Demo users are allowed to:
 *   - call read-only verbs (GET / HEAD / OPTIONS)
 *   - POST to /generators/* (controller short-circuits to DEMO_FIXTURES, no
 *     LLM or Serper hit)
 *   - POST /auth/demo-login (the entry point that hands them the JWT)
 *   - POST /auth/change-password is blocked (demo password is owner-managed)
 *
 * Anything else throws 403 with a copy that points the visitor at Emad for a
 * real audit, keeping the demo focused on showing capability without
 * incurring API spend or mutating Firestore.
 */
@Injectable()
export class DemoWriteBlockMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const user = (req as AuthRequest).user;
    if (!user || user.role !== 'demo') return next();

    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }

    const url = req.originalUrl || req.url || '';
    // Strip query string for matching
    const path = url.split('?')[0];

    const demoAllowedWrites = [
      '/generators/', // controller returns fixtures, no real API call
      '/auth/demo-login', // entry point
      '/auth/demo-heartbeat', // visit tracking ping (60s interval)
    ];
    if (demoAllowedWrites.some((needle) => path.includes(needle))) {
      return next();
    }

    throw new ForbiddenException(
      'Disabled in demo mode — contact Emad on WhatsApp for a live audit.',
    );
  }
}
