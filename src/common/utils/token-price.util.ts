import { Logger } from '@nestjs/common';

const logger = new Logger('TokenPriceUtil');

// Cache for token prices (5 minute TTL)
const priceCache = new Map<string, { price: number; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches the current USD price of a Stellar token
 * @param tokenSymbol - The token symbol (e.g., 'XLM', 'USDC', 'AQUA')
 * @param tokenIssuer - Optional issuer address for non-native tokens
 * @returns The current USD price of the token
 */
export async function getTokenUsdPrice(
  tokenSymbol: string,
  tokenIssuer?: string,
): Promise<number> {
  try {
    // Check cache first
    const cacheKey = `${tokenSymbol}:${tokenIssuer || 'native'}`;
    const cached = priceCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      logger.debug(`Using cached price for ${tokenSymbol}: $${cached.price}`);
      return cached.price;
    }

    // Handle stablecoins - assume 1:1 with USD
    const stablecoins = ['USDC', 'USDT', 'USD'];
    if (stablecoins.includes(tokenSymbol.toUpperCase())) {
      const price = 1.0;
      priceCache.set(cacheKey, {
        price,
        expiresAt: Date.now() + CACHE_TTL,
      });
      return price;
    }

    // For XLM and other tokens, fetch from CoinGecko API
    let price: number;

    if (tokenSymbol.toUpperCase() === 'XLM') {
      price = await fetchCoinGeckoPrice('stellar');
    } else {
      // For other Stellar tokens, try to fetch from CoinGecko
      // This is a simplified approach - in production, you might want to use
      // Stellar DEX aggregators or other price feeds
      logger.warn(
        `Price lookup for ${tokenSymbol} not implemented, defaulting to 0`,
      );
      price = 0;
    }

    // Cache the price
    priceCache.set(cacheKey, {
      price,
      expiresAt: Date.now() + CACHE_TTL,
    });

    logger.log(`Fetched price for ${tokenSymbol}: $${price}`);
    return price;
  } catch (error) {
    logger.error(`Failed to fetch price for ${tokenSymbol}:`, error);
    // Return 0 on error to avoid breaking the application
    return 0;
  }
}

/**
 * Fetches token price from CoinGecko API
 */
async function fetchCoinGeckoPrice(coinId: string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data[coinId]?.usd || 0;
  } catch (error) {
    logger.error(`Failed to fetch from CoinGecko:`, error);
    throw error;
  }
}

/**
 * Calculates the USD value of a token amount
 * @param amount - The token amount (as string to preserve precision)
 * @param tokenSymbol - The token symbol
 * @param tokenIssuer - Optional issuer address
 * @returns The USD value
 */
export async function calculateUsdValue(
  amount: string,
  tokenSymbol: string,
  tokenIssuer?: string,
): Promise<number> {
  const tokenAmount = parseFloat(amount);
  const usdPrice = await getTokenUsdPrice(tokenSymbol, tokenIssuer);
  return tokenAmount * usdPrice;
}

/**
 * Clears the price cache (useful for testing)
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
