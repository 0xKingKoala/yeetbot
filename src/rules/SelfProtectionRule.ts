import { IRule } from '../core/interfaces/IRule';
import { RuleContext, RuleEvaluation } from '../core/types';
import { validateRuleContext } from '../utils/validation';
import { RULE_PRIORITIES } from '../core/constants';

export class SelfProtectionRule implements IRule {
  name = 'SelfProtection';
  priority = RULE_PRIORITIES.SELF_PROTECTION;

  evaluate(context: RuleContext): RuleEvaluation {
    // Validate context
    validateRuleContext(context);
    
    const { auction, profit, config } = context;
    
    // Check if current leader is one of our wallets
    const isOurWallet = config.ourWallets.has(auction.currentLeader.toLowerCase());
    
    if (!isOurWallet) {
      return {
        decision: null,
        thoughts: {
          currentValue: 'Not our wallet',
          targetValue: 'N/A',
          progress: 0,
          reasoning: 'Current leader is not our wallet - rule inactive',
          metadata: {
            leaderAddress: auction.currentLeader.slice(0, 6) + '...',
            isOurWallet: false
          }
        }
      };
    }

    // We are leading - check profit status
    const timeToTarget = profit.timeToProfit[config.selfProfitThreshold];
    
    // Calculate progress from -100% to threshold
    // When profit is -100%, progress is 0%
    // When profit is at threshold, progress is 100%
    const progressRange = 100 + config.selfProfitThreshold; // Total range from -100% to threshold
    const currentProgress = 100 + profit.profitPercentage; // Current position in that range
    const progress = Math.max(0, Math.min(100, (currentProgress / progressRange) * 100));
    
    // Only trigger if profit threshold is met OR if we're approaching it (timeToTarget is defined and less than buffer)
    if (profit.profitPercentage >= config.selfProfitThreshold || 
        (timeToTarget !== undefined && timeToTarget < config.snipeBufferSeconds)) {
      return {
        decision: {
          shouldYeet: true,
          reason: `Securing own profits at ${profit.profitPercentage.toFixed(1)}% (threshold: ${config.selfProfitThreshold}%)`,
          priority: this.priority,
          ruleName: this.name,
          suggestedGasMultiplier: 1.2, // Moderate gas - we control timing
          metadata: {
            ownWallet: auction.currentLeader,
            currentProfit: profit.profitPercentage,
            threshold: config.selfProfitThreshold,
            timeToThreshold: timeToTarget
          }
        },
        thoughts: {
          currentValue: `Our profit: ${profit.profitPercentage.toFixed(1)}%`,
          targetValue: `Self-protect at: ${config.selfProfitThreshold}%`,
          progress: 100,
          reasoning: (timeToTarget !== undefined && timeToTarget < config.snipeBufferSeconds)
            ? `🛡️ Time to secure! Buffer time reached (${timeToTarget}s < ${config.snipeBufferSeconds}s)`
            : `🛡️ Profit threshold reached - securing our position!`,
          metadata: {
            ownWallet: auction.currentLeader.slice(0, 6) + '...',
            timeInLead: profit.breakEvenTime || 0
          }
        }
      };
    }

    // We're leading but not at threshold yet
    const reasoning = profit.profitPercentage < 0
      ? `🛡️ We're leading but at a loss (${profit.profitPercentage.toFixed(1)}%) - accumulating BGT...`
      : timeToTarget !== undefined && timeToTarget > 0
        ? `🛡️ We're leading - ${timeToTarget}s until self-protection threshold`
        : `🛡️ We're leading - accumulating profit...`;
    
    return {
      decision: null,
      thoughts: {
        currentValue: `Our profit: ${profit.profitPercentage.toFixed(1)}%`,
        targetValue: `Self-protect at: ${config.selfProfitThreshold}%`,
        progress: progress,
        reasoning: reasoning,
        metadata: {
          ownWallet: auction.currentLeader.slice(0, 6) + '...',
          timeToThreshold: timeToTarget !== undefined ? timeToTarget : null,
          bufferSeconds: config.snipeBufferSeconds,
          willProtectAt: timeToTarget !== undefined ? timeToTarget - config.snipeBufferSeconds : null
        }
      }
    };
  }
}