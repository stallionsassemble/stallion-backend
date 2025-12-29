import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EnvConfig } from '../config/env.config';
import { EmailModule } from '../email/email.module';
import { PasskeyModule } from '../passkey/passkey.module';
import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { VerificationCodeStorageService } from './verification-code-storage.service';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    PassportModule,
    ConfigModule,
    EmailModule,
    forwardRef(() => PasskeyModule),
    forwardRef(() => WalletModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        secret: EnvConfig.JWT_SECRET,
        signOptions: {
          expiresIn: '7d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, VerificationCodeStorageService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
