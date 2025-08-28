import { DecisionEngine } from './services/DecisionEngine';
import { BGTEqualsCurrentPriceRule } from './rules/BGTEqualsCurrentPriceRule';
import { SafetyRule } from './rules/SafetyRule';
import { BlacklistRule } from './rules/BlacklistRule';
import { SelfProtectionRule } from './rules/SelfProtectionRule';
import { StandardSnipeRule } from './rules/StandardSnipeRule';
import { MarketPriceRule } from './rules/MarketPriceRule';
import { AuctionTimeDecayRule } from './rules/AuctionTimeDecayRule';
import { PredictiveTimingRule } from './rules/PredictiveTimingRule';

export interface DecisionEngineOptions {
  bgtEqualsPriceBuffer: number; // Profit buffer percentage for BGT equals price rule  
  marketPriceDiscountThreshold: number; // Discount threshold percentage for market price rule
}

export function createDecisionEngine(options: DecisionEngineOptions): DecisionEngine {
  const engine = new DecisionEngine();
  
  // Add all rules in priority order (highest priority first)
  engine.addRule(new SafetyRule());
  engine.addRule(new BlacklistRule());
  engine.addRule(new SelfProtectionRule());
  engine.addRule(new BGTEqualsCurrentPriceRule(options.bgtEqualsPriceBuffer));
  engine.addRule(new AuctionTimeDecayRule()); // Priority 45
  engine.addRule(new StandardSnipeRule());
  engine.addRule(new PredictiveTimingRule()); // Priority 35
  engine.addRule(new MarketPriceRule(options.marketPriceDiscountThreshold));

  return engine;
}