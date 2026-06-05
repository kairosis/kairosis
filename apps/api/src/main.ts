import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, cors: true });
  const port = process.env['PORT'] ?? 3200;
  await app.listen(port);
  console.log(`API listening on port ${port}`);
}

bootstrap();
