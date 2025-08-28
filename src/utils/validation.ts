/**
 * Validation utilities for input sanitization
 */

/**
 * Validates an Ethereum address
 */
export function isValidAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Check if it matches the Ethereum address format (0x followed by 40 hex characters)
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Normalizes an Ethereum address to lowercase
 */
export function normalizeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return address.toLowerCase();
}

/**
 * Validates a bigint value is non-negative
 */
export function validateNonNegativeBigInt(value: bigint, fieldName: string): void {
  if (value < 0n) {
    throw new Error(`${fieldName} must be non-negative, got ${value}`);
  }
}

/**
 * Validates a number is finite and not NaN
 */
export function validateFiniteNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number, got ${value}`);
  }
}

/**
 * Validates the RuleContext structure
 */
export function validateRuleContext(context: any): void {
  if (!context || typeof context !== 'object') {
    throw new Error('Invalid context: must be an object');
  }

  // Validate auction state
  if (!context.auction || typeof context.auction !== 'object') {
    throw new Error('Invalid context.auction: must be an object');
  }
  
  const { auction } = context;
  
  // Validate addresses
  if (!isValidAddress(auction.currentLeader)) {
    throw new Error(`Invalid auction.currentLeader address: ${auction.currentLeader}`);
  }
  
  // Validate bigints
  validateNonNegativeBigInt(auction.currentPrice, 'auction.currentPrice');
  validateNonNegativeBigInt(auction.leaderAmount, 'auction.leaderAmount');
  validateNonNegativeBigInt(auction.leaderTimestamp, 'auction.leaderTimestamp');
  
  // Validate boolean
  if (typeof auction.isAuctionPhase !== 'boolean') {
    throw new Error('auction.isAuctionPhase must be a boolean');
  }
  
  // Validate number
  validateFiniteNumber(auction.auctionMaxFactor, 'auction.auctionMaxFactor');
  
  // Validate BGT rewards
  if (!context.bgtRewards || typeof context.bgtRewards !== 'object') {
    throw new Error('Invalid context.bgtRewards: must be an object');
  }
  
  const { bgtRewards } = context;
  validateNonNegativeBigInt(bgtRewards.bgtPerSecond, 'bgtRewards.bgtPerSecond');
  validateNonNegativeBigInt(bgtRewards.totalAccumulated, 'bgtRewards.totalAccumulated');
  validateFiniteNumber(bgtRewards.timeElapsed, 'bgtRewards.timeElapsed');
  
  // Validate profit metrics
  if (!context.profit || typeof context.profit !== 'object') {
    throw new Error('Invalid context.profit: must be an object');
  }
  
  const { profit } = context;
  validateFiniteNumber(profit.returnPercentage, 'profit.returnPercentage');
  validateFiniteNumber(profit.profitPercentage, 'profit.profitPercentage');
  validateFiniteNumber(profit.breakEvenTime, 'profit.breakEvenTime');
  
  // Validate wallet info
  if (!context.wallet || typeof context.wallet !== 'object') {
    throw new Error('Invalid context.wallet: must be an object');
  }
  
  if (!isValidAddress(context.wallet.address)) {
    throw new Error(`Invalid wallet.address: ${context.wallet.address}`);
  }
  
  if (typeof context.wallet.isOurWallet !== 'boolean') {
    throw new Error('wallet.isOurWallet must be a boolean');
  }
  
  // Validate config
  if (!context.config || typeof context.config !== 'object') {
    throw new Error('Invalid context.config: must be an object');
  }
}

/**
 * Creates a safe copy of RuleConfig with ReadonlySet
 */
export function createImmutableRuleConfig(config: any): any {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid config: must be an object');
  }
  
  // Validate and normalize blacklisted addresses
  const blacklistedAddresses = new Set<string>();
  if (config.blacklistedAddresses) {
    if (!(config.blacklistedAddresses instanceof Set) && !Array.isArray(config.blacklistedAddresses)) {
      throw new Error('config.blacklistedAddresses must be a Set or Array');
    }
    
    const addresses = config.blacklistedAddresses instanceof Set 
      ? Array.from(config.blacklistedAddresses)
      : config.blacklistedAddresses;
      
    for (const addr of addresses) {
      if (isValidAddress(addr)) {
        blacklistedAddresses.add(normalizeAddress(addr));
      }
    }
  }
  
  // Validate and normalize our wallets
  const ourWallets = new Set<string>();
  if (config.ourWallets) {
    if (!(config.ourWallets instanceof Set) && !Array.isArray(config.ourWallets)) {
      throw new Error('config.ourWallets must be a Set or Array');
    }
    
    const wallets = config.ourWallets instanceof Set
      ? Array.from(config.ourWallets)
      : config.ourWallets;
      
    for (const addr of wallets) {
      if (isValidAddress(addr)) {
        ourWallets.add(normalizeAddress(addr));
      }
    }
  }
  
  // Validate numbers
  const numbers = [
    'othersProfitThreshold',
    'selfProfitThreshold', 
    'blacklistProfitThreshold',
    'snipeBufferSeconds',
    'maxAuctionFactor'
  ];
  
  for (const field of numbers) {
    if (config[field] !== undefined) {
      validateFiniteNumber(config[field], `config.${field}`);
    }
  }
  
  return {
    ...config,
    blacklistedAddresses: blacklistedAddresses as ReadonlySet<string>,
    ourWallets: ourWallets as ReadonlySet<string>
  };
}