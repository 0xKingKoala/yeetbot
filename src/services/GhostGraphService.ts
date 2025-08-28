import { Logger } from '../utils/Logger';
import { formatEther } from 'viem';

const logger = Logger.getInstance();

interface YeetRecord {
  id: string;
  userId: string;
  roundId: string;
  timestamp: string;
  ethAmount: string;
  bgtMinted: string;
  bgtEarnedDuringYeet: string;
  yeetNumber: string;
  isEmergencyYeet: boolean;
  previousLeader: string | null;
}

interface GhostGraphResponse {
  data: {
    yeetRecords: {
      items: YeetRecord[];
    };
  };
}

const RECENT_YEETS_QUERY = `
  query RecentYeets($limit: Int!) {
    yeetRecords(
      orderBy: "timestamp"
      orderDirection: "desc"
      limit: $limit
    ) {
      items {
        id
        userId
        roundId
        timestamp
        ethAmount
        bgtMinted
        bgtEarnedSnapshot
        bgtEarnedDuringYeet
        yeetNumber
        isEmergencyYeet
        previousLeader
      }
    }
  }
`;

export class GhostGraphService {
  private static instance: GhostGraphService;
  private readonly apiUrl = 'https://api.ghostlogs.xyz/gg/pub/cb75d897-84ea-463b-b32e-ad64554f30c8/ghostgraph';
  
  private constructor() {}
  
  public static getInstance(): GhostGraphService {
    if (!GhostGraphService.instance) {
      GhostGraphService.instance = new GhostGraphService();
    }
    return GhostGraphService.instance;
  }
  
  /**
   * Fetch the most recent yeet from GhostGraph
   */
  public async fetchLastYeet(): Promise<{
    lastPaidPrice: bigint;
    lastYeeter: string;
    roundNumber: number;
    timestamp: Date;
  } | null> {
    try {
      logger.info('Fetching last yeet from GhostGraph');
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: RECENT_YEETS_QUERY,
          variables: { limit: 1 }
        })
      });
      
      if (!response.ok) {
        throw new Error(`GhostGraph API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as GhostGraphResponse;
      
      if (data?.data?.yeetRecords?.items?.length > 0) {
        const lastYeet = data.data.yeetRecords.items[0];
        
        // Convert wei string to bigint
        const lastPaidPrice = BigInt(lastYeet.ethAmount);
        
        logger.info('Last yeet fetched from GhostGraph', {
          yeeter: lastYeet.userId,
          amount: formatEther(lastPaidPrice),
          round: lastYeet.roundId,
          timestamp: new Date(parseInt(lastYeet.timestamp) * 1000).toISOString()
        });
        
        return {
          lastPaidPrice,
          lastYeeter: lastYeet.userId,
          roundNumber: parseInt(lastYeet.roundId),
          timestamp: new Date(parseInt(lastYeet.timestamp) * 1000)
        };
      }
      
      logger.warn('No yeet records found in GhostGraph');
      return null;
    } catch (error) {
      logger.error('Failed to fetch last yeet from GhostGraph', error as Error);
      return null;
    }
  }
  
  /**
   * Fetch recent yeets for analysis
   */
  public async fetchRecentYeets(limit: number = 10): Promise<YeetRecord[]> {
    try {
      logger.info(`Fetching ${limit} recent yeets from GhostGraph`);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: RECENT_YEETS_QUERY,
          variables: { limit }
        })
      });
      
      if (!response.ok) {
        throw new Error(`GhostGraph API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as GhostGraphResponse;
      
      if (data?.data?.yeetRecords?.items) {
        logger.info(`Fetched ${data.data.yeetRecords.items.length} yeets from GhostGraph`);
        return data.data.yeetRecords.items;
      }
      
      return [];
    } catch (error) {
      logger.error('Failed to fetch recent yeets from GhostGraph', error as Error);
      return [];
    }
  }
  
  /**
   * Fetch historical yeets with P&L calculations for dashboard
   */
  public async fetchHistoricalYeetsWithPL(limit: number = 50): Promise<{
    history: Array<{
      timestamp: Date;
      round: number;
      address: string;
      amount: string;
      duration?: number;
      isOurs?: boolean;
    }>;
    plData: Array<{
      timestamp: Date;
      address: string;
      amount: number;
      bgtEarned: number;
      isActive: boolean;
      isOurs?: boolean;
    }>;
  }> {
    try {
      logger.info(`Fetching ${limit} historical yeets for dashboard`);
      
      const recentYeets = await this.fetchRecentYeets(limit);
      
      if (recentYeets.length === 0) {
        return { history: [], plData: [] };
      }
      
      const history: any[] = [];
      const plData: any[] = [];
      
      // Process yeets in chronological order (reverse the array since it's desc)
      const chronologicalYeets = [...recentYeets].reverse();
      
      for (let i = 0; i < chronologicalYeets.length; i++) {
        const yeet = chronologicalYeets[i];
        const nextYeet = chronologicalYeets[i + 1];
        
        const timestamp = new Date(parseInt(yeet.timestamp) * 1000);
        const amount = parseFloat(formatEther(BigInt(yeet.ethAmount)));
        const bgtEarned = parseFloat(formatEther(BigInt(yeet.bgtEarnedDuringYeet || '0')));
        
        // Calculate duration (time until next yeet)
        let duration: number | undefined;
        if (nextYeet) {
          duration = parseInt(nextYeet.timestamp) - parseInt(yeet.timestamp);
        }
        
        // Add to history
        history.push({
          timestamp,
          round: parseInt(yeet.roundId),
          address: yeet.userId,
          amount: amount.toFixed(4),
          duration,
          isOurs: false // Will be updated by the bot if it recognizes its own address
        });
        
        // Add to P&L data
        plData.push({
          timestamp,
          address: yeet.userId,
          amount,
          bgtEarned,
          isActive: !nextYeet, // Last yeet is still active
          isOurs: false // Will be updated by the bot
        });
      }
      
      logger.info(`Processed ${history.length} historical yeets with P&L data`);
      
      return { history, plData };
    } catch (error) {
      logger.error('Failed to fetch historical yeets with P&L', error as Error);
      return { history: [], plData: [] };
    }
  }
  
  /**
   * Calculate average paid price from recent yeets
   */
  public async getAveragePaidPrice(limit: number = 20): Promise<bigint | null> {
    try {
      const recentYeets = await this.fetchRecentYeets(limit);
      
      if (recentYeets.length === 0) {
        return null;
      }
      
      // Filter out emergency yeets as they might skew the average
      const normalYeets = recentYeets.filter(y => !y.isEmergencyYeet);
      
      if (normalYeets.length === 0) {
        return null;
      }
      
      // Calculate average
      const total = normalYeets.reduce((sum, yeet) => {
        return sum + BigInt(yeet.ethAmount);
      }, 0n);
      
      const average = total / BigInt(normalYeets.length);
      
      logger.info('Calculated average paid price', {
        sampleSize: normalYeets.length,
        average: formatEther(average)
      });
      
      return average;
    } catch (error) {
      logger.error('Failed to calculate average paid price', error as Error);
      return null;
    }
  }
}

// Export singleton getter
export function getGhostGraphService(): GhostGraphService {
  return GhostGraphService.getInstance();
}