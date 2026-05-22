import { Global, Module } from '@nestjs/common';
import { JwtAuthService } from './jwt.service';
import { DemoBlockGuard, JwtAuthGuard, OwnerOnlyGuard } from './auth.guard';
import { JwtAuthMiddleware } from './auth.middleware';
import { DemoWriteBlockMiddleware } from './demo-write-block.middleware';
import { AuthController } from './auth.controller';

@Global()
@Module({
  providers: [
    JwtAuthService,
    JwtAuthGuard,
    OwnerOnlyGuard,
    DemoBlockGuard,
    JwtAuthMiddleware,
    DemoWriteBlockMiddleware,
  ],
  controllers: [AuthController],
  exports: [
    JwtAuthService,
    JwtAuthGuard,
    OwnerOnlyGuard,
    DemoBlockGuard,
    JwtAuthMiddleware,
    DemoWriteBlockMiddleware,
  ],
})
export class AuthModule {}
