import { IRule } from '../core/interfaces/IRule';
import { RuleContext, RuleEvaluation } from '../core/types';
import { validateRuleContext } from '../utils/validation';
import { RULE_PRIORITIES } from '../core/constants';

/**
 * PredictiveTimingRule - Predicts optimal yeet timing based on future profit projections
 * Uses timeToProfit calculations to determine if NOW is the optimal time to yeet
 * Considers opportunity windows and risk of being sniped
 */
export class PredictiveTimingRule implements IRule {
  name = 'PredictiveTiming';
  priority = RULE_PRIORITIES.PREDICTIVE_TIMING; // Priority 35, lower than standard snipe
  
  private targetProfitThreshold: number;
  private opportunityWindowSeconds: number;
  private minAcceptableProfit: number;
  private riskMultiplier: number;
  
  constructor(
    targetProfitThreshold: number = 2,    // Target profit we're aiming for
    opportunityWindowSeconds: number = 5,  // Look ahead window
    minAcceptableProfit: number = -10,    // Don't yeet below this profit
    riskMultiplier: number = 0.8          // Risk adjustment factor (0.8 = accept 80% of target)
  ) {
    this.targetProfitThreshold = targetProfitThreshold;
    this.opportunityWindowSeconds = opportunityWindowSeconds;
    this.minAcceptableProfit = minAcceptableProfit;
    this.riskMultiplier = riskMultiplier;
  }

  evaluate(context: RuleContext): RuleEvaluation {
    // Validate context
    validateRuleContext(context);
    
    const { auction, profit, config } = context;
    
    // Skip if profit is too low
    if (profit.profitPercentage < this.minAcceptableProfit) {
      return {
        decision: null,
        thoughts: {
          currentValue: `Profit: ${profit.profitPercentage.toFixed(1)}%`,
          targetValue: `Min: ${this.minAcceptableProfit}%`,
          progress: 0,
          reasoning: 'Profit too low for predictive timing',
          metadata: {
            currentProfit: profit.profitPercentage,
            minRequired: this.minAcceptableProfit
          }
        }
      };
    }
    
    // Get time to reach our target profit
    const timeToTarget = profit.timeToProfit[this.targetProfitThreshold];
    
    // If we can't reach target, evaluate based on current trajectory
    if (timeToTarget === undefined || timeToTarget === Infinity) {
      // Check if we're at a local maximum (profit growth slowing)
      const timeToNextPercent = profit.timeToProfit[Math.ceil(profit.profitPercentage) + 1];
      
      if (profit.profitPercentage > 0 && (timeToNextPercent === undefined || timeToNextPercent > 30)) {
        return {
          decision: {
            shouldYeet: true,
            reason: `Profit growth stalling at ${profit.profitPercentage.toFixed(1)}% - optimal time to yeet`,
            priority: this.priority,
            ruleName: this.name,
            suggestedGasMultiplier: 1.2,
            metadata: {
              currentProfit: profit.profitPercentage,
              growthStalled: true,
              timeToNextPercent
            }
          },
          thoughts: {
            currentValue: `Profit: ${profit.profitPercentage.toFixed(1)}%`,
            targetValue: `Growth stalling`,
            progress: 100,
            reasoning: '📈 Profit growth has plateaued - take profits now!',
            metadata: {
              timeToNextPercent,
              profitTrend: 'stalling'
            }
          }
        };
      }
    }
    
    // Calculate risk-adjusted target
    const riskAdjustedTarget = this.targetProfitThreshold * this.riskMultiplier;
    const isWithinWindow = timeToTarget !== undefined && timeToTarget <= this.opportunityWindowSeconds;
    const hasReachedRiskAdjusted = profit.profitPercentage >= riskAdjustedTarget;
    
    // Calculate optimal timing score (0-100)
    let timingScore = 0;
    if (timeToTarget !== undefined && timeToTarget > 0) {
      // Score based on how close we are to optimal window
      if (timeToTarget <= this.opportunityWindowSeconds) {
        timingScore = 100 - (timeToTarget / this.opportunityWindowSeconds * 20); // 80-100 score
      } else {
        timingScore = Math.max(0, 80 - (timeToTarget - this.opportunityWindowSeconds) * 2);
      }
    }
    
    // Add score for current profit level
    if (profit.profitPercentage > 0) {
      timingScore += (profit.profitPercentage / this.targetProfitThreshold) * 20;
    }
    
    timingScore = Math.min(100, timingScore);
    
    // Trigger if timing is optimal
    if ((isWithinWindow && profit.profitPercentage > 0) || hasReachedRiskAdjusted) {
      return {
        decision: {
          shouldYeet: true,
          reason: `Optimal timing: ${profit.profitPercentage.toFixed(1)}% profit, ${timeToTarget?.toFixed(0) || '0'}s to ${this.targetProfitThreshold}%`,
          priority: this.priority,
          ruleName: this.name,
          suggestedGasMultiplier: isWithinWindow ? 1.3 : 1.1,
          metadata: {
            currentProfit: profit.profitPercentage,
            targetProfit: this.targetProfitThreshold,
            timeToTarget,
            timingScore,
            isWithinWindow
          }
        },
        thoughts: {
          currentValue: `Profit: ${profit.profitPercentage.toFixed(1)}%`,
          targetValue: `Target: ${this.targetProfitThreshold}%`,
          progress: 100,
          reasoning: isWithinWindow 
            ? `🎯 Within opportunity window! ${timeToTarget}s to target`
            : `✅ Risk-adjusted target reached (${riskAdjustedTarget.toFixed(1)}%)`,
          metadata: {
            timingScore: timingScore.toFixed(0),
            timeToTarget,
            opportunityWindow: this.opportunityWindowSeconds,
            riskAdjustedTarget: riskAdjustedTarget.toFixed(1)
          }
        }
      };
    }
    
    // Not optimal timing yet
    const progress = Math.min(100, timingScore);
    
    return {
      decision: null,
      thoughts: {
        currentValue: `Score: ${timingScore.toFixed(0)}/100`,
        targetValue: `Window: ${this.opportunityWindowSeconds}s`,
        progress: progress,
        reasoning: timeToTarget !== undefined 
          ? timeToTarget <= this.opportunityWindowSeconds * 2
            ? `📊 Approaching optimal window (${timeToTarget.toFixed(0)}s to ${this.targetProfitThreshold}%)`
            : `Waiting for better timing (${timeToTarget.toFixed(0)}s to target)`
          : `Evaluating profit trajectory...`,
        metadata: {
          currentProfit: profit.profitPercentage.toFixed(1),
          targetProfit: this.targetProfitThreshold,
          timeToTarget: timeToTarget?.toFixed(0),
          timingScore: timingScore.toFixed(0),
          opportunityWindow: this.opportunityWindowSeconds,
          riskAdjustedTarget: riskAdjustedTarget.toFixed(1)
        }
      }
    };
  }
}