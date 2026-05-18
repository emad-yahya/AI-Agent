import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class ApiKeyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const apiKey = process.env.API_KEY;

    // Auth disabled if API_KEY not configured (local dev)
    if (!apiKey) {
      next();
      return;
    }

    const authHeader = req.headers['authorization'];
    const provided = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.headers['x-api-key'] as string | undefined);

    if (!provided || provided !== apiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    next();
  }
}
