import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as SimpleWebAuthnServer from '@simplewebauthn/server';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ChallengeStorageService } from './challenge-storage.service';
import { PasskeyService } from './passkey.service';

jest.mock('@simplewebauthn/server');

// Handle BigInt serialization for Jest
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

describe('PasskeyService', () => {
  let service: PasskeyService;
  let prismaService: PrismaService;
  let authService: AuthService;
  let challengeStorage: ChallengeStorageService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passkeys: [],
  };

  const mockPasskey = {
    id: 'passkey-123',
    userId: 'user-123',
    credentialId: 'credential-id-base64',
    publicKey: 'public-key-base64',
    counter: 0n, // Use BigInt literal
    deviceType: 'singleDevice',
    backedUp: false,
    transports: ['internal'],
    name: 'My iPhone',
    lastUsedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    passkey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAuthService = {
    generateToken: jest.fn(),
  };

  const mockChallengeStorage = {
    setChallenge: jest.fn(),
    getAndDeleteChallenge: jest.fn(),
    hasChallenge: jest.fn(),
    deleteChallenge: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        RP_ID: 'localhost',
        ORIGIN: 'http://localhost:3000',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasskeyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: ChallengeStorageService,
          useValue: mockChallengeStorage,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PasskeyService>(PasskeyService);
    prismaService = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthService>(AuthService);
    challengeStorage = module.get<ChallengeStorageService>(
      ChallengeStorageService,
    );
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRegistrationOptions', () => {
    it('should generate registration options successfully', async () => {
      const mockOptions = {
        challenge: 'mock-challenge-base64',
        rp: { name: 'Stallion', id: 'localhost' },
        user: {
          id: 'user-123-base64',
          name: mockUser.email,
          displayName: mockUser.name,
        },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: 'none',
        excludeCredentials: [],
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform',
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (
        SimpleWebAuthnServer.generateRegistrationOptions as jest.Mock
      ).mockResolvedValue(mockOptions);
      mockChallengeStorage.setChallenge.mockResolvedValue(undefined);

      const result = await service.generateRegistrationOptions(mockUser.id);

      expect(result).toEqual(mockOptions);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        include: { passkeys: true },
      });
      expect(mockChallengeStorage.setChallenge).toHaveBeenCalledWith(
        mockUser.id,
        mockOptions.challenge,
        300,
      );
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.generateRegistrationOptions('non-existent'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateRegistrationOptions('non-existent'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('verifyRegistration', () => {
    const mockResponse = {
      id: 'credential-id',
      rawId: 'credential-id',
      response: {
        clientDataJSON: 'client-data',
        attestationObject: 'attestation',
        transports: ['internal'],
      },
      type: 'public-key',
    };

    it('should verify registration successfully', async () => {
      const mockVerification = {
        verified: true,
        registrationInfo: {
          credential: {
            id: Buffer.from('credential-id'),
            publicKey: Buffer.from('public-key'),
            counter: 0,
          },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockChallengeStorage.getAndDeleteChallenge.mockResolvedValue(
        'mock-challenge',
      );
      (
        SimpleWebAuthnServer.verifyRegistrationResponse as jest.Mock
      ).mockResolvedValue(mockVerification);
      mockPrismaService.passkey.create.mockResolvedValue(mockPasskey);

      const result = await service.verifyRegistration(
        mockUser.id,
        mockResponse as any,
        'My iPhone',
      );

      expect(result).toEqual({
        verified: true,
        passkeyId: mockPasskey.id,
        message: 'Passkey registered successfully',
      });
      expect(mockPrismaService.passkey.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyRegistration(mockUser.id, mockResponse as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if challenge not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockChallengeStorage.getAndDeleteChallenge.mockResolvedValue(null);

      await expect(
        service.verifyRegistration(mockUser.id, mockResponse as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyRegistration(mockUser.id, mockResponse as any),
      ).rejects.toThrow('Challenge not found or expired');
    });

    it('should throw BadRequestException if verification fails', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockChallengeStorage.getAndDeleteChallenge.mockResolvedValue(
        'mock-challenge',
      );
      (
        SimpleWebAuthnServer.verifyRegistrationResponse as jest.Mock
      ).mockRejectedValue(new Error('Verification failed'));

      await expect(
        service.verifyRegistration(mockUser.id, mockResponse as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateAuthenticationOptions', () => {
    it('should generate authentication options successfully', async () => {
      const mockOptions = {
        challenge: 'mock-challenge-base64',
        timeout: 60000,
        rpId: 'localhost',
        allowCredentials: [
          {
            id: mockPasskey.credentialId,
            transports: ['internal'],
          },
        ],
        userVerification: 'preferred',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        passkeys: [mockPasskey],
      });
      (
        SimpleWebAuthnServer.generateAuthenticationOptions as jest.Mock
      ).mockResolvedValue(mockOptions);
      mockChallengeStorage.setChallenge.mockResolvedValue(undefined);

      const result = await service.generateAuthenticationOptions(
        mockUser.email,
      );

      expect(result).toEqual(mockOptions);
      expect(mockChallengeStorage.setChallenge).toHaveBeenCalledWith(
        mockUser.email,
        mockOptions.challenge,
        300,
      );
    });

    it('should throw BadRequestException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.generateAuthenticationOptions('non-existent@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user has no passkeys', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        passkeys: [],
      });

      await expect(
        service.generateAuthenticationOptions(mockUser.email),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateAuthenticationOptions(mockUser.email),
      ).rejects.toThrow('No passkeys found for this user');
    });
  });

  describe('verifyAuthentication', () => {
    const mockResponse = {
      id: 'credential-id',
      rawId: mockPasskey.credentialId,
      response: {
        clientDataJSON: 'client-data',
        authenticatorData: 'auth-data',
        signature: 'signature',
      },
      type: 'public-key',
    };

    it('should verify authentication successfully', async () => {
      const mockVerification = {
        verified: true,
        authenticationInfo: {
          newCounter: 1,
        },
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        passkeys: [mockPasskey],
      });
      mockChallengeStorage.getAndDeleteChallenge.mockResolvedValue(
        'mock-challenge',
      );
      (
        SimpleWebAuthnServer.verifyAuthenticationResponse as jest.Mock
      ).mockResolvedValue(mockVerification);
      mockPrismaService.passkey.update.mockResolvedValue(mockPasskey);
      mockAuthService.generateToken.mockReturnValue({
        accessToken: 'jwt-token',
        user: mockUser,
      });

      const result = await service.verifyAuthentication(
        mockUser.email,
        mockResponse as any,
      );

      expect(result).toHaveProperty('accessToken');
      expect(mockPrismaService.passkey.update).toHaveBeenCalledWith({
        where: { id: mockPasskey.id },
        data: {
          counter: 1n,
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyAuthentication(mockUser.email, mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if challenge not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        passkeys: [mockPasskey],
      });
      mockChallengeStorage.getAndDeleteChallenge.mockResolvedValue(null);

      await expect(
        service.verifyAuthentication(mockUser.email, mockResponse as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if passkey not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        passkeys: [mockPasskey],
      });
      mockChallengeStorage.getAndDeleteChallenge.mockResolvedValue(
        'mock-challenge',
      );

      const wrongResponse = { ...mockResponse, rawId: 'wrong-id' };

      await expect(
        service.verifyAuthentication(mockUser.email, wrongResponse as any),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyAuthentication(mockUser.email, wrongResponse as any),
      ).rejects.toThrow('Passkey not found');
    });
  });

  describe('getUserPasskeys', () => {
    it('should return user passkeys', async () => {
      const passkeys = [
        {
          id: mockPasskey.id,
          name: mockPasskey.name,
          deviceType: mockPasskey.deviceType,
          backedUp: mockPasskey.backedUp,
          transports: mockPasskey.transports,
          createdAt: mockPasskey.createdAt,
          lastUsedAt: mockPasskey.lastUsedAt,
        },
      ];
      mockPrismaService.passkey.findMany.mockResolvedValue(passkeys);

      const result = await service.getUserPasskeys(mockUser.id);

      expect(result).toEqual(passkeys);
    });
  });

  describe('updatePasskeyName', () => {
    it('should update passkey name successfully', async () => {
      mockPrismaService.passkey.findFirst.mockResolvedValue(mockPasskey);
      const updatedPasskey = {
        id: mockPasskey.id,
        name: 'New Name',
        deviceType: mockPasskey.deviceType,
        createdAt: mockPasskey.createdAt,
        lastUsedAt: mockPasskey.lastUsedAt,
      };
      mockPrismaService.passkey.update.mockResolvedValue(updatedPasskey);

      const result = await service.updatePasskeyName(
        mockUser.id,
        mockPasskey.id,
        'New Name',
      );

      expect(result).toEqual(updatedPasskey);
      expect(mockPrismaService.passkey.update).toHaveBeenCalledWith({
        where: { id: mockPasskey.id },
        data: { name: 'New Name' },
        select: {
          id: true,
          name: true,
          deviceType: true,
          createdAt: true,
          lastUsedAt: true,
        },
      });
    });

    it('should throw BadRequestException if passkey not found', async () => {
      mockPrismaService.passkey.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePasskeyName(mockUser.id, 'non-existent', 'New Name'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updatePasskeyName(mockUser.id, 'non-existent', 'New Name'),
      ).rejects.toThrow('Passkey not found');
    });
  });

  describe('deletePasskey', () => {
    it('should delete passkey successfully', async () => {
      const anotherPasskey = { ...mockPasskey, id: 'passkey-456' };
      mockPrismaService.passkey.findFirst.mockResolvedValue(mockPasskey);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        mfaEnabled: true,
        passkeys: [mockPasskey, anotherPasskey], // Has another passkey
      });
      mockPrismaService.passkey.delete.mockResolvedValue(mockPasskey);

      const result = await service.deletePasskey(mockUser.id, mockPasskey.id);

      expect(result).toEqual({ message: 'Passkey deleted successfully' });
      expect(mockPrismaService.passkey.delete).toHaveBeenCalledWith({
        where: { id: mockPasskey.id },
      });
    });

    it('should throw BadRequestException if passkey not found', async () => {
      mockPrismaService.passkey.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePasskey(mockUser.id, 'non-existent'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to delete last passkey without TOTP', async () => {
      mockPrismaService.passkey.findFirst.mockResolvedValue(mockPasskey);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        mfaEnabled: false,
        passkeys: [mockPasskey], // Only one passkey
      });

      await expect(
        service.deletePasskey(mockUser.id, mockPasskey.id),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.deletePasskey(mockUser.id, mockPasskey.id),
      ).rejects.toThrow('Cannot delete last passkey');
    });
  });
});
