import { Test, TestingModule } from '@nestjs/testing';
import { PasskeyService } from '../passkey/passkey.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let passkeyService: PasskeyService;

  const mockAuthService = {
    register: jest.fn(),
    verifyTotpSetup: jest.fn(),
    login: jest.fn(),
  };

  const mockPasskeyService = {
    generateRegistrationOptions: jest.fn(),
    verifyRegistration: jest.fn(),
    generateAuthenticationOptions: jest.fn(),
    verifyAuthentication: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'CONTRIBUTOR',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: PasskeyService,
          useValue: mockPasskeyService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    passkeyService = module.get<PasskeyService>(PasskeyService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'SecureP@ss123',
        name: 'New User',
        role: 'CONTRIBUTOR' as const,
      };

      const expectedResult = {
        userId: 'new-user-123',
        email: registerDto.email,
        totpSecret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,mockqrcode',
        message:
          'Registration successful. Please set up your authenticator app.',
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('verifyTotpSetup', () => {
    it('should verify TOTP code', async () => {
      const userId = 'user-123';
      const verifyDto = { code: '123456' };

      const expectedResult = {
        message: 'TOTP setup completed successfully',
        backupCodes: ['CODE1', 'CODE2', 'CODE3'],
      };

      mockAuthService.verifyTotpSetup.mockResolvedValue(expectedResult);

      const result = await controller.verifyTotpSetup(userId, verifyDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.verifyTotpSetup).toHaveBeenCalledWith(
        userId,
        verifyDto.code,
      );
    });
  });

  describe('login', () => {
    it('should login with credentials and TOTP', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        totpCode: '123456',
      };

      const expectedResult = {
        access_token: 'jwt-token',
        user: mockUser,
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('getPasskeyRegistrationOptions', () => {
    it('should generate passkey registration options', async () => {
      const mockOptions = {
        challenge: 'mock-challenge',
        rp: { name: 'Stallion', id: 'localhost' },
        user: {
          id: 'user-123-base64',
          name: mockUser.email,
          displayName: 'Test User',
        },
      };

      mockPasskeyService.generateRegistrationOptions.mockResolvedValue(
        mockOptions,
      );

      const result = await controller.getPasskeyRegistrationOptions(
        mockUser as any,
      );

      expect(result).toEqual(mockOptions);
      expect(
        mockPasskeyService.generateRegistrationOptions,
      ).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('verifyPasskeyRegistration', () => {
    it('should verify passkey registration', async () => {
      const verifyDto = {
        response: {
          id: 'credential-id',
          rawId: 'credential-id',
          response: {},
          type: 'public-key',
        } as any,
        name: 'My iPhone',
      };

      const expectedResult = {
        verified: true,
        passkeyId: 'passkey-123',
        message: 'Passkey registered successfully',
      };

      mockPasskeyService.verifyRegistration.mockResolvedValue(expectedResult);

      const result = await controller.verifyPasskeyRegistration(
        mockUser as any,
        verifyDto,
      );

      expect(result).toEqual(expectedResult);
      expect(mockPasskeyService.verifyRegistration).toHaveBeenCalledWith(
        mockUser.id,
        verifyDto.response,
        verifyDto.name,
      );
    });
  });

  describe('getPasskeyAuthenticationOptions', () => {
    it('should generate passkey authentication options', async () => {
      const email = 'test@example.com';

      const mockOptions = {
        challenge: 'mock-challenge',
        timeout: 60000,
        rpId: 'localhost',
        allowCredentials: [],
      };

      mockPasskeyService.generateAuthenticationOptions.mockResolvedValue(
        mockOptions,
      );

      const result = await controller.getPasskeyAuthenticationOptions(email);

      expect(result).toEqual(mockOptions);
      expect(
        mockPasskeyService.generateAuthenticationOptions,
      ).toHaveBeenCalledWith(email);
    });
  });

  describe('verifyPasskeyAuthentication', () => {
    it('should verify passkey authentication', async () => {
      const verifyDto = {
        email: 'test@example.com',
        response: {
          id: 'credential-id',
          rawId: 'credential-id',
          response: {},
          type: 'public-key',
        } as any,
      };

      const expectedResult = {
        access_token: 'jwt-token',
        user: mockUser,
      };

      mockPasskeyService.verifyAuthentication.mockResolvedValue(expectedResult);

      const result = await controller.verifyPasskeyAuthentication(verifyDto);

      expect(result).toEqual(expectedResult);
      expect(mockPasskeyService.verifyAuthentication).toHaveBeenCalledWith(
        verifyDto.email,
        verifyDto.response,
      );
    });
  });
});
