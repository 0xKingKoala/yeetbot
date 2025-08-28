import { describe, it, expect, beforeEach } from 'vitest';
import { BlacklistRule } from './BlacklistRule';
import { RuleContext } from '../core/types';

describe('BlacklistRule', () => {
  let rule: BlacklistRule;
  let baseContext: RuleContext;
  const blacklistedAddress = '0x40040aa6bd48943BcE71432CF48F1398aDBD5269';

  beforeEach(() => {
    rule = new BlacklistRule();
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
        blacklistedAddresses: new Set([blacklistedAddress.toLowerCase()]),
        maxAuctionFactor: 1.4,
        ourWallets: new Set(['0x456'])
      }
    };
  });

  it('should have correct name and priority', () => {
    expect(rule.name).toBe('Blacklist');
    expect(rule.priority).toBe(80);
  });

  it('should trigger for blacklisted address at threshold', () => {
    baseContext.auction.currentLeader = blacklistedAddress;
    baseContext.profit.profitPercentage = -5; // Exactly at threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
    expect(decision!.reason).toContain('Blacklisted address at -5.0% profit');
    expect(decision!.suggestedGasMultiplier).toBe(1.5);
  });

  it('should trigger for blacklisted address above threshold', () => {
    baseContext.auction.currentLeader = blacklistedAddress.toUpperCase(); // Test case insensitivity
    baseContext.profit.profitPercentage = -2; // Above -5% threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).not.toBeNull();
    expect(decision!.shouldYeet).toBe(true);
  });

  it('should not trigger for blacklisted address below threshold', () => {
    baseContext.auction.currentLeader = blacklistedAddress;
    baseContext.profit.profitPercentage = -10; // Below -5% threshold
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });

  it('should not trigger for non-blacklisted address', () => {
    baseContext.auction.currentLeader = '0x999'; // Not blacklisted
    baseContext.profit.profitPercentage = 0; // Would trigger if blacklisted
    
    const decision = rule.evaluate(baseContext);
    
    expect(decision).toBeNull();
  });
});