import * as StellarSDK from '@stellar/stellar-sdk';

export interface SupportedCurrency {
  code: string;
  name: string;
  tokenAddress: string;
  decimals: number;
}

type NetworkCurrencies = Record<string, SupportedCurrency>;

/**
 * Supported currencies per network
 */
const NETWORK_CURRENCIES: Record<string, NetworkCurrencies> = {
  [StellarSDK.Networks.TESTNET]: {
    USDC: {
      code: 'USDC',
      name: 'USD Coin',
      tokenAddress: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      decimals: 7,
    },
    XLM: {
      code: 'XLM',
      name: 'Stellar Lumens',
      tokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      decimals: 7,
    },
    EURC: {
      code: 'EURC',
      name: 'Euro Coin',
      tokenAddress: 'CCVVQCBPH7VJQZLQKLVTXVXBMUYLKONUYT3YZFVBCTJXZQMQ7QQQQQQQ',
      decimals: 7,
    },
  },
  [StellarSDK.Networks.PUBLIC]: {
    USDC: {
      code: 'USDC',
      name: 'USD Coin',
      tokenAddress: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
      decimals: 7,
    },
    XLM: {
      code: 'XLM',
      name: 'Stellar Lumens',
      tokenAddress: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
      decimals: 7,
    },
    EURC: {
      code: 'EURC',
      name: 'Euro Coin',
      tokenAddress: 'CDD4JW7FWJQPVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
      decimals: 7,
    },
  },
};

// Deprecated: Use network-aware functions instead
export const SUPPORTED_CURRENCIES: Record<string, SupportedCurrency> =
  NETWORK_CURRENCIES[StellarSDK.Networks.TESTNET];

/**
 * Get token address for a given currency code on a specific network
 * @param currencyCode - The currency code (e.g., 'USDC', 'XLM')
 * @param networkPassphrase - The Stellar network passphrase
 * @returns The token contract address
 * @throws Error if currency is not supported on the network
 */
export function getTokenAddress(
  currencyCode: string,
  networkPassphrase: string = StellarSDK.Networks.TESTNET,
): string {
  const networkCurrencies = NETWORK_CURRENCIES[networkPassphrase];
  if (!networkCurrencies) {
    throw new Error(`Unsupported network: ${networkPassphrase}`);
  }

  const currency = networkCurrencies[currencyCode.toUpperCase()];
  if (!currency) {
    throw new Error(
      `Unsupported currency: ${currencyCode} on network ${networkPassphrase}. Supported currencies: ${Object.keys(networkCurrencies).join(', ')}`,
    );
  }
  return currency.tokenAddress;
}

/**
 * Get all supported currencies for a specific network
 * @param networkPassphrase - The Stellar network passphrase
 * @returns Array of supported currencies
 */
export function getSupportedCurrencies(
  networkPassphrase: string = StellarSDK.Networks.TESTNET,
): SupportedCurrency[] {
  const networkCurrencies = NETWORK_CURRENCIES[networkPassphrase];
  if (!networkCurrencies) {
    throw new Error(`Unsupported network: ${networkPassphrase}`);
  }
  return Object.values(networkCurrencies);
}

/**
 * Check if a currency is supported on a specific network
 * @param currencyCode - The currency code to check
 * @param networkPassphrase - The Stellar network passphrase
 * @returns True if the currency is supported
 */
export function isCurrencySupported(
  currencyCode: string,
  networkPassphrase: string = StellarSDK.Networks.TESTNET,
): boolean {
  const networkCurrencies = NETWORK_CURRENCIES[networkPassphrase];
  if (!networkCurrencies) {
    return false;
  }
  return currencyCode.toUpperCase() in networkCurrencies;
}

/**
 * Get currency details for a specific network
 * @param currencyCode - The currency code
 * @param networkPassphrase - The Stellar network passphrase
 * @returns The currency details
 * @throws Error if currency is not supported on the network
 */
export function getCurrency(
  currencyCode: string,
  networkPassphrase: string = StellarSDK.Networks.TESTNET,
): SupportedCurrency {
  const networkCurrencies = NETWORK_CURRENCIES[networkPassphrase];
  if (!networkCurrencies) {
    throw new Error(`Unsupported network: ${networkPassphrase}`);
  }

  const currency = networkCurrencies[currencyCode.toUpperCase()];
  if (!currency) {
    throw new Error(
      `Unsupported currency: ${currencyCode} on network ${networkPassphrase}`,
    );
  }
  return currency;
}
