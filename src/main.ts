import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { EnvConfig } from './config/env.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();
  app.setGlobalPrefix('api');

  // Serve static files from uploads directory
  const uploadDir =
    configService.get<string>(EnvConfig.UPLOAD_DIR) || './uploads';
  app.useStaticAssets(join(process.cwd(), uploadDir), {
    prefix: '/uploads/',
  });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Stallion Backend API')
    .setDescription(
      'Bounty platform backend with wallet management, points system, and Soroban integration',
    )
    .setVersion('2.0')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management and profiles')
    .addTag('Bounties', 'Bounty creation and management')
    .addTag('Projects', 'Project creation and management')
    .addTag('Hackathons', 'Hackathon creation, management, and submissions')
    .addTag('Chat', 'Real-time messaging and conversations')
    .addTag('Forum', 'Community forum threads and discussions')
    .addTag('Wallet', 'Wallet and transaction management')
    .addTag('Transactions', 'Transaction history and details')
    .addTag('Reputation', 'Reputation scores, leaderboards, and badges')
    .addTag('Notifications', 'User notifications and preferences')
    .addTag('Settings', 'User settings and passkey management')
    .addTag('Upload', 'File upload operations')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app as any, config);
  SwaggerModule.setup('api/docs', app as any, document, {
    customSiteTitle: 'Stallion API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(configService.get<number>(EnvConfig.PORT) || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger documentation: ${await app.getUrl()}/api/docs`);
}
bootstrap().catch((err) => console.log('Failed to start application: ', err));
