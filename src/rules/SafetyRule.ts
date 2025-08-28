import { IRule } from '../core/interfaces/IRule';
import { RuleContext, RuleEvaluation } from '../core/types';
import { validateRuleContext } from '../utils/validation';
import { RULE_PRIORITIES } from '../core/constants';
import { formatEther, parseEther } from 'viem';

export class SafetyRule implements IRule {
  name = 'Safety';
  priority = RULE_PRIORITIES.SAFETY;

  evaluate(context: RuleContext): RuleEvaluation {
    // Validate context
    validateRuleContext(context);
    
    const { auction, config } = context;
    
    // Check 1: Max Yeet Amount
    const maxYeetAmountWei = parseEther(config.maxYeetAmount);
    const currentPriceFormatted = parseFloat(formatEther(auction.currentPrice)).toFixed(4);
    const priceExceedsMax = auction.currentPrice > maxYeetAmountWei;
    const priceProgress = Math.min(100, Number((auction.currentPrice * 100n) / maxYeetAmountWei));
    
    if (priceExceedsMax) {
      return {
        decision: {
          shouldYeet: false,
          reason: `Price (${currentPriceFormatted} BERA) exceeds max yeet amount (${config.maxYeetAmount} BERA)`,
          priority: this.priority,
          ruleName: this.name,
          metadata: {
            currentPrice: auction.currentPrice.toString(),
            maxYeetAmount: maxYeetAmountWei.toString(),
            exceeded: 'maxYeetAmount'
          }
        },
        thoughts: {
          currentValue: `Price: ${currentPriceFormatted} BERA`,
          targetValue: `Max: ${config.maxYeetAmount} BERA`,
          progress: 100,
          reasoning: '💸 PRICE TOO HIGH - Exceeds max yeet amount limit!',
          metadata: {
            priceExceedsMax: true,
            overage: parseFloat(formatEther(auction.currentPrice - maxYeetAmountWei)).toFixed(4),
            percentage: `${priceProgress}%`
          }
        }
      };
    }
    
    // Check 2: Auction Max Factor
    const safetyMargin = config.maxAuctionFactor - auction.auctionMaxFactor;
    const factorProgress = Math.min(100, (auction.auctionMaxFactor / config.maxAuctionFactor) * 100);
    
    if (auction.auctionMaxFactor > config.maxAuctionFactor) {
      return {
        decision: {
          shouldYeet: false,
          reason: `Safety threshold exceeded: auctionMaxFactor ${auction.auctionMaxFactor} > ${config.maxAuctionFactor}`,
          priority: this.priority,
          ruleName: this.name,
          metadata: {
            auctionMaxFactor: auction.auctionMaxFactor,
            threshold: config.maxAuctionFactor,
            alertCode: 'YM-003',
            exceeded: 'auctionMaxFactor'
          }
        },
        thoughts: {
          currentValue: `Factor: ${auction.auctionMaxFactor.toFixed(2)}x`,
          targetValue: `Max: ${config.maxAuctionFactor.toFixed(2)}x`,
          progress: 100,
          reasoning: '⚠️ AUCTION FACTOR EXCEEDED - All yeets blocked!',
          metadata: {
            exceeded: true,
            safetyMargin: safetyMargin,
            alertCode: 'YM-003'
          }
        }
      };
    }

    // Both checks passed - combine status for display
    const isApproachingPriceLimit = priceProgress > 80;
    const isApproachingFactorLimit = safetyMargin <= 0.2;
    
    let reasoning = '✅ Operating within all safety limits';
    if (isApproachingPriceLimit && isApproachingFactorLimit) {
      reasoning = '⚠️ Approaching both price and factor limits!';
    } else if (isApproachingPriceLimit) {
      reasoning = `⚠️ Approaching max yeet amount (${priceProgress.toFixed(0)}% of limit)`;
    } else if (isApproachingFactorLimit) {
      reasoning = `⚠️ Approaching factor limit (margin: ${safetyMargin.toFixed(2)}x)`;
    }
    
    // Within all safety limits
    return {
      decision: null,
      thoughts: {
        currentValue: `Price: ${currentPriceFormatted} | Factor: ${auction.auctionMaxFactor.toFixed(2)}x`,
        targetValue: `Max: ${config.maxYeetAmount} BERA | ${config.maxAuctionFactor.toFixed(2)}x`,
        progress: Math.max(priceProgress, factorProgress),
        reasoning: reasoning,
        metadata: {
          price: {
            current: currentPriceFormatted,
            max: config.maxYeetAmount,
            progress: `${priceProgress.toFixed(1)}%`,
            remaining: formatEther(maxYeetAmountWei - auction.currentPrice)
          },
          factor: {
            current: auction.auctionMaxFactor.toFixed(2),
            max: config.maxAuctionFactor.toFixed(2),
            margin: safetyMargin.toFixed(2),
            progress: `${factorProgress.toFixed(1)}%`
          },
          isWarning: isApproachingPriceLimit || isApproachingFactorLimit
        }
      }
    };
  }
}