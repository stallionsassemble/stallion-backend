import {
  Body,
  Controller,
  Inject,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StepUpService } from '../common/services/step-up.service';
import { TwoFactorVerificationService } from '../common/services/two-factor-verification.service';
import { PasskeyService } from '../passkey/passkey.service';
import {
  StepUpPasskeyVerifyDto,
  StepUpTokenResponseDto,
  StepUpTotpDto,
} from './dto/step-up.dto';

@ApiTags('Auth / Security')
@Controller('auth/step-up')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token' })
export class StepUpController {
  constructor(
    private readonly stepUpService: StepUpService,
    @Inject(forwardRef(() => TwoFactorVerificationService))
    private readonly twoFactorVerificationService: TwoFactorVerificationService,
    @Inject(forwardRef(() => PasskeyService))
    private readonly passkeyService: PasskeyService,
  ) {}

  @Post('totp')
  @ApiOperation({
    summary: 'Verify TOTP code for step-up authentication',
    description:
      'Verifies a 6-digit TOTP code or backup code and returns a time-limited step-up token for sensitive operations.',
  })
  @ApiOkResponse({
    description: 'Step-up token issued successfully',
    type: StepUpTokenResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid TOTP code' })
  async verifyTotp(
    @CurrentUser('id') userId: string,
    @Body() dto: StepUpTotpDto,
  ): Promise<StepUpTokenResponseDto> {
    await this.twoFactorVerificationService.verify2FA(userId, dto.code);
    return this.stepUpService.issueToken(userId);
  }

  @Post('passkey/options')
  @ApiOperation({
    summary: 'Get passkey options for step-up authentication',
    description:
      'Generates WebAuthn challenge options for any registered passkey belonging to the authenticated user.',
  })
  @ApiOkResponse({
    description: 'WebAuthn challenge options generated',
  })
  @ApiBadRequestResponse({ description: 'No passkeys registered for user' })
  async getPasskeyOptions(@CurrentUser('id') userId: string) {
    return this.passkeyService.generateStepUpAuthenticationOptions(userId);
  }

  @Post('passkey/verify')
  @ApiOperation({
    summary: 'Verify passkey for step-up authentication',
    description:
      'Verifies the WebAuthn response and returns a time-limited step-up token for sensitive operations.',
  })
  @ApiOkResponse({
    description: 'Step-up token issued successfully',
    type: StepUpTokenResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid passkey response' })
  async verifyPasskey(
    @CurrentUser('id') userId: string,
    @Body() dto: StepUpPasskeyVerifyDto,
  ): Promise<StepUpTokenResponseDto> {
    await this.passkeyService.verifyStepUpAuthentication(userId, dto.response);
    return this.stepUpService.issueToken(userId);
  }
}
