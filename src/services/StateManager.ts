import { logger } from '../utils/Logger';
import { AuctionState, BGTRewards } from '../core/types';
import { PriceCalculator, AuctionParameters } from './PriceCalculator';

export interface GameState {
  // Current auction info
  auction: AuctionState | null;
  
  // Auction parameters for real-time price calculation
  auctionParams: AuctionParameters | null;
  
  // BGT tracking
  bgtPerSecond: bigint;
  lastBgtUpdate: Date;
  
  // Cooldown tracking
  isInCooldown: boolean;
  cooldownEndTime: Date | null;
  
  // Slot duration
  slotDuration: number;
  
  // Last update time
  lastUpdateTime: Date;
  
  // Statistics
  stats: {
    totalYeets: number;
    successfulYeets: number;
    failedYeets: number;
    totalSpent: bigint;
    totalBgtEarned: bigint;
    sessionStartTime: Date;
  };
  
  // Historical data for dashboard
  historicalData?: {
    history: any[];
    plData: any[];
  };
}

export class StateManager {
  private static instance: StateManager;
  private state: GameState;
  private stateChangeListeners: ((state: GameState) => void)[] = [];
  private priceCalculator = PriceCalculator.getInstance();
  
  private constructor() {
    this.state = this.initializeState();
  }
  
  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }
  
  private initializeState(): GameState {
    return {
      auction: null,
      auctionParams: null,
      bgtPerSecond: 0n,
      lastBgtUpdate: new Date(),
      isInCooldown: false,
      cooldownEndTime: null,
      slotDuration: 180, // Default, will be updated from contract
      lastUpdateTime: new Date(),
      stats: {
        totalYeets: 0,
        successfulYeets: 0,
        failedYeets: 0,
        totalSpent: 0n,
        totalBgtEarned: 0n,
        sessionStartTime: new Date(),
      },
    };
  }
  
  // Get current state
  public getState(): Readonly<GameState> {
    return { ...this.state };
  }
  
  // Update auction state
  public updateAuction(auction: AuctionState | null): void {
    const previousState = this.state.auction;
    this.state.auction = auction;
    this.state.lastUpdateTime = new Date();
    
    logger.stateChange('auction_updated', {
      previousLeader: previousState?.currentLeader,
      currentLeader: auction?.currentLeader,
      previousPrice: previousState?.currentPrice?.toString(),
      currentPrice: auction?.currentPrice?.toString(),
      isAuctionPhase: auction?.isAuctionPhase,
    });
    
    this.notifyListeners();
  }
  
  // Update BGT rate
  public updateBgtRate(bgtPerSecond: bigint): void {
    const previousRate = this.state.bgtPerSecond;
    this.state.bgtPerSecond = bgtPerSecond;
    this.state.lastBgtUpdate = new Date();
    
    if (previousRate !== bgtPerSecond) {
      logger.info('BGT rate updated', {
        previousRate: previousRate.toString(),
        currentRate: bgtPerSecond.toString(),
      });
    }
    
    this.notifyListeners();
  }
  
  // Update cooldown state
  public updateCooldown(isInCooldown: boolean, endTime?: Date): void {
    this.state.isInCooldown = isInCooldown;
    this.state.cooldownEndTime = endTime || null;
    
    logger.stateChange('cooldown_updated', {
      isInCooldown,
      endTime: endTime?.toISOString(),
    });
    
    this.notifyListeners();
  }
  
  // Update slot duration
  public updateSlotDuration(duration: number): void {
    this.state.slotDuration = duration;
    logger.info('Slot duration updated', { duration });
    this.notifyListeners();
  }
  
  // Update auction parameters for real-time price calculation
  public updateAuctionParams(params: AuctionParameters): void {
    this.state.auctionParams = params;
    logger.info('Auction parameters updated', {
      startPrice: params.startPrice.toString(),
      minPrice: params.minPrice.toString(),
      duration: params.auctionDuration,
      startTime: params.auctionStartTime.toISOString()
    });
    this.notifyListeners();
  }
  
  // Get real-time calculated price
  public getRealtimePrice(): bigint | null {
    if (!this.state.auctionParams || !this.state.auction?.isAuctionPhase) {
      return null;
    }
    
    return this.priceCalculator.calculateCurrentPrice(this.state.auctionParams);
  }
  
  // Get real-time auction state with calculated price
  public getRealtimeAuction(): AuctionState | null {
    const auction = this.state.auction;
    if (!auction) return null;
    
    const realtimePrice = this.getRealtimePrice();
    if (realtimePrice !== null) {
      return {
        ...auction,
        currentPrice: realtimePrice
      };
    }
    
    return auction;
  }
  
  // Record yeet attempt
  public recordYeetAttempt(success: boolean, amount?: bigint, bgtEarned?: bigint): void {
    this.state.stats.totalYeets++;
    
    if (success) {
      this.state.stats.successfulYeets++;
      if (amount) {
        this.state.stats.totalSpent += amount;
      }
      if (bgtEarned) {
        this.state.stats.totalBgtEarned += bgtEarned;
      }
    } else {
      this.state.stats.failedYeets++;
    }
    
    logger.metric('yeet_attempt', success ? 1 : 0, undefined, {
      success,
      amount: amount?.toString(),
      bgtEarned: bgtEarned?.toString(),
      totalYeets: this.state.stats.totalYeets,
      successRate: (this.state.stats.successfulYeets / this.state.stats.totalYeets * 100).toFixed(2),
    });
    
    this.notifyListeners();
  }
  
  // Calculate current BGT accumulation
  public calculateCurrentBgt(): BGTRewards | null {
    const auction = this.state.auction;
    if (!auction || !auction.currentLeader) {
      return null;
    }
    
    const now = Date.now();
    const timeElapsed = Math.floor((now - auction.leaderTimestamp.getTime()) / 1000);
    const totalAccumulated = this.state.bgtPerSecond * BigInt(timeElapsed);
    
    return {
      bgtPerSecond: this.state.bgtPerSecond,
      totalAccumulated,
      timeElapsed,
    };
  }
  
  // Check if we're the current leader
  public isOurWallet(address: string, ourWallets: Set<string>): boolean {
    return ourWallets.has(address.toLowerCase());
  }
  
  // Get session statistics
  public getSessionStats() {
    const sessionDuration = Date.now() - this.state.stats.sessionStartTime.getTime();
    const successRate = this.state.stats.totalYeets > 0
      ? (this.state.stats.successfulYeets / this.state.stats.totalYeets * 100)
      : 0;
    
    return {
      ...this.state.stats,
      sessionDuration,
      successRate,
      averageSpendPerYeet: this.state.stats.successfulYeets > 0
        ? this.state.stats.totalSpent / BigInt(this.state.stats.successfulYeets)
        : 0n,
      averageBgtPerYeet: this.state.stats.successfulYeets > 0
        ? this.state.stats.totalBgtEarned / BigInt(this.state.stats.successfulYeets)
        : 0n,
    };
  }
  
  // Subscribe to state changes
  public onStateChange(listener: (state: GameState) => void): () => void {
    this.stateChangeListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.stateChangeListeners.indexOf(listener);
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1);
      }
    };
  }
  
  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.stateChangeListeners) {
      try {
        listener(state);
      } catch (error) {
        logger.error('State change listener error', error as Error);
      }
    }
  }
  
  // Reset statistics
  public resetStats(): void {
    this.state.stats = {
      totalYeets: 0,
      successfulYeets: 0,
      failedYeets: 0,
      totalSpent: 0n,
      totalBgtEarned: 0n,
      sessionStartTime: new Date(),
    };
    
    logger.info('Statistics reset');
    this.notifyListeners();
  }
  
  // Export state for debugging
  public exportState(): string {
    return JSON.stringify(this.state, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2);
  }
  
  // Set historical data for dashboard
  public setHistoricalData(data: { history: any[]; plData: any[] }): void {
    this.state.historicalData = data;
    logger.info('Historical data updated', {
      historyCount: data.history.length,
      plCount: data.plData.length
    });
    this.notifyListeners();
  }
  
  // Get historical data
  public getHistoricalData(): { history: any[]; plData: any[] } | undefined {
    return this.state.historicalData;
  }
}

// Export singleton getter
export function getStateManager(): StateManager {
  return StateManager.getInstance();
}