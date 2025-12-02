import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ChallengeStorageService } from './challenge-storage.service';

describe('ChallengeStorageService', () => {
  let service: ChallengeStorageService;
  let mockRedis: any;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: undefined,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn(),
      ttl: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChallengeStorageService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ChallengeStorageService>(ChallengeStorageService);

    // Mock the Redis instance
    (service as any).redis = mockRedis;

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await (service as any).onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setChallenge', () => {
    it('should store challenge with TTL', async () => {
      const identifier = 'user-123';
      const challenge = 'mock-challenge';
      const ttl = 300;

      mockRedis.setex.mockResolvedValue('OK');

      await service.setChallenge(identifier, challenge, ttl);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'passkey:challenge:user-123',
        ttl,
        challenge,
      );
    });

    it('should use default TTL if not provided', async () => {
      const identifier = 'user-123';
      const challenge = 'mock-challenge';

      mockRedis.setex.mockResolvedValue('OK');

      await service.setChallenge(identifier, challenge);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'passkey:challenge:user-123',
        300, // default TTL
        challenge,
      );
    });
  });

  describe('getAndDeleteChallenge', () => {
    it('should retrieve and delete challenge', async () => {
      const identifier = 'user-123';
      const challenge = 'mock-challenge';

      mockRedis.get.mockResolvedValue(challenge);
      mockRedis.del.mockResolvedValue(1);

      const result = await service.getAndDeleteChallenge(identifier);

      expect(result).toBe(challenge);
      expect(mockRedis.get).toHaveBeenCalledWith('passkey:challenge:user-123');
      expect(mockRedis.del).toHaveBeenCalledWith('passkey:challenge:user-123');
    });

    it('should return null if challenge not found', async () => {
      const identifier = 'user-123';

      mockRedis.get.mockResolvedValue(null);

      const result = await service.getAndDeleteChallenge(identifier);

      expect(result).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle empty string challenge', async () => {
      const identifier = 'user-123';

      mockRedis.get.mockResolvedValue('');

      const result = await service.getAndDeleteChallenge(identifier);

      expect(result).toBe('');
      // Empty string is still a valid value, so it should be deleted
    });
  });

  describe('hasChallenge', () => {
    it('should return true if challenge exists', async () => {
      const identifier = 'user-123';

      mockRedis.exists.mockResolvedValue(1);

      const result = await service.hasChallenge(identifier);

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(
        'passkey:challenge:user-123',
      );
    });

    it('should return false if challenge does not exist', async () => {
      const identifier = 'user-123';

      mockRedis.exists.mockResolvedValue(0);

      const result = await service.hasChallenge(identifier);

      expect(result).toBe(false);
    });
  });

  describe('deleteChallenge', () => {
    it('should delete challenge', async () => {
      const identifier = 'user-123';

      mockRedis.del.mockResolvedValue(1);

      await service.deleteChallenge(identifier);

      expect(mockRedis.del).toHaveBeenCalledWith('passkey:challenge:user-123');
    });
  });

  describe('getChallengeTTL', () => {
    it('should return TTL in seconds', async () => {
      const identifier = 'user-123';

      mockRedis.ttl.mockResolvedValue(250);

      const result = await service.getChallengeTTL(identifier);

      expect(result).toBe(250);
      expect(mockRedis.ttl).toHaveBeenCalledWith('passkey:challenge:user-123');
    });

    it('should return -1 if key has no expiry', async () => {
      const identifier = 'user-123';

      mockRedis.ttl.mockResolvedValue(-1);

      const result = await service.getChallengeTTL(identifier);

      expect(result).toBe(-1);
    });

    it('should return -2 if key does not exist', async () => {
      const identifier = 'user-123';

      mockRedis.ttl.mockResolvedValue(-2);

      const result = await service.getChallengeTTL(identifier);

      expect(result).toBe(-2);
    });
  });

  describe('isHealthy', () => {
    it('should return true if Redis responds to ping', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.isHealthy();

      expect(result).toBe(true);
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should return false if Redis ping fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const result = await service.isHealthy();

      expect(result).toBe(false);
    });
  });

  describe('lifecycle', () => {
    it('should close Redis connection on module destroy', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await (service as any).onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
