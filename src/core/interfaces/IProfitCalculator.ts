import { AuctionState, BGTRewards, ProfitMetrics } from '../types';

export interface IProfitCalculator {
  calculateBGTRewards(
    bgtPerSecond: bigint,
    leaderTimestamp: bigint,
    currentTimestamp: bigint
  ): BGTRewards;

  calculateProfitMetrics(
    currentPrice: bigint,
    bgtRewards: BGTRewards
  ): ProfitMetrics;

  timeToProfit(
    currentPrice: bigint,
    bgtPerSecond: bigint,
    targetProfitPercentage: number
  ): number;
}