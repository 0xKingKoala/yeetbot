import { describe, it, expect, beforeEach } from 'vitest';
import { ProfitCalculator } from './ProfitCalculator';

describe('ProfitCalculator', () => {
  let calculator: ProfitCalculator;

  beforeEach(() => {
    calculator = new ProfitCalculator();
  });

  describe('calculateBGTRewards', () => {
    it('should calculate BGT rewards correctly', () => {
      const bgtPerSecond = 100n; // 100 BGT per second
      const leaderTimestamp = 1000n;
      const currentTimestamp = 1120n; // 120 seconds elapsed

      const rewards = calculator.calculateBGTRewards(
        bgtPerSecond,
        leaderTimestamp,
        currentTimestamp
      );

      // Expected: 120s elapsed + 60s auction = 180s total * 100 BGT/s = 18000 BGT
      expect(rewards.bgtPerSecond).toBe(100n);
      expect(rewards.totalAccumulated).toBe(18000n);
      expect(rewards.timeElapsed).toBe(120);
    });

    it('should cap auction time at 60 seconds for short durations', () => {
      const bgtPerSecond = 100n;
      const leaderTimestamp = 1000n;
      const currentTimestamp = 1030n; // 30 seconds elapsed

      const rewards = calculator.calculateBGTRewards(
        bgtPerSecond,
        leaderTimestamp,
        currentTimestamp
      );

      // Expected: 30s elapsed + 30s auction (capped) = 60s total * 100 BGT/s = 6000 BGT
      expect(rewards.totalAccumulated).toBe(6000n);
      expect(rewards.timeElapsed).toBe(30);
    });
  });

  describe('calculateProfitMetrics', () => {
    it('should calculate profit metrics correctly', () => {
      const currentPrice = 10000n;
      const bgtRewards = {
        bgtPerSecond: 100n,
        totalAccumulated: 12000n,
        timeElapsed: 120
      };

      const metrics = calculator.calculateProfitMetrics(currentPrice, bgtRewards);

      expect(metrics.netProfit).toBe(2000n); // 12000 - 10000
      expect(metrics.returnPercentage).toBe(120); // (12000/10000) * 100
      expect(metrics.profitPercentage).toBe(20); // (2000/10000) * 100
      expect(metrics.breakEvenTime).toBe(100); // 10000 / 100
    });

    it('should handle zero price gracefully', () => {
      const currentPrice = 0n;
      const bgtRewards = {
        bgtPerSecond: 100n,
        totalAccumulated: 1000n,
        timeElapsed: 10
      };

      const metrics = calculator.calculateProfitMetrics(currentPrice, bgtRewards);

      expect(metrics.returnPercentage).toBe(0);
      expect(metrics.profitPercentage).toBe(0);
      expect(metrics.breakEvenTime).toBe(0);
    });

    it('should calculate time to profit thresholds', () => {
      const currentPrice = 10000n;
      const bgtRewards = {
        bgtPerSecond: 100n,
        totalAccumulated: 10000n,
        timeElapsed: 100
      };

      const metrics = calculator.calculateProfitMetrics(currentPrice, bgtRewards);

      // -5% profit: need 9500 BGT total = 95 seconds - 60 auction = 35 seconds
      expect(metrics.timeToProfit[-5]).toBe(35);
      
      // 0% profit: need 10000 BGT total = 100 seconds - 60 auction = 40 seconds
      expect(metrics.timeToProfit[0]).toBe(40);
      
      // 5% profit: need 10500 BGT total = 105 seconds - 60 auction = 45 seconds
      expect(metrics.timeToProfit[5]).toBe(45);
    });
  });

  describe('timeToProfit', () => {
    it('should calculate time to reach target profit', () => {
      const currentPrice = 10000n;
      const bgtPerSecond = 100n;

      // 10% profit: need 11000 BGT = 110 seconds - 60 auction = 50 seconds
      const time = calculator.timeToProfit(currentPrice, bgtPerSecond, 10);
      expect(time).toBe(50);
    });

    it('should return 0 for negative times', () => {
      const currentPrice = 1000n;
      const bgtPerSecond = 100n;

      // -50% profit: need 500 BGT = 5 seconds - 60 auction = -55 (clamped to 0)
      const time = calculator.timeToProfit(currentPrice, bgtPerSecond, -50);
      expect(time).toBe(0);
    });

    it('should return Infinity for zero BGT per second', () => {
      const currentPrice = 10000n;
      const bgtPerSecond = 0n;

      const time = calculator.timeToProfit(currentPrice, bgtPerSecond, 10);
      expect(time).toBe(Infinity);
    });
  });
});