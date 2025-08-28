import { describe, it, expect, beforeEach } from 'vitest';
import { BGTEqualsCurrentPriceRule } from './BGTEqualsCurrentPriceRule';
import { RuleContext } from '../core/types';

describe('BGTEqualsCurrentPriceRule', () => {
  let rule: BGTEqualsCurrentPriceRule;
  let baseContext: RuleContext;

  beforeEach(() => {
    rule = new BGTEqualsCurrentPriceRule(0); // 0% buffer for tests
    baseContext = {
      auction: {
        currentPrice: 10000n,
        currentLeader: '0x123',
        leaderAmount: 10000n,
        leaderTimestamp: 1000n,
        isAuctionPhase: true,
        auctionMaxFactor: 1.2
      },
      bgtRewards: {
        bgtPerSecond: 100n,
        totalAccumulated: 5000n,
        timeElapsed: 50
      },
      profit: {
        returnPercentage: 50,
        profitPercentage: -50,
        netProfit: -5000n,
        breakEvenTime: 100,
        timeToProfit: {}
      },
      wallet: {
        address: '0x456',
        privateKey: 'key',
        isOurWallet: true
      },
      config: {
        othersProfitThreshold: 2,
        selfProfitThreshold: 5,
        blacklistProfitThreshold: -5,
        snipeBufferSeconds: 3,
        blacklistedAddresses: new Set(),
        maxAuctionFactor: 1.4,
        ourWallets: new Set(['0x456'])
      }
    };
  });

  it('should have correct name and high priority', () => {
    expect(rule.name).toBe('BGTEqualsCurrentPrice');
    expect(rule.priority).toBe(100);
  });

  it('should trigger when BGT equals current price', () => {
    baseContext.bgtRewards.totalAccumulated = 10000n; // Exactly equals price
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
    expect(decision!.reason).toContain('BGT earnings (10000) >= current price (10000)');
    expect(decision!.priority).toBe(100);
    expect(decision!.suggestedGasMultiplier).toBe(1.5);
  });

  it('should trigger when BGT exceeds current price', () => {
    baseContext.bgtRewards.totalAccumulated = 15000n; // 150% of price
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
    expect(decision!.metadata?.ratio).toBe(1.5);
  });

  it('should not trigger when BGT is less than current price', () => {
    baseContext.bgtRewards.totalAccumulated = 9999n; // Just below price
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });

  it('should include metadata with decision', () => {
    baseContext.bgtRewards.totalAccumulated = 12000n;
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision!.metadata).toEqual({
      bgtEarned: '12000',
      currentPrice: '10000',
      ratio: 1.2
    });
  });

  it('should handle edge case of zero price', () => {
    baseContext.auction.currentPrice = 0n;
    baseContext.bgtRewards.totalAccumulated = 1n;
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
  });
});