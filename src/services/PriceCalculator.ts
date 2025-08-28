import { logger } from '../utils/Logger';

export interface AuctionParameters {
  startPrice: bigint;
  minPrice: bigint;
  auctionDuration: number; // in seconds
  auctionStartTime: Date;
}

export class PriceCalculator {
  private static instance: PriceCalculator;
  
  private constructor() {}
  
  public static getInstance(): PriceCalculator {
    if (!PriceCalculator.instance) {
      PriceCalculator.instance = new PriceCalculator();
    }
    return PriceCalculator.instance;
  }
  
  /**
   * Calculate the current price based on linear decay from startPrice to minPrice
   * over auctionDuration seconds
   */
  public calculateCurrentPrice(params: AuctionParameters): bigint {
    const now = Date.now();
    const auctionStartMs = params.auctionStartTime.getTime();
    const timeElapsedMs = now - auctionStartMs;
    const timeElapsedSeconds = Math.floor(timeElapsedMs / 1000);
    
    // If auction hasn't started yet or negative time, return start price
    if (timeElapsedSeconds <= 0) {
      return params.startPrice;
    }
    
    // If auction duration has passed, return min price
    if (timeElapsedSeconds >= params.auctionDuration) {
      return params.minPrice;
    }
    
    // Calculate linear decay
    // currentPrice = startPrice - ((startPrice - minPrice) * timeElapsed / duration)
    const priceRange = params.startPrice - params.minPrice;
    const priceDecay = (priceRange * BigInt(timeElapsedSeconds)) / BigInt(params.auctionDuration);
    const currentPrice = params.startPrice - priceDecay;
    
    // Ensure price doesn't go below minimum (safety check)
    if (currentPrice < params.minPrice) {
      return params.minPrice;
    }
    
    // Ensure price doesn't exceed start price (safety check)
    if (currentPrice > params.startPrice) {
      return params.startPrice;
    }
    
    return currentPrice;
  }
  
  /**
   * Calculate time remaining until price reaches a target
   */
  public timeUntilPrice(params: AuctionParameters, targetPrice: bigint): number {
    // If target is at or above start price, it's already there
    if (targetPrice >= params.startPrice) {
      return 0;
    }
    
    // If target is at or below min price, calculate time to min
    if (targetPrice <= params.minPrice) {
      const now = Date.now();
      const auctionStartMs = params.auctionStartTime.getTime();
      const auctionEndMs = auctionStartMs + (params.auctionDuration * 1000);
      const timeRemaining = Math.max(0, auctionEndMs - now);
      return Math.floor(timeRemaining / 1000);
    }
    
    // Calculate time for price to decay to target
    // timeForTarget = ((startPrice - targetPrice) * duration) / (startPrice - minPrice)
    const priceRange = params.startPrice - params.minPrice;
    const targetDrop = params.startPrice - targetPrice;
    const timeForTarget = Number((targetDrop * BigInt(params.auctionDuration)) / priceRange);
    
    // Calculate remaining time
    const now = Date.now();
    const auctionStartMs = params.auctionStartTime.getTime();
    const targetTimeMs = auctionStartMs + (timeForTarget * 1000);
    const timeRemaining = Math.max(0, targetTimeMs - now);
    
    return Math.floor(timeRemaining / 1000);
  }
  
  /**
   * Get progress through the auction (0-100%)
   */
  public getAuctionProgress(params: AuctionParameters): number {
    const now = Date.now();
    const auctionStartMs = params.auctionStartTime.getTime();
    const timeElapsedMs = now - auctionStartMs;
    const timeElapsedSeconds = timeElapsedMs / 1000;
    
    if (timeElapsedSeconds <= 0) {
      return 0;
    }
    
    if (timeElapsedSeconds >= params.auctionDuration) {
      return 100;
    }
    
    return (timeElapsedSeconds / params.auctionDuration) * 100;
  }
  
  /**
   * Validate that calculated price matches contract price within tolerance
   */
  public validatePrice(
    calculated: bigint, 
    contract: bigint, 
    tolerancePercent: number = 1
  ): boolean {
    const diff = calculated > contract ? calculated - contract : contract - calculated;
    const tolerance = (contract * BigInt(tolerancePercent)) / 100n;
    
    if (diff > tolerance) {
      logger.warn('Price calculation mismatch', {
        calculated: calculated.toString(),
        contract: contract.toString(),
        difference: diff.toString(),
        tolerance: tolerance.toString()
      });
      return false;
    }
    
    return true;
  }
}