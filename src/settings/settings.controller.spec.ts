import { Test, TestingModule } from '@nestjs/testing';
import { PasskeyService } from '../passkey/passkey.service';
import { SettingsController } from './settings.controller';

describe('SettingsController', () => {
  let controller: SettingsController;
  let passkeyService: PasskeyService;

  const mockPasskeyService = {
    getUserPasskeys: jest.fn(),
    updatePasskeyName: jest.fn(),
    deletePasskey: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'CONTRIBUTOR',
  };

  const mockPasskey = {
    id: 'passkey-123',
    name: 'My iPhone',
    deviceType: 'singleDevice',
    backedUp: false,
    transports: ['internal'],
    createdAt: new Date(),
    lastUsedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: PasskeyService,
          useValue: mockPasskeyService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    passkeyService = module.get<PasskeyService>(PasskeyService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listPasskeys', () => {
    it('should return list of user passkeys', async () => {
      const passkeys = [mockPasskey];

      mockPasskeyService.getUserPasskeys.mockResolvedValue(passkeys);

      const result = await controller.listPasskeys(mockUser as any);

      expect(result).toEqual(passkeys);
      expect(mockPasskeyService.getUserPasskeys).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should return empty array if user has no passkeys', async () => {
      mockPasskeyService.getUserPasskeys.mockResolvedValue([]);

      const result = await controller.listPasskeys(mockUser as any);

      expect(result).toEqual([]);
    });
  });

  describe('updatePasskeyName', () => {
    it('should update passkey name', async () => {
      const passkeyId = 'passkey-123';
      const newName = 'My MacBook Pro';

      const expectedResult = {
        message: 'Passkey name updated successfully',
      };

      mockPasskeyService.updatePasskeyName.mockResolvedValue(expectedResult);

      const result = await controller.updatePasskeyName(
        mockUser as any,
        passkeyId,
        newName,
      );

      expect(result).toEqual(expectedResult);
      expect(mockPasskeyService.updatePasskeyName).toHaveBeenCalledWith(
        mockUser.id,
        passkeyId,
        newName,
      );
    });
  });

  describe('deletePasskey', () => {
    it('should delete passkey', async () => {
      const passkeyId = 'passkey-123';

      const expectedResult = {
        message: 'Passkey deleted successfully',
      };

      mockPasskeyService.deletePasskey.mockResolvedValue(expectedResult);

      const result = await controller.deletePasskey(mockUser as any, passkeyId);

      expect(result).toEqual(expectedResult);
      expect(mockPasskeyService.deletePasskey).toHaveBeenCalledWith(
        mockUser.id,
        passkeyId,
      );
    });
  });
});
