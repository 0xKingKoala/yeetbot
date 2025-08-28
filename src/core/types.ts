export interface AuctionState {
  currentPrice: bigint;
  currentLeader: string;
  leaderAmount: bigint;  // What the current leader paid
  leaderTimestamp: Date;
  isAuctionPhase: boolean;
  auctionMaxFactor: number;
  lastPaidPrice?: bigint;  // Track the last actual payment made
  lastYeetRound?: number;  // Track the round number
  auctionStartTime?: Date;  // When the auction phase started
}

export interface BGTRewards {
  bgtPerSecond: bigint;
  totalAccumulated: bigint;
  timeElapsed: number;
}

export interface ProfitMetrics {
  returnPercentage: number;
  profitPercentage: number;
  netProfit: bigint;
  breakEvenTime: number;
  timeToProfit: Record<number, number>;
}

export interface WalletInfo {
  address: string;
  isOurWallet: boolean;
}

export interface YeetDecision {
  shouldYeet: boolean;
  reason: string;
  priority: number;
  ruleName?: string;
  suggestedGasMultiplier?: number;
  metadata?: Record<string, any>;
}

export interface RuleContext {
  auction: AuctionState;
  bgtRewards: BGTRewards;
  profit: ProfitMetrics;
  wallet: WalletInfo;
  config: RuleConfig;
  lastPaidPrice?: bigint;  // Make it easily accessible at the top level
}

export interface RuleConfig {
  othersProfitThreshold: number;
  selfProfitThreshold: number;
  blacklistProfitThreshold: number;
  snipeBufferSeconds: number;
  blacklistedAddresses: ReadonlySet<string>;
  maxAuctionFactor: number;
  ourWallets: ReadonlySet<string>;
  maxYeetAmount: string;  // Max BERA amount as string (e.g., "20")
}

export interface RuleThoughts {
  currentValue: string;       // What the rule currently sees
  targetValue: string;        // What value would trigger the rule
  progress: number;          // 0-100% progress toward triggering
  reasoning: string;         // Human-readable explanation
  metadata?: Record<string, any>;  // Additional data for debugging
}

export interface RuleEvaluation {
  decision: YeetDecision | null;  // The actual yes/no/null decision
  thoughts: RuleThoughts;          // The thought process behind the decision
}