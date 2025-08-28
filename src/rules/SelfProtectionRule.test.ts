import { describe, it, expect, beforeEach } from 'vitest';
import { SelfProtectionRule } from './SelfProtectionRule';
import { RuleContext } from '../core/types';

describe('SelfProtectionRule', () => {
  let rule: SelfProtectionRule;
  let baseContext: RuleContext;
  const ourWallet = '0x456';

  beforeEach(() => {
    rule = new SelfProtectionRule();
    baseContext = {
      auction: {
        currentPrice: 10000n,
        currentLeader: ourWallet,
        leaderAmount: 10000n,
        leaderTimestamp: 1000n,
        isAuctionPhase: true,
        auctionMaxFactor: 1.2
      },
      bgtRewards: {
        bgtPerSecond: 100n,
        totalAccumulated: 10500n,
        timeElapsed: 105
      },
      profit: {
        returnPercentage: 105,
        profitPercentage: 5,
        netProfit: 500n,
        breakEvenTime: 100,
        timeToProfit: { 5: 0 } // Already at 5%
      },
      wallet: {
        address: ourWallet,
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
        ourWallets: new Set([ourWallet.toLowerCase()])
      }
    };
  });

  it('should have correct name and priority', () => {
    expect(rule.name).toBe('SelfProtection');
    expect(rule.priority).toBe(70);
  });

  it('should trigger when own wallet at threshold', () => {
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
    expect(decision!.reason).toContain('Securing own profits at 5.0%');
    expect(decision!.suggestedGasMultiplier).toBe(1.3);
  });

  it('should trigger when approaching threshold within buffer', () => {
    baseContext.profit.profitPercentage = 4.5;
    baseContext.profit.timeToProfit[5] = 2; // 2 seconds to threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
  });

  it('should not trigger for non-owned wallet', () => {
    baseContext.auction.currentLeader = '0x999';
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });

  it('should not trigger when below threshold and outside buffer', () => {
    baseContext.profit.profitPercentage = 3;
    baseContext.profit.timeToProfit[5] = 100; // Far from threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });
});