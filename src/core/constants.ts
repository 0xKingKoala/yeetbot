/**
 * Core constants used throughout the application
 * Only true constants that should never change are kept here
 */

// Rule priorities (higher = more important)
// These define the rule execution order and should not be changed
export const RULE_PRIORITIES = {
  BGT_EQUALS_PRICE: 90, // Highest priority - optimal entry point
  BLACKLIST: 80, // High priority - aggressive against blacklisted
  SAFETY: 70, // Safety checks before other rules
  SELF_PROTECTION: 60, // Protect our own positions
  STANDARD_SNIPE: 50, // Standard sniping logic
  MARKET_PRICE: 45, // Market price comparison
  TIME_DECAY: 45, // Auction time decay considerations
  PREDICTIVE_TIMING : 35, // Predictive timing strategies
} as const;

// Mathematical constants
export const BASIS_POINTS = 10000; // 1 basis point = 0.01%
export const PERCENTAGE_MULTIPLIER = 100; // Convert decimal to percentage