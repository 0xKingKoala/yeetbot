import { IRule } from '../core/interfaces/IRule';
import { RuleContext, RuleEvaluation } from '../core/types';
import { validateRuleContext } from '../utils/validation';
import { RULE_PRIORITIES } from '../core/constants';

export class StandardSnipeRule implements IRule {
  name = 'StandardSnipe';
  priority = RULE_PRIORITIES.STANDARD_SNIPE;

  evaluate(context: RuleContext): RuleEvaluation {
    // Validate context
    validateRuleContext(context);
    
    const { auction, profit, config } = context;
    
    // Handle case where there's no current leader
    if (!auction.currentLeader || auction.currentLeader === '0x0000000000000000000000000000000000000000') {
      // With no leader, profit would be -100% (paying price with 0 BGT accumulated)
      const profitPercent = -100;
      const progress = Math.max(0, (100 + profitPercent) / (100 + config.othersProfitThreshold) * 100);
      
      return {
        decision: null,
        thoughts: {
          currentValue: `Profit: ${profitPercent.toFixed(1)}%`,
          targetValue: `Threshold: ${config.othersProfitThreshold}%`,
          progress: progress,
          reasoning: 'No current leader - waiting for someone to yeet first',
          metadata: {
            hasLeader: false,
            currentProfit: profitPercent,
            threshold: config.othersProfitThreshold
          }
        }
      };
    }
    
    // Skip if it's our wallet or blacklisted (handled by other rules)
    if (config.ourWallets.has(auction.currentLeader.toLowerCase()) ||
        config.blacklistedAddresses.has(auction.currentLeader.toLowerCase())) {
      return {
        decision: null,
        thoughts: {
          currentValue: 'N/A',
          targetValue: 'N/A',
          progress: 0,
          reasoning: 'Skipping - leader is our wallet or blacklisted (handled by other rules)',
          metadata: {
            isOurWallet: config.ourWallets.has(auction.currentLeader.toLowerCase()),
            isBlacklisted: config.blacklistedAddresses.has(auction.currentLeader.toLowerCase())
          }
        }
      };
    }

    // Check if they're approaching the standard profit threshold
    const timeToTarget = profit.timeToProfit[config.othersProfitThreshold];
    
    // Calculate progress from -100% to threshold
    // When profit is -100%, progress is 0%
    // When profit is at threshold, progress is 100%
    const progressRange = 100 + config.othersProfitThreshold; // Total range from -100% to threshold
    const currentProgress = 100 + profit.profitPercentage; // Current position in that range
    const progress = Math.max(0, Math.min(100, (currentProgress / progressRange) * 100));
    
    // Only trigger if profit threshold is met OR if we're approaching it (timeToTarget is defined and less than buffer)
    if (profit.profitPercentage >= config.othersProfitThreshold || 
        (timeToTarget !== undefined && timeToTarget < config.snipeBufferSeconds)) {
      return {
        decision: {
          shouldYeet: true,
          reason: `Other player at ${profit.profitPercentage.toFixed(1)}% profit (threshold: ${config.othersProfitThreshold}%)`,
          priority: this.priority,
          ruleName: this.name,
          suggestedGasMultiplier: 1.5, // Competitive gas for standard sniping
          metadata: {
            targetAddress: auction.currentLeader,
            currentProfit: profit.profitPercentage,
            threshold: config.othersProfitThreshold,
            timeToThreshold: timeToTarget
          }
        },
        thoughts: {
          currentValue: `Profit: ${profit.profitPercentage.toFixed(1)}%`,
          targetValue: `Threshold: ${config.othersProfitThreshold}%`,
          progress: 100,
          reasoning: (timeToTarget !== undefined && timeToTarget < config.snipeBufferSeconds)
            ? `Time to threshold (${timeToTarget}s) < buffer (${config.snipeBufferSeconds}s) - SNIPE NOW!`
            : `Profit threshold reached - time to snipe!`,
          metadata: {
            targetAddress: auction.currentLeader.slice(0, 6) + '...',
            timeToThreshold: timeToTarget !== undefined ? timeToTarget : null,
            bufferSeconds: config.snipeBufferSeconds
          }
        }
      };
    }

    // Not ready to snipe yet
    const reasoning = profit.profitPercentage < 0 
      ? `Leader losing money (${profit.profitPercentage.toFixed(1)}%) - accumulating BGT...`
      : timeToTarget !== undefined && timeToTarget > 0 
        ? `Monitoring other player - ${timeToTarget}s until threshold`
        : `Waiting for profit to reach ${config.othersProfitThreshold}%`;

    return {
      decision: null,
      thoughts: {
        currentValue: `Profit: ${profit.profitPercentage.toFixed(1)}%`,
        targetValue: `Threshold: ${config.othersProfitThreshold}%`,
        progress: progress,
        reasoning: reasoning,
        metadata: {
          targetAddress: auction.currentLeader.slice(0, 6) + '...',
          timeToThreshold: timeToTarget !== undefined ? timeToTarget : null,
          bufferSeconds: config.snipeBufferSeconds,
          willSnipeAt: timeToTarget !== undefined && timeToTarget > config.snipeBufferSeconds 
            ? timeToTarget - config.snipeBufferSeconds 
            : null,
          isNegativeProfit: profit.profitPercentage < 0
        }
      }
    };
  }
}