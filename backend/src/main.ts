import { NestApplication, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger(NestApplication.name);
  const app = await NestFactory.create(AppModule);
  const frontendUrl = (
    process.env.FRONTEND_URL ?? 'http://localhost:5173'
  ).replace(/\/+$/, '');
  app.enableCors({ origin: frontendUrl });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`backend running on ${await app.getUrl()}`);
}
void bootstrap();
