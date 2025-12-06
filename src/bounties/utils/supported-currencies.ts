export interface SupportedCurrency {
  code: string;
  name: string;
  tokenAddress: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: Record<string, SupportedCurrency> = {
  USDC: {
    code: 'USDC',
    name: 'USD Coin',
    tokenAddress: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA', // Stellar USDC testnet
    decimals: 7,
  },
  XLM: {
    code: 'XLM',
    name: 'Stellar Lumens',
    tokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', // Native XLM wrapped
    decimals: 7,
  },
  EURC: {
    code: 'EURC',
    name: 'Euro Coin',
    tokenAddress: 'CCVVQCBPH7VJQZLQKLVTXVXBMUYLKONUYT3YZFVBCTJXZQMQ7QQQQQQQ', // Example EURC address
    decimals: 7,
  },
};

/**
 * Get token address for a given currency code
 * @param currencyCode - The currency code (e.g., 'USDC', 'XLM')
 * @returns The token contract address
 * @throws Error if currency is not supported
 */
export function getTokenAddress(currencyCode: string): string {
  const currency = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()];
  if (!currency) {
    throw new Error(
      `Unsupported currency: ${currencyCode}. Supported currencies: ${Object.keys(SUPPORTED_CURRENCIES).join(', ')}`,
    );
  }
  return currency.tokenAddress;
}

/**
 * Get all supported currencies
 * @returns Array of supported currencies
 */
export function getSupportedCurrencies(): SupportedCurrency[] {
  return Object.values(SUPPORTED_CURRENCIES);
}

/**
 * Check if a currency is supported
 * @param currencyCode - The currency code to check
 * @returns True if the currency is supported
 */
export function isCurrencySupported(currencyCode: string): boolean {
  return currencyCode.toUpperCase() in SUPPORTED_CURRENCIES;
}
