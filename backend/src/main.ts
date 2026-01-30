import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    bufferLogs: false,
  });

  // Enable cookie parsing
  app.use(cookieParser());

  // CORS with credentials for cookie-based auth
  const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
  app.enableCors({
    origin: [frontendUrl, 'http://127.0.0.1:3000', 'http://127.0.0.1:8081'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('OpnShelf API')
    .setDescription('Personal media tracker powered by AT Protocol')
    .setVersion('1.0')
    .addCookieAuth('session')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API running on http://127.0.0.1:${port}`);
  console.log(`📚 API docs at http://127.0.0.1:${port}/api`);
}
void bootstrap();
