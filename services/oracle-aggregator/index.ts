/**
 * Oracle Aggregator Service
 * 
 * Provides multi-source price consensus for settlement-grade accuracy.
 * Implements retry tolerance and failure cancellation as per whitepaper.
 */

export interface PriceObservation {
  source: string;
  price: number;
  timestamp: number;
}

export interface OracleConsensus {
  price: number;
  timestamp: number;
  observations: PriceObservation[];
  consensusType: 'MEDIAN' | 'MEAN' | 'VOID';
}

export interface OracleConfig {
  primarySources: string[]; // e.g., ['binance', 'okx']
  fallbackSources: string[];
  retryWindow: number; // milliseconds
  maxRetries: number;
  consensusThreshold: number; // percentage deviation allowed
}

export class OracleAggregator {
  private config: OracleConfig;
  private priceCache: Map<string, PriceObservation> = new Map();
  private observationHistory: PriceObservation[] = [];

  constructor(config: OracleConfig) {
    this.config = config;
  }

  /**
   * Fetch price from Binance API
   */
  private async fetchBinancePrice(symbol: string = 'BTCUSDT'): Promise<number> {
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await response.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error('Binance price fetch failed:', error);
      throw new Error('Binance fetch failed');
    }
  }

  /**
   * Fetch price from OKX API
   */
  private async fetchOKXPrice(symbol: string = 'BTC-USDT'): Promise<number> {
    try {
      const response = await fetch(
        `https://www.okx.com/api/v5/market/ticker?instId=${symbol}`
      );
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        return parseFloat(data.data[0].last);
      }
      throw new Error('OKX response invalid');
    } catch (error) {
      console.error('OKX price fetch failed:', error);
      throw new Error('OKX fetch failed');
    }
  }

  /**
   * Fetch price from a specific source
   */
  private async fetchPriceFromSource(
    source: string,
    symbol: string
  ): Promise<PriceObservation | null> {
    try {
      let price: number;

      if (source === 'binance') {
        price = await this.fetchBinancePrice(symbol);
      } else if (source === 'okx') {
        price = await this.fetchOKXPrice(symbol);
      } else {
        throw new Error(`Unknown source: ${source}`);
      }

      const observation: PriceObservation = {
        source,
        price,
        timestamp: Date.now(),
      };

      this.priceCache.set(source, observation);
      this.observationHistory.push(observation);
      return observation;
    } catch (error) {
      console.error(`Failed to fetch from ${source}:`, error);
      return null;
    }
  }

  /**
   * Fetch prices from all primary sources with retry logic
   */
  private async fetchPricesWithRetry(
    symbol: string,
    attempt: number = 0
  ): Promise<PriceObservation[]> {
    const observations: PriceObservation[] = [];

    for (const source of this.config.primarySources) {
      const observation = await this.fetchPriceFromSource(source, symbol);
      if (observation) {
        observations.push(observation);
      }
    }

    // If we don't have enough observations and haven't exceeded retry limit, retry
    if (
      observations.length < this.config.primarySources.length &&
      attempt < this.config.maxRetries
    ) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.retryWindow / this.config.maxRetries)
      );
      const retryObservations = await this.fetchPricesWithRetry(symbol, attempt + 1);
      observations.push(...retryObservations);
    }

    return observations;
  }

  /**
   * Calculate consensus price from observations
   */
  private calculateConsensus(observations: PriceObservation[]): OracleConsensus {
    if (observations.length === 0) {
      return {
        price: 0,
        timestamp: Date.now(),
        observations: [],
        consensusType: 'VOID',
      };
    }

    // Sort prices for median calculation
    const prices = observations.map((o) => o.price).sort((a, b) => a - b);

    // Calculate median
    const median =
      prices.length % 2 === 0
        ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
        : prices[Math.floor(prices.length / 2)];

    // Check for consensus deviation
    const maxDeviation = (this.config.consensusThreshold / 100) * median;
    const allWithinThreshold = prices.every(
      (p) => Math.abs(p - median) <= maxDeviation
    );

    if (!allWithinThreshold) {
      console.warn('Oracle consensus failed: prices deviate beyond threshold');
      return {
        price: 0,
        timestamp: Date.now(),
        observations,
        consensusType: 'VOID',
      };
    }

    // Calculate mean for additional validation
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;

    return {
      price: median,
      timestamp: Date.now(),
      observations,
      consensusType: 'MEDIAN',
    };
  }

  /**
   * Get consensus price with fallback logic
   */
  async getConsensusPrice(symbol: string): Promise<OracleConsensus> {
    // Fetch from primary sources
    let observations = await this.fetchPricesWithRetry(symbol);

    // If primary sources failed, try fallback sources
    if (observations.length === 0) {
      console.warn('Primary sources failed, attempting fallback sources');
      for (const source of this.config.fallbackSources) {
        const observation = await this.fetchPriceFromSource(source, symbol);
        if (observation) {
          observations.push(observation);
        }
      }
    }

    // Calculate and return consensus
    return this.calculateConsensus(observations);
  }

  /**
   * Get observation history for audit purposes
   */
  getObservationHistory(limit: number = 100): PriceObservation[] {
    return this.observationHistory.slice(-limit);
  }

  /**
   * Clear observation history (for testing or maintenance)
   */
  clearObservationHistory(): void {
    this.observationHistory = [];
  }
}

/**
 * Factory function to create a default OracleAggregator instance
 */
export function createDefaultOracleAggregator(): OracleAggregator {
  const config: OracleConfig = {
    primarySources: ['binance', 'okx'],
    fallbackSources: ['coingecko'],
    retryWindow: 5000, // 5 seconds
    maxRetries: 3,
    consensusThreshold: 2, // 2% deviation allowed
  };

  return new OracleAggregator(config);
}
