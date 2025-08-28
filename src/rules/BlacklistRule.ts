import { IRule } from '../core/interfaces/IRule';
import { RuleContext, RuleEvaluation } from '../core/types';
import { validateRuleContext, normalizeAddress } from '../utils/validation';
import { RULE_PRIORITIES } from '../core/constants';

export class BlacklistRule implements IRule {
  name = 'Blacklist';
  priority = RULE_PRIORITIES.BLACKLIST;

  evaluate(context: RuleContext): RuleEvaluation {
    // Validate context
    validateRuleContext(context);
    
    const { auction, profit, config } = context;
    
    // Check if current leader is blacklisted (normalize address for comparison)
    const leaderAddress = normalizeAddress(auction.currentLeader);
    const isBlacklisted = config.blacklistedAddresses.has(leaderAddress);
    
    if (!isBlacklisted) {
      return {
        decision: null,
        thoughts: {
          currentValue: 'Leader not blacklisted',
          targetValue: 'N/A',
          progress: 0,
          reasoning: 'Current leader is not on the blacklist',
          metadata: {
            leaderAddress: auction.currentLeader.slice(0, 6) + '...',
            isBlacklisted: false
          }
        }
      };
    }

    // Leader is blacklisted - check profit threshold
    // Calculate progress considering negative profits
    // For blacklist with negative threshold (e.g., -1%), we want immediate trigger
    const progress = config.blacklistProfitThreshold < 0
      ? profit.profitPercentage >= config.blacklistProfitThreshold ? 100 : 0
      : profit.profitPercentage <= 0 
        ? 0 
        : Math.min(100, (profit.profitPercentage / config.blacklistProfitThreshold) * 100);
    
    if (profit.profitPercentage >= config.blacklistProfitThreshold) {
      return {
        decision: {
          shouldYeet: true,
          reason: `Blacklisted address at ${profit.profitPercentage.toFixed(1)}% profit (threshold: ${config.blacklistProfitThreshold}%)`,
          priority: this.priority,
          ruleName: this.name,
          suggestedGasMultiplier: 1.5, // Competitive gas for aggressive sniping
          metadata: {
            isBlacklisted: true,
            currentProfit: profit.profitPercentage,
            threshold: config.blacklistProfitThreshold
          }
        },
        thoughts: {
          currentValue: `Profit: ${profit.profitPercentage.toFixed(1)}%`,
          targetValue: `Blacklist threshold: ${config.blacklistProfitThreshold}%`,
          progress: 100,
          reasoning: '🚫 BLACKLISTED player at profit threshold - aggressive snipe!',
          metadata: {
            leaderAddress: auction.currentLeader.slice(0, 6) + '...',
            isBlacklisted: true,
            timeInLead: profit.timeToProfit[0] || 0
          }
        }
      };
    }

    // Blacklisted but not at threshold yet
    const reasoning = config.blacklistProfitThreshold < 0
      ? `🚫 Waiting for blacklisted player to reach ${config.blacklistProfitThreshold}% (currently ${profit.profitPercentage.toFixed(1)}%)`
      : profit.profitPercentage < 0
        ? `🚫 Blacklisted player at loss (${profit.profitPercentage.toFixed(1)}%) - monitoring...`
        : `🚫 Monitoring blacklisted player - will snipe at ${config.blacklistProfitThreshold}%`;
    
    return {
      decision: null,
      thoughts: {
        currentValue: `Profit: ${profit.profitPercentage.toFixed(1)}%`,
        targetValue: `Blacklist threshold: ${config.blacklistProfitThreshold}%`,
        progress: progress,
        reasoning: reasoning,
        metadata: {
          leaderAddress: auction.currentLeader.slice(0, 6) + '...',
          isBlacklisted: true,
          profitGap: config.blacklistProfitThreshold - profit.profitPercentage
        }
      }
    };
  }
}