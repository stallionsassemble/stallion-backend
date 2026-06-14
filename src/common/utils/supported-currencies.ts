import * as StellarSDK from '@stellar/stellar-sdk';

export interface SupportedCurrency {
  code: string;
  name: string;
  tokenAddress: string;
  issuer: string;
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
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      decimals: 7,
    },
    XLM: {
      code: 'XLM',
      name: 'Stellar Lumens',
      tokenAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      issuer: 'native',
      decimals: 7,
    },
    EURC: {
      code: 'EURC',
      name: 'Euro Coin',
      tokenAddress: 'CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ',
      issuer: 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
      decimals: 7,
    },
  },
  [StellarSDK.Networks.PUBLIC]: {
    USDC: {
      code: 'USDC',
      name: 'USD Coin',
      tokenAddress: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      decimals: 7,
    },
    USDGLO: {
      code: 'USDGLO',
      name: 'Global Dollar',
      tokenAddress: 'CB226ZOEYXTBPD3QEGABTJYSKZVBP2PASEISLG3SBMTN5CE4QZUVZ3CE',
      issuer: 'GBBS25EGYQPGEZCGCFBKG4OAGFXU6DSOQBGTHELLJT3HZXZJ34HWS6XV',
      decimals: 7,
    },
    XLM: {
      code: 'XLM',
      name: 'Stellar Lumens',
      tokenAddress: 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA',
      issuer: 'native',
      decimals: 7,
    },
    EURC: {
      code: 'EURC',
      name: 'Euro Coin',
      tokenAddress: 'CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV',
      issuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
      decimals: 7,
    },
  },
};

/**
 * Get token address for a given currency code on a specific network
 * @param currencyCode - The currency code (e.g., 'USDC', 'XLM')
 * @param networkPassphrase - The Stellar network passphrase
 * @returns The token contract address (for Soroban interactions)
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
 * Get issuer address for a given currency code on a specific network
 * @param currencyCode - The currency code (e.g., 'USDC', 'XLM')
 * @param networkPassphrase - The Stellar network passphrase
 * @returns The issuer address (for trustline creation)
 * @throws Error if currency is not supported on the network
 */
export function getIssuerAddress(
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
  return currency.issuer;
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
