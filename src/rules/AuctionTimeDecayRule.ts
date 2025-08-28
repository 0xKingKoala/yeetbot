import { IRule } from '../core/interfaces/IRule';
import { RuleContext, RuleEvaluation } from '../core/types';
import { validateRuleContext } from '../utils/validation';
import { RULE_PRIORITIES } from '../core/constants';

/**
 * AuctionTimeDecayRule - Triggers based on auction duration
 * As the Dutch auction progresses, price drops and urgency increases
 * This rule prevents waiting too long and missing opportunities
 */
export class AuctionTimeDecayRule implements IRule {
  name = 'AuctionTimeDecay';
  priority = RULE_PRIORITIES.TIME_DECAY;

  private earlyPhaseSeconds: number;
  private midPhaseSeconds: number;
  private latePhaseThreshold: number; // Profit threshold for late phase
  private midPhaseThreshold: number;  // Profit threshold for mid phase
  private expectedDuration: number;
  
  constructor(
    expectedDuration: number = 30,
    earlyPhaseSeconds: number = 10,
    midPhaseSeconds: number = 20,
    latePhaseThreshold: number = -20,  // Yeet even at -20% in late phase
    midPhaseThreshold: number = 0       // Yeet at break-even in mid phase
  ) {
    this.expectedDuration = expectedDuration;
    this.earlyPhaseSeconds = earlyPhaseSeconds;
    this.midPhaseSeconds = midPhaseSeconds;
    this.latePhaseThreshold = latePhaseThreshold;
    this.midPhaseThreshold = midPhaseThreshold;
  }

  evaluate(context: RuleContext): RuleEvaluation {
    // Validate context
    validateRuleContext(context);
    
    const { auction, profit } = context;
    
    // Skip if not in auction phase or no start time
    if (!auction.isAuctionPhase || !auction.auctionStartTime) {
      return {
        decision: null,
        thoughts: {
          currentValue: 'Not in auction',
          targetValue: 'N/A',
          progress: 0,
          reasoning: 'Waiting for auction phase to begin',
          metadata: {
            isAuctionPhase: auction.isAuctionPhase,
            hasStartTime: !!auction.auctionStartTime
          }
        }
      };
    }
    
    // Calculate auction age in seconds
    const now = Date.now();
    const auctionAge = Math.floor((now - auction.auctionStartTime.getTime()) / 1000);
    const progress = Math.min(100, (auctionAge / this.expectedDuration) * 100);
    
    // Determine phase and threshold
    let phase: string;
    let profitThreshold: number;
    let urgencyMultiplier: number;
    
    if (auctionAge < this.earlyPhaseSeconds) {
      phase = 'early';
      profitThreshold = 100; // Don't trigger in early phase unless amazing opportunity
      urgencyMultiplier = 0.5;
    } else if (auctionAge < this.midPhaseSeconds) {
      phase = 'mid';
      profitThreshold = this.midPhaseThreshold;
      urgencyMultiplier = 1.0;
    } else {
      phase = 'late';
      profitThreshold = this.latePhaseThreshold;
      urgencyMultiplier = 1.5 + (auctionAge - this.midPhaseSeconds) / 10; // Increasing urgency
    }
    
    // Check if we should yeet based on phase and profit
    const shouldTrigger = profit.profitPercentage >= profitThreshold;
    
    if (shouldTrigger && phase !== 'early') {
      return {
        decision: {
          shouldYeet: true,
          reason: `Auction ${phase} phase (${auctionAge}s): Profit ${profit.profitPercentage.toFixed(1)}% meets threshold ${profitThreshold}%`,
          priority: this.priority,
          ruleName: this.name,
          suggestedGasMultiplier: urgencyMultiplier,
          metadata: {
            auctionAge,
            phase,
            profitThreshold,
            currentProfit: profit.profitPercentage,
            urgencyMultiplier
          }
        },
        thoughts: {
          currentValue: `Age: ${auctionAge}s (${phase})`,
          targetValue: `Profit ≥ ${profitThreshold}%`,
          progress: 100,
          reasoning: `⏰ Auction urgency! ${phase.toUpperCase()} phase with ${profit.profitPercentage.toFixed(1)}% profit`,
          metadata: {
            phase,
            auctionAge,
            expectedDuration: this.expectedDuration,
            timeRemaining: Math.max(0, this.expectedDuration - auctionAge),
            urgencyLevel: urgencyMultiplier
          }
        }
      };
    }
    
    // Not triggering yet
    const timeToNextPhase = phase === 'early' 
      ? this.earlyPhaseSeconds - auctionAge
      : phase === 'mid' 
        ? this.midPhaseSeconds - auctionAge
        : 0;
    
    return {
      decision: null,
      thoughts: {
        currentValue: `Age: ${auctionAge}s (${phase})`,
        targetValue: `Need ${profitThreshold}% profit`,
        progress: progress,
        reasoning: phase === 'early' 
          ? `Early phase - conservative (${timeToNextPhase}s to mid phase)`
          : phase === 'mid'
            ? `Mid phase - balanced approach (${timeToNextPhase}s to late phase)`
            : `⚠️ Late phase - increasing urgency! (${urgencyMultiplier.toFixed(1)}x gas)`,
        metadata: {
          phase,
          auctionAge,
          profitThreshold,
          currentProfit: profit.profitPercentage.toFixed(1),
          timeToNextPhase,
          urgencyMultiplier: urgencyMultiplier.toFixed(1)
        }
      }
    };
  }
}