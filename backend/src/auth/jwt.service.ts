import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { UserRole } from 'src/users/users.types';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthService {
  private readonly logger = new Logger(JwtAuthService.name);

  private get secret(): string {
    const s = process.env.JWT_SECRET;
    if (!s || s.length < 16) {
      throw new Error('JWT_SECRET env var is required (min 16 chars)');
    }
    return s;
  }

  sign(payload: { sub: string; email: string; role: UserRole }, ttlSeconds: number) {
    return jwt.sign(payload, this.secret, { expiresIn: ttlSeconds });
  }

  verify(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
