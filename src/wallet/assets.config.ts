export interface StellarAssetConfig {
  code: string;
  issuer: string;
  name: string;
  decimals?: number;
}

export const SUPPORTED_STELLAR_ASSETS: Record<string, StellarAssetConfig> = {
  XLM: {
    code: 'XLM',
    issuer: 'native',
    name: 'Stellar Lumens',
    decimals: 7,
  },
  USDC: {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    name: 'USD Coin',
    decimals: 7,
  },
  AQUA: {
    code: 'AQUA',
    issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
    name: 'Aquarius',
    decimals: 7,
  },
  yXLM: {
    code: 'yXLM',
    issuer: 'GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55',
    name: 'Ultra Stellar yXLM',
    decimals: 7,
  },
};

export const getSupportedCurrencies = (): string[] => {
  return Object.keys(SUPPORTED_STELLAR_ASSETS);
};
