import { Global, Module } from '@nestjs/common';
import { JwtAuthService } from './jwt.service';
import { JwtAuthGuard, OwnerOnlyGuard } from './auth.guard';
import { JwtAuthMiddleware } from './auth.middleware';
import { AuthController } from './auth.controller';

@Global()
@Module({
  providers: [JwtAuthService, JwtAuthGuard, OwnerOnlyGuard, JwtAuthMiddleware],
  controllers: [AuthController],
  exports: [JwtAuthService, JwtAuthGuard, OwnerOnlyGuard, JwtAuthMiddleware],
})
export class AuthModule {}
