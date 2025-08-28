import {type Log, type Abi, decodeEventLog, type Hash, type MulticallParameters, formatEther} from 'viem';
import {BlockchainService} from './BlockchainService';
import {StateManager} from './StateManager';
import {GhostGraphService} from './GhostGraphService';
import {logger} from '../utils/Logger';
import {YEET_GAME_ABI, YEET_EVENTS, YEET_SETTINGS_ABI} from '../contracts/abis';
import {Config} from '../config/Config';
import {AuctionState} from '../core/types';

// Contract event structure
export interface YeetEvent {
  yeeter: string;
  previousLeader: string;
  value: bigint;
  timestamp: bigint;
  leaderSince: bigint;
  roundNumber: bigint;
  nrOfYeets: bigint;
  isEmergencyYeet: boolean;
}

// Handler event structure (for backward compatibility)
export interface YeetCreatedEvent {
  yeeter: string;
  yeetedAt: bigint;
  amount: bigint;
  newPrice: bigint;
  totalBurned: bigint;
}

export interface AuctionCreatedEvent {
  auctionId: bigint;
  startPrice: bigint;
  endPrice: bigint;
  duration: bigint;
}

export interface EventHandlers {
  onYeetCreated?: (event: YeetCreatedEvent, log: Log) => void | Promise<void>;
  onAuctionCreated?: (event: AuctionCreatedEvent, log: Log) => void | Promise<void>;
}

export class EventManager {
  private static instance: EventManager;
  private blockchain: BlockchainService;
  private stateManager: StateManager;
  private ghostGraph: GhostGraphService;
  private config = Config.getInstance().get();
  private eventHandlers: EventHandlers = {};
  private unsubscribers: (() => void)[] = [];
  private processedEvents = new Map<string, number>(); // Changed to Map with timestamp
  private isRunning = false;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly EVENT_RETENTION_MS = 6 * 60 * 60 * 1000; // 6 hour retention
  private lastPriceCheckLog?: number;

  private constructor() {
    this.blockchain = BlockchainService.getInstance();
    this.stateManager = StateManager.getInstance();
    this.ghostGraph = GhostGraphService.getInstance();
  }

  public static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  // Set event handlers
  public setHandlers(handlers: EventHandlers): void {
    this.eventHandlers = {...this.eventHandlers, ...handlers};
  }

