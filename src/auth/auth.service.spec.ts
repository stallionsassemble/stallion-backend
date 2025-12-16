import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');
jest.mock('otplib');
jest.mock('qrcode');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashed-password',
    name: 'Test User',
    role: 'CONTRIBUTOR' as any,
    totpSecret: 'JBSWY3DPEHPK3PXP',
    totpEnabled: true,
    backupCodes: ['hashed-code-1', 'hashed-code-2'],
    createdAt: new Date(),
    updatedAt: new Date(),
    bio: null,
    skills: [],
    walletId: null,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'SecureP@ss123',
      name: 'New User',
      role: 'CONTRIBUTOR' as any,
    };

    it('should register a new user successfully', async () => {
      const totpSecret = 'JBSWY3DPEHPK3PXP';
      const qrCode = 'data:image/png;base64,mockqrcode';

      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (authenticator.generateSecret as jest.Mock).mockReturnValue(totpSecret);

      const QRCode = require('qrcode');
      QRCode.toDataURL = jest.fn().mockResolvedValue(qrCode);

      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        id: 'new-user-123',
        email: registerDto.email,
        totpSecret,
        totpEnabled: false,
      });

      const result = await service.register(registerDto);

      expect(result).toEqual({
        userId: 'new-user-123',
        email: registerDto.email,
        totpSecret,
        qrCode,
        message:
          'Registration successful. Please set up your authenticator app to complete registration.',
      });

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'User with this email already exists',
      );
    });

    it('should register user with default CONTRIBUTOR role when no role specified', async () => {
      const dtoWithoutRole = {
        email: 'newuser@example.com',
        password: 'SecureP@ss123',
        name: 'New User',
      };

      const totpSecret = 'JBSWY3DPEHPK3PXP';
      const qrCode = 'data:image/png;base64,mockqrcode';

      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      (authenticator.generateSecret as jest.Mock).mockReturnValue(totpSecret);

      const QRCode = require('qrcode');
      QRCode.toDataURL = jest.fn().mockResolvedValue(qrCode);

      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-123',
        ...dtoWithoutRole,
        role: 'CONTRIBUTOR',
        totpSecret,
        totpEnabled: false,
      });

      const result = await service.register(dtoWithoutRole as any);

      expect(result).toHaveProperty('userId');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'CONTRIBUTOR',
          }),
        }),
      );
    });
  });

  describe('verifyTotpSetup', () => {
    const userId = 'user-123';
    const code = '123456';

    it('should verify TOTP and enable it successfully', async () => {
      const backupCodes = Array(10).fill('backup-code');

      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        totpEnabled: false,
      });

      (authenticator.verify as jest.Mock).mockReturnValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-backup-code');

      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        totpEnabled: true,
      });

      const result = await service.verifyTotpSetup(userId, code);

      expect(result).toHaveProperty(
        'message',
        'TOTP setup completed successfully',
      );
      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          totpEnabled: true,
          backupCodes: expect.any(Array),
        },
      });
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyTotpSetup(userId, code)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if TOTP code is invalid even if already enabled', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        totpEnabled: true,
      });

      (authenticator.verify as jest.Mock).mockReturnValue(false);

      await expect(service.verifyTotpSetup(userId, code)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyTotpSetup(userId, code)).rejects.toThrow(
        'Invalid TOTP code',
      );
    });

    it('should throw BadRequestException if TOTP code is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        totpEnabled: false,
      });

      (authenticator.verify as jest.Mock).mockReturnValue(false);

      await expect(service.verifyTotpSetup(userId, code)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyTotpSetup(userId, code)).rejects.toThrow(
        'Invalid TOTP code',
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecureP@ss123',
      totpCode: '123456',
    };

    it('should login successfully with valid credentials and TOTP', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
        },
      });
    });

    it('should login successfully with backup code', async () => {
      const loginWithBackup = { ...loginDto, totpCode: 'BACKUP123' };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // password
        .mockResolvedValueOnce(false) // first backup code
        .mockResolvedValueOnce(true); // second backup code matches

      (authenticator.verify as jest.Mock).mockReturnValue(false);
      mockJwtService.sign.mockReturnValue('jwt-token');
      mockPrismaService.user.update.mockResolvedValue(mockUser);

      const result = await service.login(loginWithBackup);

      expect(result).toHaveProperty('accessToken');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if TOTP code is required but not provided', async () => {
      const loginWithoutTotp = { ...loginDto, totpCode: undefined };

      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginWithoutTotp)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginWithoutTotp)).rejects.toThrow(
        'TOTP code required',
      );
    });

    it('should throw UnauthorizedException if TOTP code is invalid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (authenticator.verify as jest.Mock).mockReturnValue(false);

      // Mock verifyBackupCode to also return false
      jest.spyOn(service as any, 'verifyBackupCode').mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid TOTP code',
      );
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token with user payload', () => {
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = service.generateToken(mockUser);

      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
        },
      });

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });
  });

  describe('validateUser', () => {
    it('should return user if found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.email);

      expect(result).toEqual(mockUser);
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(mockUser.email);
    });

    it('should return null if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('non-existent@example.com');

      expect(result).toBeNull();
    });
  });
});
