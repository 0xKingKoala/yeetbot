import { IRule } from '../core/interfaces/IRule';
import { RuleContext, RuleEvaluation } from '../core/types';
import { validateRuleContext } from '../utils/validation';
import { RULE_PRIORITIES } from '../core/constants';
import { formatEther } from 'viem';

export class BGTEqualsCurrentPriceRule implements IRule {
  name = 'BGTEqualsCurrentPrice';
  priority = RULE_PRIORITIES.BGT_EQUALS_PRICE;
  private profitBuffer: number;

  constructor(profitBuffer: number) {
    // profitBuffer is a percentage (e.g., 5 = 5% buffer)
    // Should be passed from config, not hardcoded
    if (profitBuffer === undefined) {
      throw new Error('BGTEqualsCurrentPriceRule: profitBuffer is required and should come from config');
    }
    this.profitBuffer = Math.max(0, Math.min(100, profitBuffer)); // Clamp between 0-100%
  }

  evaluate(context: RuleContext): RuleEvaluation {
    // Validate context
    validateRuleContext(context);
    
    const { auction, bgtRewards, lastPaidPrice } = context;
    
    // Calculate the minimum BGT required (price + buffer)
    const bufferMultiplier = 1 + (this.profitBuffer / 100);
    const requiredBGT = (auction.currentPrice * BigInt(Math.floor(bufferMultiplier * 10000))) / 10000n;
    
    // Format values for display
    const bgtFormatted = parseFloat(formatEther(bgtRewards.totalAccumulated)).toFixed(4);
    const requiredFormatted = parseFloat(formatEther(requiredBGT)).toFixed(4);
    const priceFormatted = parseFloat(formatEther(auction.currentPrice)).toFixed(4);
    
    // Calculate progress (0-100%)
    const progress = auction.currentPrice > 0n 
      ? Math.min(100, Number((bgtRewards.totalAccumulated * 100n) / requiredBGT))
      : 0;
    
    // Calculate time to target (approximate)
    const bgtNeeded = requiredBGT > bgtRewards.totalAccumulated 
      ? requiredBGT - bgtRewards.totalAccumulated 
      : 0n;
    const timeToTarget = bgtRewards.bgtPerSecond > 0n 
      ? Number(bgtNeeded / bgtRewards.bgtPerSecond)
      : Infinity;
    
    // If BGT accumulated meets or exceeds the required amount (price + buffer), yeet
    if (bgtRewards.totalAccumulated >= requiredBGT) {
      return {
        decision: {
          shouldYeet: true,
          reason: `BGT earnings (${bgtFormatted}) >= required BGT (${requiredFormatted}) [${this.profitBuffer}% buffer]`,
          priority: this.priority,
          ruleName: this.name,
          suggestedGasMultiplier: 1.5, // Use competitive gas to ensure execution
          metadata: {
            bgtEarned: bgtRewards.totalAccumulated.toString(),
            currentPrice: auction.currentPrice.toString(),
            requiredBGT: requiredBGT.toString(),
            profitBuffer: this.profitBuffer,
            ratio: auction.currentPrice > 0n 
              ? Number((bgtRewards.totalAccumulated * 100n) / auction.currentPrice) / 100
              : Infinity,
            meetsRequirement: true
          }
        },
        thoughts: {
          currentValue: `BGT: ${bgtFormatted} BERA`,
          targetValue: `Need: ${requiredFormatted} BERA (price + ${this.profitBuffer}% buffer)`,
          progress: 100,
          reasoning: `BGT accumulated exceeds price with buffer - ready to yeet!`,
          metadata: {
            currentPrice: priceFormatted,
            lastPaidPrice: lastPaidPrice ? formatEther(lastPaidPrice) : null,
            priceVsLastPaid: lastPaidPrice ? `${((auction.currentPrice * 100n / lastPaidPrice) / 100n).toString()}%` : null,
            bgtPerSecond: parseFloat(formatEther(bgtRewards.bgtPerSecond)).toFixed(6),
            timeElapsed: bgtRewards.timeElapsed
          }
        }
      };
    }

    // Not ready to yeet yet - return thoughts about progress
    return {
      decision: null,
      thoughts: {
        currentValue: `BGT: ${bgtFormatted} BERA`,
        targetValue: `Need: ${requiredFormatted} BERA`,
        progress: progress,
        reasoning: timeToTarget < Infinity 
          ? `Accumulating BGT... ${timeToTarget.toFixed(0)}s until target (price + ${this.profitBuffer}% buffer)`
          : `Waiting for BGT to reach price + ${this.profitBuffer}% buffer`,
        metadata: {
          currentPrice: priceFormatted,
          lastPaidPrice: lastPaidPrice ? formatEther(lastPaidPrice) : null,
          priceVsLastPaid: lastPaidPrice && lastPaidPrice > 0n 
            ? `${(Number(auction.currentPrice * 10000n / lastPaidPrice) / 100).toFixed(1)}%` 
            : null,
          bgtNeeded: formatEther(bgtNeeded),
          timeToTarget: timeToTarget < Infinity ? timeToTarget : null,
          bgtPerSecond: parseFloat(formatEther(bgtRewards.bgtPerSecond)).toFixed(6),
          ratio: auction.currentPrice > 0n 
            ? Number((bgtRewards.totalAccumulated * 100n) / auction.currentPrice) / 100
            : 0
        }
      }
    };
  }
}