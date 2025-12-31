import { Module } from '@nestjs/common';
import { PasskeyModule } from '../passkey/passkey.module';
import { UsersModule } from '../users/users.module';
import { SettingsController } from './settings.controller';

@Module({
  imports: [PasskeyModule, UsersModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
