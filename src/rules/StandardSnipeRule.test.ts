import { describe, it, expect, beforeEach } from 'vitest';
import { StandardSnipeRule } from './StandardSnipeRule';
import { RuleContext } from '../core/types';

describe('StandardSnipeRule', () => {
  let rule: StandardSnipeRule;
  let baseContext: RuleContext;

  beforeEach(() => {
    rule = new StandardSnipeRule();
    baseContext = {
      auction: {
        currentPrice: 10000n,
        currentLeader: '0x999', // Not our wallet, not blacklisted
        leaderAmount: 10000n,
        leaderTimestamp: 1000n,
        isAuctionPhase: true,
        auctionMaxFactor: 1.2
      },
      bgtRewards: {
        bgtPerSecond: 100n,
        totalAccumulated: 10200n,
        timeElapsed: 102
      },
      profit: {
        returnPercentage: 102,
        profitPercentage: 2,
        netProfit: 200n,
        breakEvenTime: 100,
        timeToProfit: { 2: 0 } // Already at 2%
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
        blacklistedAddresses: new Set(['0xblacklisted'.toLowerCase()]),
        maxAuctionFactor: 1.4,
        ourWallets: new Set(['0x456'.toLowerCase()])
      }
    };
  });

  it('should have correct name and priority', () => {
    expect(rule.name).toBe('StandardSnipe');
    expect(rule.priority).toBe(60);
  });

  it('should trigger at profit threshold', () => {
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
    expect(decision!.reason).toContain('Other player at 2.0% profit');
    expect(decision!.suggestedGasMultiplier).toBe(1.5);
  });

  it('should trigger when approaching threshold within buffer', () => {
    baseContext.profit.profitPercentage = 1.5;
    baseContext.profit.timeToProfit[2] = 2; // 2 seconds to threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
  });

  it('should not trigger for our wallet', () => {
    baseContext.auction.currentLeader = '0x456';
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });

  it('should not trigger for blacklisted wallet', () => {
    baseContext.auction.currentLeader = '0xblacklisted';
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });

  it('should not trigger below threshold and outside buffer', () => {
    baseContext.profit.profitPercentage = 0.5;
    baseContext.profit.timeToProfit[2] = 100; // Far from threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });
});