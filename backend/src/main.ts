import { NestApplication, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { UsersService } from './users/users.service';

async function bootstrap() {
  const logger = new Logger(NestApplication.name);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Trust Railway / Vercel / Cloudflare proxy so req.ip + XFF-derived IPs in
  // DemoTrackingService reflect the real visitor, not the proxy hop.
  app.set('trust proxy', 1);
  const frontendUrl = (
    process.env.FRONTEND_URL ?? 'http://localhost:5173'
  ).replace(/\/+$/, '');
  app.enableCors({ origin: frontendUrl });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`backend running on ${await app.getUrl()}`);

  // Idempotent demo seed — runs after listen() so FirebaseService.onModuleInit
  // has guaranteed to finish (otherwise this.firebase.getDb() is undefined and
  // the seed fails silently, leaving the public "View Demo" button broken).
  try {
    const users = app.get(UsersService);
    await users.seedDemoAccount();
  } catch (err) {
    logger.warn(`demo seed skipped: ${(err as Error).message}`);
  }
}
void bootstrap();
