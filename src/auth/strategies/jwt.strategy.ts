import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RedisService } from 'src/common/redis/redis.service';
import { EnvConfig } from '../../config/env.config';
import { JwtPayload, RequestUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>(EnvConfig.JWT_SECRET),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    let currentStatus = user.status;

    if (currentStatus === UserStatus.BANNED) {
      throw new UnauthorizedException('Account is banned');
    }

    if (currentStatus === UserStatus.SUSPENDED) {
      if (user.suspendedUntil && user.suspendedUntil <= new Date()) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.ACTIVE,
            suspendedUntil: null,
            suspensionReason: null,
          },
        });
        currentStatus = UserStatus.ACTIVE;
      } else {
        throw new UnauthorizedException('Account is suspended');
      }
    }

    const touchKey = `auth:last-active-touch:${user.id}`;
    const touchedRecently = await this.redis.exists(touchKey);
    if (!touchedRecently) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      });
      await this.redis.set(touchKey, '1', 300);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      profileCompleted: user.profileCompleted,
      status: currentStatus,
    };
  }
}
