import { Module } from '@nestjs/common';
import { PasskeyModule } from '../passkey/passkey.module';
import { SettingsController } from './settings.controller';

@Module({
  imports: [PasskeyModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
