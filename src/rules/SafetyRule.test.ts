import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyRule } from './SafetyRule';
import { RuleContext } from '../core/types';

describe('SafetyRule', () => {
  let rule: SafetyRule;
  let baseContext: RuleContext;

  beforeEach(() => {
    rule = new SafetyRule();
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

  it('should have correct name and priority', () => {
    expect(rule.name).toBe('Safety');
    expect(rule.priority).toBe(90);
  });

  it('should block when auctionMaxFactor exceeds threshold', () => {
    baseContext.auction.auctionMaxFactor = 1.5; // Above 1.4 threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(false);
    expect(decision!.reason).toContain('Safety threshold exceeded: auctionMaxFactor 1.5 > 1.4');
    expect(decision!.metadata?.alertCode).toBe('YM-003');
  });

  it('should not block when auctionMaxFactor is within threshold', () => {
    baseContext.auction.auctionMaxFactor = 1.3; // Below 1.4 threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });

  it('should not block when auctionMaxFactor equals threshold', () => {
    baseContext.auction.auctionMaxFactor = 1.4; // Exactly at threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });
});