  // Start watching events
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Event manager already running');
      return;
    }

    logger.info('Starting event manager');
    this.isRunning = true;

    try {
      // Set up event watchers
      await this.setupEventWatchers();

      // Fetch initial state
      await this.fetchCurrentState();
      
      // Fetch and emit historical data for dashboard
      await this.fetchAndEmitHistoricalData();

      // Start cleanup interval for processed events
      this.cleanupInterval = setInterval(() => {
        this.cleanupProcessedEvents();
      }, 60000); // Clean up every minute

      logger.info('Event manager started successfully');
    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start event manager', error as Error);
      throw error;
    }
  }

  // Stop watching events
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping event manager');
    this.isRunning = false;

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    // Unsubscribe from all events
    for (const unsubscribe of this.unsubscribers) {
      try {
        unsubscribe();
      } catch (error) {
        logger.warn('Failed to unsubscribe from event', {error});
      }
    }

    this.unsubscribers = [];
    this.processedEvents.clear();

    logger.info('Event manager stopped');
  }

  private async setupEventWatchers(): Promise<void> {
    const contractAddress = this.config.contracts.yeetGame as `0x${string}`;

    // Watch YeetEvent events from contract
    const yeetEventUnwatch = await this.blockchain.watchContractEvent({
      address: contractAddress,
      abi: YEET_GAME_ABI,
      eventName: 'YeetEvent',
      onLogs: (logs: Log[]) => this.handleYeetEventLogs(logs),
    }, (logs: Log[]) => this.handleYeetEventLogs(logs));
    this.unsubscribers.push(yeetEventUnwatch);

    // Monitor blocks to check for auction phase transitions
    const blockUnwatch = this.blockchain.getPublicClient().watchBlocks({
      onBlock: async (block) => {
        // Check if cooldown has ended and auction should start
        await this.checkAuctionPhase();
      },
      pollingInterval: 1000, // Check every second
    });
    this.unsubscribers.push(() => blockUnwatch());
  }

  private async fetchCurrentState(): Promise<void> {
    try {
      logger.info('Fetching current game state');

      const publicClient = this.blockchain.getPublicClient();
      const yeetContract = this.config.contracts.yeetGame as `0x${string}`;
      const settingsContract = this.config.contracts.yeetSettings as `0x${string}`;

      // Log contract addresses for debugging
      logger.debug('Using contract addresses', {
        yeetContract,
        settingsContract,
      });

      // Use multicall to fetch all data in one RPC call
      const contracts = [
        // Yeet contract calls
        {
          address: yeetContract,
          abi: YEET_GAME_ABI,
          functionName: 'getPricingInfo',
        },
        {
          address: yeetContract,
          abi: YEET_GAME_ABI,
          functionName: 'lastYeeted',
        },
        {
          address: yeetContract,
          abi: YEET_GAME_ABI,
          functionName: 'lastYeetedAt',
        },
        {
          address: yeetContract,
          abi: YEET_GAME_ABI,
          functionName: 'hasCooldownEnded',
        },
        // Settings contract calls
        {
          address: settingsContract,
          abi: YEET_SETTINGS_ABI,
          functionName: 'getExpectedBGTRewardPerSlot',
        },
        {
          address: settingsContract,
          abi: YEET_SETTINGS_ABI,
          functionName: 'getLeadershipDuration',
        },
        {
          address: settingsContract,
          abi: YEET_SETTINGS_ABI,
          functionName: 'getYeetCooldownSeconds',
        },
        {
          address: settingsContract,
          abi: YEET_SETTINGS_ABI,
          functionName: 'getAuctionMaxFactor',
        },
      ] as const;

      const results = await publicClient.multicall({contracts});

      // Check for errors in results
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'failure') {
          logger.error('Multicall result failed', {
            functionName: contracts[i].functionName,
            address: contracts[i].address,
            errorDetails: JSON.stringify(results[i]),
          } as any);
        }
      }

      // Parse results with error checking
      const pricingInfo = results[0].status === 'success' ? results[0].result as any : null;
      const lastYeetedAddress = results[1].status === 'success' ? results[1].result as string : ''; // Address of last yeeter
      const lastYeetedAt = results[2].status === 'success' ? results[2].result as bigint : 0n;
      const hasCooldownEnded = results[3].status === 'success' ? results[3].result as boolean : false;
      const expectedBGTPerSlot = results[4].status === 'success' ? results[4].result as bigint : 0n;
      //todo, this is for the win condition, iuf you want to get the leadership duration, use the lastYeetedAt and compare the timestamp
      const leadershipDuration = results[5].status === 'success' ? results[5].result as bigint : 0n;
      const cooldownDuration = results[6].status === 'success' ? results[6].result as bigint : 0n;
      const auctionMaxFactor = results[7].status === 'success' ? results[7].result as bigint : 14000n;

      // Check if critical data is missing
      if (!pricingInfo) {
        throw new Error('Failed to fetch pricing info from contract');
      }

      // getPricingInfo returns a tuple with 8 values
      // Destructure the pricing info properly
      const [currentPrice, startPrice, minPrice, auctionDuration, timeElapsed, auctionTimeElapsed, inCooldown, pricingMode] = pricingInfo as [
        bigint, bigint, bigint, bigint, bigint, bigint, boolean, number
      ];

      // Calculate BGT per second (BGT is earned during cooldown, not leadership duration)
      // BGT per slot is earned over the cooldown period
      const bgtPerSecond = cooldownDuration > 0n ? expectedBGTPerSlot / cooldownDuration : 0n;

      // Update state manager
      this.stateManager.updateBgtRate(bgtPerSecond);
      this.stateManager.updateSlotDuration(Number(cooldownDuration));

      // Check if we're in auction phase (not in cooldown and price is dropping)
      const isAuctionPhase = !inCooldown && currentPrice < startPrice;
      
      // Store auction parameters for real-time price calculation
      if (isAuctionPhase) {
        // Calculate when auction started based on time elapsed in auction
        const auctionStartTime = new Date(Date.now() - Number(auctionTimeElapsed) * 1000);
        this.stateManager.updateAuctionParams({
          startPrice,
          minPrice,
          auctionDuration: Number(auctionDuration),
          auctionStartTime
        });
      }

      // Try to fetch the actual last paid price from GhostGraph
      let lastPaidPrice = startPrice || 0n;
      let lastYeetRound: number | undefined;
      
      try {
        const historicalData = await this.ghostGraph.fetchLastYeet();
        if (historicalData) {
          lastPaidPrice = historicalData.lastPaidPrice;
          lastYeetRound = historicalData.roundNumber;
          logger.info('Fetched historical last paid price from GhostGraph', {
            amount: formatEther(lastPaidPrice),
            round: lastYeetRound
          });
        }
      } catch (error) {
        logger.warn('Could not fetch historical data, using contract start price', {
          fallbackPrice: formatEther(lastPaidPrice)
        });
      }

      // Calculate auction start time if in auction phase
      let auctionStartTime: Date | undefined;
      if (isAuctionPhase && auctionTimeElapsed >= 0) {
        // Auction started auctionTimeElapsed seconds ago
        auctionStartTime = new Date(Date.now() - Number(auctionTimeElapsed) * 1000);
      }

      // Update auction state
      const auctionState: AuctionState = {
        currentPrice,
        currentLeader: lastYeetedAddress || '', // Use lastYeeted address
        leaderAmount: lastPaidPrice, // Use the actual last paid price
        leaderTimestamp: new Date(Number(lastYeetedAt) * 1000),
        isAuctionPhase,
        auctionMaxFactor: Number(auctionMaxFactor) / 10000, // Convert from basis points
        lastPaidPrice,
        lastYeetRound,
        auctionStartTime,
      };

      this.stateManager.updateAuction(auctionState);

      logger.info('Current game state fetched', {
        currentPrice: currentPrice.toString(),
        startPrice: startPrice.toString(),
        minPrice: minPrice.toString(),
        auctionDuration: auctionDuration.toString(),
        timeElapsed: timeElapsed.toString(),
        auctionTimeElapsed: auctionTimeElapsed.toString(),
        inCooldown,
        pricingMode,
        currentLeader: auctionState.currentLeader,
        isAuctionPhase,
        hasCooldownEnded,
        bgtPerSecond: bgtPerSecond.toString(),
        slotDuration: Number(leadershipDuration),
        cooldownDuration: Number(cooldownDuration),
        auctionMaxFactor: auctionState.auctionMaxFactor,
      });
    } catch (error) {
      logger.error('Failed to fetch current state', error as Error);
      throw error;
    }
  }

  private async handleYeetEventLogs(logs: Log[]): Promise<void> {
    for (const log of logs) {
      const eventId = `${log.transactionHash}-${log.logIndex}`;

      // Skip if already processed
      if (this.processedEvents.has(eventId)) {
        continue;
      }

      try {
        // Decode contract event
        const decoded = decodeEventLog({
          abi: YEET_GAME_ABI,
          data: log.data,
          topics: log.topics,
        });
        const contractEvent = decoded.args as any as YeetEvent;

        logger.info('YeetEvent received from contract', {
          yeeter: contractEvent.yeeter,
          previousLeader: contractEvent.previousLeader,
          value: contractEvent.value.toString(),
          timestamp: contractEvent.timestamp.toString(),
          roundNumber: contractEvent.roundNumber.toString(),
          isEmergencyYeet: contractEvent.isEmergencyYeet,
          txHash: log.transactionHash,
        });

        // Fetch current price after yeet
        const currentPrice = await this.blockchain.getPublicClient().readContract({
          address: this.config.contracts.yeetGame as `0x${string}`,
          abi: YEET_GAME_ABI,
          functionName: 'getCurrentYeetPrice',
        }) as bigint;

        // Update auction state with the actual paid price
        const auctionState: AuctionState = {
          currentPrice,
          currentLeader: contractEvent.yeeter,
          leaderAmount: contractEvent.value,
          leaderTimestamp: new Date(Number(contractEvent.timestamp) * 1000),
          isAuctionPhase: false, // YeetEvent means we're not in auction anymore
          auctionMaxFactor: this.stateManager.getState().auction?.auctionMaxFactor || 1.4,
          lastPaidPrice: contractEvent.value, // Track what was actually paid
          lastYeetRound: Number(contractEvent.roundNumber),
        };

        this.stateManager.updateAuction(auctionState);

        // Update cooldown state - get cooldown duration from settings
        const cooldownDuration = await this.blockchain.getPublicClient().readContract({
          address: this.config.contracts.yeetSettings as `0x${string}`,
          abi: YEET_SETTINGS_ABI,
          functionName: 'getYeetCooldownSeconds',
        }) as bigint;

        const cooldownEndTime = new Date(Date.now() + Number(cooldownDuration) * 1000);
        this.stateManager.updateCooldown(true, cooldownEndTime);
        
        // Update historical data with new yeet
        const ourAddress = this.blockchain.getAccount().address.toLowerCase();
        const isOurs = contractEvent.yeeter.toLowerCase() === ourAddress;
        
        // Create history entry
        const historyEntry = {
          timestamp: new Date(Number(contractEvent.timestamp) * 1000),
          round: Number(contractEvent.roundNumber),
          address: contractEvent.yeeter,
          amount: parseFloat(formatEther(contractEvent.value)).toFixed(4),
          duration: undefined, // Will be calculated when next yeet happens
          isOurs
        };
        
        // Create P&L entry (simplified - actual BGT earned will be calculated later)
        const plEntry = {
          timestamp: new Date(Number(contractEvent.timestamp) * 1000),
          address: contractEvent.yeeter,
          amount: parseFloat(formatEther(contractEvent.value)),
          bgtEarned: 0, // Will be updated when they get yeeted
          isActive: true, // They're the current leader
          isOurs
        };
        
        // Get current historical data
        const currentHistoricalData = this.stateManager.getHistoricalData() || { history: [], plData: [] };
        
        // Mark previous leader as inactive and calculate their BGT earnings
        if (currentHistoricalData.plData.length > 0) {
          const prevLeader = currentHistoricalData.plData[currentHistoricalData.plData.length - 1];
          if (prevLeader.isActive) {
            prevLeader.isActive = false;
            // Calculate approximate BGT earned (simplified calculation)
            const timeDiff = (historyEntry.timestamp.getTime() - prevLeader.timestamp.getTime()) / 1000;
            const bgtPerSecond = this.stateManager.getState().bgtPerSecond;
            prevLeader.bgtEarned = parseFloat(formatEther(bgtPerSecond * BigInt(Math.floor(timeDiff))));
          }
        }
        
        // Update previous history entry with duration
        if (currentHistoricalData.history.length > 0) {
          const prevHistory = currentHistoricalData.history[currentHistoricalData.history.length - 1];
          prevHistory.duration = Math.floor((historyEntry.timestamp.getTime() - prevHistory.timestamp.getTime()) / 1000);
        }
        
        // Add new entries
        currentHistoricalData.history.push(historyEntry);
        currentHistoricalData.plData.push(plEntry);
        
        // Keep only last 100 entries
        if (currentHistoricalData.history.length > 100) {
          currentHistoricalData.history = currentHistoricalData.history.slice(-100);
        }
        if (currentHistoricalData.plData.length > 100) {
          currentHistoricalData.plData = currentHistoricalData.plData.slice(-100);
        }
        
        // Update state manager
        this.stateManager.setHistoricalData(currentHistoricalData);

        // Map to YeetCreatedEvent for handlers
        if (this.eventHandlers.onYeetCreated) {
          const handlerEvent: YeetCreatedEvent = {
            yeeter: contractEvent.yeeter,
            yeetedAt: contractEvent.timestamp,
            amount: contractEvent.value,
            newPrice: currentPrice,
            totalBurned: 0n, // Not available in contract event
          };
          await this.eventHandlers.onYeetCreated(handlerEvent, log);
        }

        this.processedEvents.set(eventId, Date.now());
      } catch (error) {
        logger.error('Failed to process YeetEvent', error as Error, {
          txHash: log.transactionHash,
          logIndex: log.logIndex,
        });
      }
    }
  }


  private async checkAuctionPhase(): Promise<void> {
    try {
      const publicClient = this.blockchain.getPublicClient();
      const yeetContract = this.config.contracts.yeetGame as `0x${string}`;
      const settingsContract = this.config.contracts.yeetSettings as `0x${string}`;

      const currentState = this.stateManager.getState();

      // First, check if we're in auction phase by fetching current pricing info
      const pricingInfo = await publicClient.readContract({
        address: yeetContract,
        abi: YEET_GAME_ABI,
        functionName: 'getPricingInfo',
      }) as any;

      const [currentPrice, startPrice, minPrice, auctionDuration, timeElapsed, auctionTimeElapsed, inCooldown, pricingMode] = pricingInfo as [
        bigint, bigint, bigint, bigint, bigint, bigint, boolean, number
      ];

      // We're in auction phase if not in cooldown and price is dropping
      const isAuctionPhase = !inCooldown && currentPrice < startPrice;

      // If cooldown just ended and we weren't in auction before, emit AuctionCreated event
      if (isAuctionPhase && currentState.isInCooldown) {
        logger.info('Cooldown ended, entering auction phase');

        // Update cooldown state
        this.stateManager.updateCooldown(false);

        // Update auction state with the pricing info we already have
        if (currentState.auction) {
          // Calculate auction start time from auctionTimeElapsed
          const auctionStartTime = auctionTimeElapsed >= 0 
            ? new Date(Date.now() - Number(auctionTimeElapsed) * 1000)
            : new Date();
            
          this.stateManager.updateAuction({
            ...currentState.auction,
            currentPrice,
            isAuctionPhase: true,
            auctionStartTime,
          });
        }

        // Emit synthetic AuctionCreated event
        if (this.eventHandlers.onAuctionCreated) {
          const auctionEvent: AuctionCreatedEvent = {
            auctionId: BigInt(Date.now()), // Use timestamp as synthetic auction ID
            startPrice,
            endPrice: minPrice,
            duration: auctionDuration,
          };

          // Create a synthetic log for the event
          const syntheticLog: Log = {
            address: yeetContract,
            topics: [],
            data: '0x',
            blockNumber: await publicClient.getBlockNumber(),
            transactionHash: '0x' + '0'.repeat(64) as Hash,
            transactionIndex: 0,
            blockHash: '0x' + '0'.repeat(64) as Hash,
            logIndex: 0,
            removed: false,
          };

          logger.info('Emitting synthetic AuctionCreated event', {
            startPrice: auctionEvent.startPrice.toString(),
            endPrice: auctionEvent.endPrice.toString(),
            duration: auctionEvent.duration.toString(),
          });
          
          // Store auction parameters for real-time price calculation
          this.stateManager.updateAuctionParams({
            startPrice,
            minPrice,
            auctionDuration: Number(auctionDuration),
            auctionStartTime: new Date() // Auction just started
          });

          await this.eventHandlers.onAuctionCreated(auctionEvent, syntheticLog);
        }
      } else if (isAuctionPhase && currentState.auction) {
        // We're in auction phase, update the current price if it has changed
        // We already have the current price from getPricingInfo above
        if (currentPrice !== currentState.auction.currentPrice) {
          logger.info('Price updated during auction', {
            oldPrice: formatEther(currentState.auction.currentPrice),
            newPrice: formatEther(currentPrice),
            drop: formatEther(currentState.auction.currentPrice - currentPrice)
          });
          // Calculate auction start time if not already set
          const auctionStartTime = currentState.auction.auctionStartTime || 
            (auctionTimeElapsed >= 0 
              ? new Date(Date.now() - Number(auctionTimeElapsed) * 1000)
              : new Date());
              
          this.stateManager.updateAuction({
            ...currentState.auction,
            currentPrice,
            isAuctionPhase: true,
            auctionStartTime,
          });
        } else {
          // Log periodically that we're checking but price hasn't changed
          const now = Date.now();
          if (!this.lastPriceCheckLog || now - this.lastPriceCheckLog > 10000) {
            this.lastPriceCheckLog = now;
            logger.debug('Auction price check', {
              currentPrice: formatEther(currentPrice),
              isAuctionPhase,
              inCooldown
            });
          }
        }
      } else if (!isAuctionPhase && currentState.auction?.isAuctionPhase) {
        // We were in auction phase but now we're not (someone yeeted)
        logger.info('Auction phase ended');
        this.stateManager.updateAuction({
          ...currentState.auction,
          isAuctionPhase: false,
        });
        this.stateManager.updateCooldown(true, new Date(Date.now() + 180000)); // Assuming 3 min cooldown
      }
    } catch (error) {
      logger.error('Failed to check auction phase', error as Error);
    }
  }

  // Manual state refresh
  public async refreshState(): Promise<void> {
    await this.fetchCurrentState();
  }

  // Check if the bot is ready (initial state fetched)
  public isReady(): boolean {
    const state = this.stateManager.getState();
    return state.auction !== null && state.bgtPerSecond > 0n;
  }

  // Clean up old processed events to prevent memory leak
  private cleanupProcessedEvents(): void {
    const now = Date.now();
    const cutoffTime = now - this.EVENT_RETENTION_MS;
    let removedCount = 0;

    for (const [eventId, timestamp] of this.processedEvents.entries()) {
      if (timestamp < cutoffTime) {
        this.processedEvents.delete(eventId);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} old processed events`);
    }
  }
  
  private async fetchAndEmitHistoricalData(): Promise<void> {
    try {
      logger.info('Fetching historical yeet data for dashboard');
      
      const ghostGraphService = GhostGraphService.getInstance();
      const { history, plData } = await ghostGraphService.fetchHistoricalYeetsWithPL(50);
      
      // Check if any of the addresses are ours
      const ourAddress = this.blockchain.getAccount().address.toLowerCase();
      
      history.forEach(entry => {
        if (entry.address.toLowerCase() === ourAddress) {
          entry.isOurs = true;
        }
      });
      
      plData.forEach(entry => {
        if (entry.address.toLowerCase() === ourAddress) {
          entry.isOurs = true;
        }
      });
      
      // Emit to dashboard if WebSocket server is available
      // This will be handled by the dashboard server when it's implemented
      logger.info(`Fetched ${history.length} historical yeets and ${plData.length} P&L entries`);
      
      // Store in state manager for later access
      this.stateManager.setHistoricalData({ history, plData });
    } catch (error) {
      logger.error('Failed to fetch historical data', error as Error);
    }
  }
}

// Export singleton getter
export function getEventManager(): EventManager {
  return EventManager.getInstance();
}