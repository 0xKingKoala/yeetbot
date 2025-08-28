import { IRule } from '../core/interfaces/IRule';
import { RuleContext, RuleEvaluation } from '../core/types';
import { validateRuleContext } from '../utils/validation';
import { RULE_PRIORITIES } from '../core/constants';
import { formatEther } from 'viem';

/**
 * MarketPriceRule - Triggers when current price drops significantly below last paid price
 * This indicates a good buying opportunity based on what the market has been willing to pay
 */
export class MarketPriceRule implements IRule {
  name = 'MarketPrice';
  priority = RULE_PRIORITIES.MARKET_PRICE
  private discountThreshold: number;

  constructor(discountThreshold: number) {
    // discountThreshold is the percentage discount from last paid price to trigger
    // e.g., 20 = trigger when current price is 20% below last paid
    // Should be passed from config, not hardcoded
    if (discountThreshold === undefined) {
      throw new Error('MarketPriceRule: discountThreshold is required and should come from config');
    }
    this.discountThreshold = Math.max(0, Math.min(100, discountThreshold));
  }

  evaluate(context: RuleContext): RuleEvaluation {
    // Validate context
    validateRuleContext(context);
    
    const { auction, lastPaidPrice } = context;
    
    // If we don't have last paid price data, can't evaluate
    if (!lastPaidPrice || lastPaidPrice === 0n) {
      return {
        decision: null,
        thoughts: {
          currentValue: 'No market data',
          targetValue: 'N/A',
          progress: 0,
          reasoning: 'No last paid price available for market comparison',
          metadata: {
            currentPrice: formatEther(auction.currentPrice),
            lastPaidPrice: null
          }
        }
      };
    }
    
    // Calculate the discount percentage
    const discountPercent = lastPaidPrice > 0n 
      ? Number((lastPaidPrice - auction.currentPrice) * 10000n / lastPaidPrice) / 100
      : 0;
    
    // Calculate target price (last paid minus discount threshold)
    const targetMultiplier = (100 - this.discountThreshold) / 100;
    const targetPrice = (lastPaidPrice * BigInt(Math.floor(targetMultiplier * 10000))) / 10000n;
    
    // Calculate progress toward discount threshold
    const progress = Math.min(100, (discountPercent / this.discountThreshold) * 100);
    
    // Format values for display (with 4 decimal places)
    const currentPriceFormatted = parseFloat(formatEther(auction.currentPrice)).toFixed(4);
    const lastPaidFormatted = parseFloat(formatEther(lastPaidPrice)).toFixed(4);
    const targetFormatted = parseFloat(formatEther(targetPrice)).toFixed(4);
    
    // Check if we've reached the discount threshold
    if (auction.currentPrice <= targetPrice) {
      return {
        decision: {
          shouldYeet: true,
          reason: `Market opportunity! Current price ${discountPercent.toFixed(1)}% below last paid (${lastPaidFormatted} BERA)`,
          priority: this.priority,
          ruleName: this.name,
          suggestedGasMultiplier: 1.3, // Moderate gas - market-based opportunity
          metadata: {
            currentPrice: auction.currentPrice.toString(),
            lastPaidPrice: lastPaidPrice.toString(),
            discountPercent,
            targetPrice: targetPrice.toString()
          }
        },
        thoughts: {
          currentValue: `Price: ${currentPriceFormatted} BERA`,
          targetValue: `Target: ${targetFormatted} BERA (${this.discountThreshold}% below last)`,
          progress: 100,
          reasoning: `📉 Market discount reached! ${discountPercent.toFixed(1)}% below last paid price`,
          metadata: {
            lastPaidPrice: lastPaidFormatted,
            discountPercent: discountPercent.toFixed(1),
            targetDiscount: this.discountThreshold,
            priceRatio: `${(Number(auction.currentPrice * 10000n / lastPaidPrice) / 100).toFixed(1)}%`
          }
        }
      };
    }
    
    // Not at discount threshold yet
    return {
      decision: null,
      thoughts: {
        currentValue: `Price: ${currentPriceFormatted} BERA`,
        targetValue: `Target: ${targetFormatted} BERA`,
        progress: progress,
        reasoning: discountPercent > 0 
          ? `Current discount: ${discountPercent.toFixed(1)}% (need ${this.discountThreshold}% for trigger)`
          : `Price above last paid (${lastPaidFormatted} BERA)`,
        metadata: {
          lastPaidPrice: lastPaidFormatted,
          currentDiscount: discountPercent.toFixed(1),
          targetDiscount: this.discountThreshold,
          priceRatio: `${(Number(auction.currentPrice * 10000n / lastPaidPrice) / 100).toFixed(1)}%`,
          gapToTarget: parseFloat(formatEther(auction.currentPrice > targetPrice ? auction.currentPrice - targetPrice : 0n)).toFixed(4)
        }
      }
    };
  }
}