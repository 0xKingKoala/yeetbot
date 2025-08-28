import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionEngine } from './services/DecisionEngine';
import { ProfitCalculator } from './services/ProfitCalculator';
import { BGTEqualsCurrentPriceRule } from './rules/BGTEqualsCurrentPriceRule';
import { SafetyRule } from './rules/SafetyRule';
import { BlacklistRule } from './rules/BlacklistRule';
import { SelfProtectionRule } from './rules/SelfProtectionRule';
import { StandardSnipeRule } from './rules/StandardSnipeRule';
import { RuleContext, RuleConfig } from './core/types';

describe('Decision Flow Integration', () => {
  let engine: DecisionEngine;
  let calculator: ProfitCalculator;
  let config: RuleConfig;
  const blacklistedAddress = '0x40040aa6bd48943BcE71432CF48F1398aDBD5269';
  const ourWallet = '0x456';

  beforeEach(() => {
    engine = new DecisionEngine();
    calculator = new ProfitCalculator();
    
    config = {
      othersProfitThreshold: 2,
      selfProfitThreshold: 5,
      blacklistProfitThreshold: -5,
      snipeBufferSeconds: 3,
      blacklistedAddresses: new Set([blacklistedAddress.toLowerCase()]),
      maxAuctionFactor: 1.4,
      ourWallets: new Set([ourWallet.toLowerCase()])
    };

    // Add all rules
    engine.addRule(new BGTEqualsCurrentPriceRule(0)); // 0% buffer for tests
    engine.addRule(new SafetyRule());
    engine.addRule(new BlacklistRule());
    engine.addRule(new SelfProtectionRule());
    engine.addRule(new StandardSnipeRule());
  });

  function createContext(overrides: Partial<{
    currentPrice: bigint;
    currentLeader: string;
    auctionMaxFactor: number;
    totalAccumulated: bigint;
    bgtPerSecond: bigint;
  }> = {}): RuleContext {
    const currentPrice = overrides.currentPrice || 10000n;
    const bgtPerSecond = overrides.bgtPerSecond || 100n;
    const totalAccumulated = overrides.totalAccumulated || 5000n;
    
    const bgtRewards = {
      bgtPerSecond,
      totalAccumulated,
      timeElapsed: 50
    };
    
    const profit = calculator.calculateProfitMetrics(currentPrice, bgtRewards);
    
    return {
      auction: {
        currentPrice,
        currentLeader: overrides.currentLeader || '0x123',
        leaderAmount: currentPrice,
        leaderTimestamp: 1000n,
        isAuctionPhase: true,
        auctionMaxFactor: overrides.auctionMaxFactor || 1.2
      },
      bgtRewards,
      profit,
      wallet: {
        address: ourWallet,
        privateKey: 'key',
        isOurWallet: true
      },
      config
    };
  }

  describe('Priority Rules', () => {
    it('BGT equals price rule should override all others', () => {
      const context = createContext({
        currentPrice: 10000n,
        totalAccumulated: 10000n // BGT exactly equals price
      });
      
      const decision = engine.evaluate(context);
      
      expect(decision.shouldYeet).toBe(true);
      expect(decision.reason).toContain('BGT earnings');
      expect(decision.priority).toBe(100);
    });

    it('Safety rule should block all yeets', () => {
      const context = createContext({
        currentPrice: 10000n,
        totalAccumulated: 15000n, // Would trigger BGT rule
        auctionMaxFactor: 1.5 // Exceeds safety threshold
      });
      
      const decision = engine.evaluate(context);
      
      expect(decision.shouldYeet).toBe(false);
      expect(decision.reason).toContain('Safety threshold exceeded');
      expect(decision.priority).toBe(90);
    });
  });

  describe('Blacklist Scenarios', () => {
    it('should snipe blacklisted address at -5% profit', () => {
      const context = createContext({
        currentLeader: blacklistedAddress,
        currentPrice: 10000n,
        totalAccumulated: 9500n // Exactly -5% profit
      });
      
      const decision = engine.evaluate(context);
      
      expect(decision.shouldYeet).toBe(true);
      expect(decision.reason).toContain('Blacklisted address');
      expect(decision.priority).toBe(80);
    });

    it('should not snipe blacklisted address below threshold', () => {
      const context = createContext({
        currentLeader: blacklistedAddress,
        currentPrice: 10000n,
        totalAccumulated: 9000n // -10% profit, below -5% threshold
      });
      
      const decision = engine.evaluate(context);
      
      expect(decision.shouldYeet).toBe(false);
      expect(decision.reason).toBe('No rules triggered');
    });
  });

  describe('Self Protection Scenarios', () => {
    it('should protect own wallet at 5% profit threshold', () => {
      const context = createContext({
        currentLeader: ourWallet,
        currentPrice: 15000n, // Higher price
        totalAccumulated: 9750n, // 65% return but BGT < price, so BGT rule won't trigger
        bgtPerSecond: 100n
      });
      
      // Override profit calculation to simulate 5% profit scenario
      context.profit.profitPercentage = 5;
      context.profit.timeToProfit[5] = 0; // Already at 5%
      
      const decision = engine.evaluate(context);
      
      expect(decision.shouldYeet).toBe(true);
      expect(decision.reason).toContain('Securing own profits');
      expect(decision.priority).toBe(70);
    });

    it('should not protect own wallet below threshold', () => {
      const context = createContext({
        currentLeader: ourWallet,
        currentPrice: 15000n, // Higher price
        totalAccumulated: 9000n, // BGT < price, won't trigger BGT rule
        bgtPerSecond: 50n
      });
      
      // Override profit to be below threshold
      context.profit.profitPercentage = 2; // Below 5% threshold
      context.profit.timeToProfit[5] = 100; // Far from threshold
      
      const decision = engine.evaluate(context);
      
      expect(decision.shouldYeet).toBe(false);
    });
  });

  describe('Standard Player Scenarios', () => {
    it('should snipe other players at 2% profit', () => {
      const context = createContext({
        currentLeader: '0x999', // Not us, not blacklisted
        currentPrice: 15000n, // Higher price
        totalAccumulated: 9300n, // BGT < price, won't trigger BGT rule
        bgtPerSecond: 100n
      });
      
      // Override profit to be at 2%
      context.profit.profitPercentage = 2;
      
      const decision = engine.evaluate(context);
      
      expect(decision.shouldYeet).toBe(true);
      expect(decision.reason).toContain('Other player');
      expect(decision.priority).toBe(60);
    });

    it('should snipe when approaching threshold within buffer', () => {
      const context = createContext({
        currentLeader: '0x999',
        currentPrice: 15000n, // Higher price  
        totalAccumulated: 9000n, // BGT < price
        bgtPerSecond: 100n
      });
      
      // Set profit below 2% but approaching
      context.profit.profitPercentage = 1;
      context.profit.timeToProfit[2] = 2; // 2 seconds to threshold
      
      const decision = engine.evaluate(context);
      
      expect(decision.shouldYeet).toBe(true);
      expect(decision.priority).toBe(60);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple rules triggering correctly', () => {
      // Blacklisted address with BGT >= price
      const context = createContext({
        currentLeader: blacklistedAddress,
        currentPrice: 10000n,
        totalAccumulated: 12000n // BGT > price AND above blacklist threshold
      });
      
      const decision = engine.evaluate(context);
      
      // BGT rule (priority 100) should win over blacklist (priority 80)
      expect(decision.shouldYeet).toBe(true);
      expect(decision.priority).toBe(100);
      expect(decision.reason).toContain('BGT earnings');
    });

    it('should handle our wallet with BGT >= price', () => {
      const context = createContext({
        currentLeader: ourWallet,
        currentPrice: 10000n,
        totalAccumulated: 11000n // BGT > price
      });
      
      const decision = engine.evaluate(context);
      
      // BGT rule should override self-protection
      expect(decision.shouldYeet).toBe(true);
      expect(decision.priority).toBe(100);
    });
  });
});