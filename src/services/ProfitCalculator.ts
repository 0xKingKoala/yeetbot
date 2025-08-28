import { IProfitCalculator } from '../core/interfaces/IProfitCalculator';
import { BGTRewards, ProfitMetrics } from '../core/types';
import { BASIS_POINTS } from '../core/constants';
import { Config } from '../config/Config';

export class ProfitCalculator implements IProfitCalculator {
  private readonly MAX_SAFE_NUMBER = BigInt(Number.MAX_SAFE_INTEGER);
  private readonly MIN_SAFE_NUMBER = BigInt(Number.MIN_SAFE_INTEGER);
  private config = Config.getInstance().get();

  /**
   * Safely convert BigInt to Number with bounds checking
   */
  private safeToNumber(value: bigint): number {
    if (value > this.MAX_SAFE_NUMBER) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (value < this.MIN_SAFE_NUMBER) {
      return Number.MIN_SAFE_INTEGER;
    }
    return Number(value);
  }

  /**
   * Safely divide two BigInts and return a Number
   */
  private safeDivideToNumber(numerator: bigint, denominator: bigint): number {
    if (denominator === 0n) {
      return numerator > 0n ? Infinity : (numerator < 0n ? -Infinity : 0);
    }
    const result = numerator / denominator;
    return this.safeToNumber(result);
  }

  calculateBGTRewards(
    bgtPerSecond: bigint,
    leaderTimestamp: bigint,
    currentTimestamp: bigint
  ): BGTRewards {
    const timeElapsed = this.safeToNumber(currentTimestamp - leaderTimestamp);
    const auctionTime = Math.min(timeElapsed, this.config.strategy.expectedAuctionDuration);
    
    // Total BGT = BGT per second * (time as leader + expected auction time)
    const totalSeconds = BigInt(timeElapsed + auctionTime);
    const totalAccumulated = bgtPerSecond * totalSeconds;

    return {
      bgtPerSecond,
      totalAccumulated,
      timeElapsed
    };
  }

  calculateProfitMetrics(
    currentPrice: bigint,
    bgtRewards: BGTRewards
  ): ProfitMetrics {
    const { totalAccumulated } = bgtRewards;
    
    // Net profit = BGT earned - price paid
    const netProfit = totalAccumulated - currentPrice;
    
    // Return % = (BGT earned / price paid) * 100
    const returnPercentage = currentPrice > 0n
      ? this.safeToNumber((totalAccumulated * BigInt(BASIS_POINTS)) / currentPrice) / 100
      : 0;
    
    // Profit % = ((BGT earned - price paid) / price paid) * 100
    const profitPercentage = currentPrice > 0n
      ? this.safeToNumber((netProfit * BigInt(BASIS_POINTS)) / currentPrice) / 100
      : 0;
    
    // Break even time (when BGT earned = price paid)
    const breakEvenTime = bgtRewards.bgtPerSecond > 0n
      ? this.safeDivideToNumber(currentPrice, bgtRewards.bgtPerSecond)
      : Infinity;
    
    // Time to various profit thresholds
    const timeToProfit: Record<number, number> = {};
    const thresholds = this.config.strategy.profitThresholds || [0, 10, 20, 40, 60];
    for (const threshold of thresholds) {
      timeToProfit[threshold] = this.timeToProfit(
        currentPrice,
        bgtRewards.bgtPerSecond,
        threshold
      );
    }

    return {
      returnPercentage,
      profitPercentage,
      netProfit,
      breakEvenTime,
      timeToProfit
    };
  }

  timeToProfit(
    currentPrice: bigint,
    bgtPerSecond: bigint,
    targetProfitPercentage: number
  ): number {
    // Early return for edge cases
    if (bgtPerSecond === 0n) return Infinity;
    if (currentPrice === 0n) return 0;
    
    // Required BGT = price * (1 + profit%)
    const requiredMultiplier = BigInt(Math.floor((1 + targetProfitPercentage / 100) * BASIS_POINTS));
    const requiredBGT = (currentPrice * requiredMultiplier) / BigInt(BASIS_POINTS);
    
    // Time = required BGT / BGT per second (with safe division)
    const timeRequired = this.safeDivideToNumber(requiredBGT, bgtPerSecond);
    
    // Account for auction duration in the calculation
    // Actual time = (required BGT / BGT per second) - auction duration
    const adjustedTime = timeRequired - this.config.strategy.expectedAuctionDuration;
    
    return Math.max(0, adjustedTime);
  }
}