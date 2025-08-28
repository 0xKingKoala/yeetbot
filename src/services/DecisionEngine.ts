import { IDecisionEngine } from '../core/interfaces/IDecisionEngine';
import { IRule } from '../core/interfaces/IRule';
import { RuleContext, YeetDecision, RuleThoughts } from '../core/types';
import { formatEther } from 'viem';

export interface DetailedEvaluation {
  decision: YeetDecision;
  allEvaluations: Array<{
    ruleName: string;
    decision: YeetDecision | null;
    triggered: boolean;
    reason: string;
    thoughts: RuleThoughts; // Add thoughts for dashboard display
  }>;
}

export class DecisionEngine implements IDecisionEngine {
  private rules: Map<string, IRule> = new Map();
  private lastEvaluations: DetailedEvaluation | null = null;

  addRule(rule: IRule): void {
    this.rules.set(rule.name, rule);
  }

  removeRule(ruleName: string): void {
    this.rules.delete(ruleName);
  }
  
  // Get current rule information without evaluating
  getRuleInfo(): Array<{ name: string; priority: number }> {
    return Array.from(this.rules.values()).map(rule => ({
      name: rule.name,
      priority: 0 // Default priority, will be updated when rules actually evaluate
    }));
  }
  
  // Get all registered rule names for display
  getRuleNames(): string[] {
    return Array.from(this.rules.keys());
  }

  evaluate(context: RuleContext): YeetDecision {
    const decisions: YeetDecision[] = [];
    const allEvaluations: Array<{
      ruleName: string;
      decision: YeetDecision | null;
      triggered: boolean;
      reason: string;
      thoughts: RuleThoughts;
    }> = [];

    // Evaluate all rules
    for (const rule of this.rules.values()) {
      const evaluation = rule.evaluate(context);
      const { decision, thoughts } = evaluation;
      
      // Build evaluation result with thoughts
      allEvaluations.push({
        ruleName: rule.name,
        decision,
        triggered: decision !== null,
        reason: decision ? decision.reason : thoughts.reasoning,
        thoughts
      });
      
      if (decision) {
        decisions.push(decision);
      }
    }

    // Determine final decision
    let finalDecision: YeetDecision;
    
    // If no rules triggered, default to not yeeting
    if (decisions.length === 0) {
      finalDecision = {
        shouldYeet: false,
        reason: 'No rules triggered',
        priority: 0
      };
    } else {
      // Sort by priority (highest first)
      decisions.sort((a, b) => b.priority - a.priority);

      // Check for any blocking rules (shouldYeet = false)
      const blockingDecision = decisions.find(d => !d.shouldYeet);
      if (blockingDecision) {
        finalDecision = blockingDecision;
      } else {
        // Return the highest priority positive decision
        finalDecision = decisions[0];
      }
    }

    // Store detailed evaluation for external access
    this.lastEvaluations = {
      decision: finalDecision,
      allEvaluations
    };

    return finalDecision;
  }
  
  private getInactiveReason(ruleName: string, context: RuleContext): string {
    // Provide context-specific reasons for why rules aren't active
    switch (ruleName) {
      case 'BGTEqualsCurrentPrice':
        if (!context.auction?.isAuctionPhase) {
          return 'Waiting for auction phase';
        }
        const bgtValue = context.bgtRewards?.totalAccumulated || 0n;
        const priceValue = context.auction?.currentPrice || 0n;
        const bgtFormatted = parseFloat(formatEther(bgtValue)).toFixed(4);
        const priceFormatted = parseFloat(formatEther(priceValue)).toFixed(4);
        return `BGT (${bgtFormatted}) < Price (${priceFormatted})`;
      
      case 'Safety':
        return `Auction factor (${context.auction?.auctionMaxFactor || 0}) within safe range`;
      
      case 'Blacklist':
        return 'Leader not in blacklist';
      
      case 'SelfProtection':
        return context.wallet?.isOurWallet ? 'We are already leading' : 'Not our wallet leading';
      
      case 'StandardSnipe':
        if (!context.auction?.isAuctionPhase) {
          return 'Not in auction phase';
        }
        return `Profit ${context.profit?.profitPercentage.toFixed(1) || 0}% below threshold`;
      
      default:
        return 'Conditions not met';
    }
  }

  getLastEvaluations(): DetailedEvaluation | null {
    return this.lastEvaluations;
  }

  getRules(): IRule[] {
    return Array.from(this.rules.values());
  }
}