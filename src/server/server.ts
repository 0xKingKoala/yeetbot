import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { BotRunner } from '../bot/BotRunner';
import { StateManager } from '../services/StateManager';
import { BGTClaimService } from '../services/BGTClaimService';
import { Config } from '../config/Config';
import { Logger } from '../utils/Logger';
import { WebSocketTransport } from './WebSocketTransport';
import { formatEther } from 'viem';
import path from 'path';

const logger = Logger.getInstance();

export class DashboardServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private botRunner: BotRunner;
  private stateManager = StateManager.getInstance();
  private bgtClaimService = BGTClaimService.getInstance();
  private config = Config.getInstance().get();
  private port: number;
  private updateInterval?: NodeJS.Timeout;
  private auctionStartTime: Date | null = null;
  private wsTransport: WebSocketTransport;
  private lastDebugLog?: number;
  private stateChangeUnsubscribe?: () => void;

  constructor(botRunner: BotRunner, port: number = 3000) {
    this.botRunner = botRunner;
    this.port = port;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: ["http://localhost:5173", "http://localhost:3001"], // Vite and CRA default ports
        methods: ["GET", "POST"]
      }
    });

    // Create WebSocket transport for logging
    this.wsTransport = new WebSocketTransport({ level: 'info' });
    this.wsTransport.setSocketServer(this.io);
    
    // Add transport to logger
    const winstonLogger = logger.getWinstonLogger();
    winstonLogger.add(this.wsTransport);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Serve static files from React build
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(path.join(__dirname, '../../../web/build')));
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date() });
    });

    // Get current state
    this.app.get('/api/state', (req, res) => {
      const state = this.stateManager.getState();
      const realtimeAuction = this.stateManager.getRealtimeAuction();
      const decisionEngine = this.botRunner.getDecisionEngine();
      const evaluations = decisionEngine?.getLastEvaluations();
      
      // Use real-time auction if available
      const stateToSend = realtimeAuction ? { ...state, auction: realtimeAuction } : state;
      
      res.json({
        state: this.formatState(stateToSend),
        rules: this.formatRules(evaluations),
        config: {
          dryRun: this.config.safety.dryRun,
          maxYeetAmount: this.config.strategy.maxYeetAmount
        }
      });
    });

    // Actions
    this.app.post('/api/actions/yeet', async (req, res) => {
      try {
        if (!this.config.safety.dryRun) {
          // Execute force yeet with real-time price
          await this.botRunner.forceYeet();
          
          // Get the updated real-time price for response
          const realtimeAuction = this.stateManager.getRealtimeAuction();
          const price = realtimeAuction?.currentPrice ? formatEther(realtimeAuction.currentPrice) : 'N/A';
          
          logger.info('Force yeet executed via API', { price });
          res.json({ 
            success: true, 
            message: 'Yeet executed',
            price: price + ' BERA'
          });
        } else {
          const realtimeAuction = this.stateManager.getRealtimeAuction();
          const price = realtimeAuction?.currentPrice ? formatEther(realtimeAuction.currentPrice) : 'N/A';
          
          res.json({ 
            success: true, 
            message: 'DRY RUN: Would execute yeet',
            price: price + ' BERA'
          });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
      }
    });

    this.app.post('/api/actions/claim', async (req, res) => {
      try {
        await this.bgtClaimService.claimNow();
        res.json({ success: true, message: 'BGT claim initiated' });
      } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
      }
    });

    this.app.post('/api/actions/pause', (req, res) => {
      this.botRunner.pause();
      res.json({ success: true, message: 'Bot paused' });
    });

    this.app.post('/api/actions/resume', (req, res) => {
      this.botRunner.resume();
      res.json({ success: true, message: 'Bot resumed' });
    });

    // Catch all for React routing
    if (process.env.NODE_ENV === 'production') {
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../../web/build/index.html'));
      });
    }
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info('Dashboard client connected', { id: socket.id });

      // Send initial state
      const state = this.stateManager.getState();
      const realtimeAuction = this.stateManager.getRealtimeAuction();
      const decisionEngine = this.botRunner.getDecisionEngine();
      const evaluations = decisionEngine?.getLastEvaluations();
      
      // Use real-time auction if available
      const stateToSend = realtimeAuction ? { ...state, auction: realtimeAuction } : state;
      
      socket.emit('state:update', {
        state: this.formatState(stateToSend),
        rules: this.formatRules(evaluations)
      });
      
      // Send historical data if available
      const historicalData = this.stateManager.getHistoricalData();
      if (historicalData) {
        socket.emit('history:update', historicalData.history);
        socket.emit('pl:update', historicalData.plData);
      }

      socket.on('disconnect', () => {
        logger.info('Dashboard client disconnected', { id: socket.id });
      });
    });
  }

  private formatState(state: any): any {
    // Track auction start time for timing display
    if (state.auction?.isAuctionPhase && !this.auctionStartTime) {
      this.auctionStartTime = new Date();
    } else if (!state.auction?.isAuctionPhase) {
      this.auctionStartTime = null;
    }
    
    // Helper to format BERA values with 4 decimals
    const formatBera = (value: bigint): string => {
      const formatted = parseFloat(formatEther(value));
      return formatted.toFixed(4);
    };
    
    return {
      isInCooldown: state.isInCooldown,
      cooldownEndTime: state.cooldownEndTime,
      auction: state.auction ? {
        isAuctionPhase: state.auction.isAuctionPhase,
        currentPrice: formatBera(state.auction.currentPrice),
        currentLeader: state.auction.currentLeader,
        leaderTimestamp: state.auction.leaderTimestamp,
        auctionMaxFactor: state.auction.auctionMaxFactor,
        auctionStartTime: this.auctionStartTime,
        lastPaidPrice: state.auction.lastPaidPrice ? formatBera(state.auction.lastPaidPrice) : null,
        lastYeetRound: state.auction.lastYeetRound
      } : null,
      bgtPerSecond: formatBera(state.bgtPerSecond),
      stats: state.stats ? {
        totalYeets: state.stats.totalYeets,
        successfulYeets: state.stats.successfulYeets,
        failedYeets: state.stats.failedYeets,
        totalSpent: formatBera(state.stats.totalSpent),
        totalBgtEarned: formatBera(state.stats.totalBgtEarned),
        sessionStartTime: state.stats.sessionStartTime
      } : null
    };
  }

  private formatRules(evaluations: any): any {
    if (!evaluations) return null;
    
    return {
      decision: evaluations.decision,
      rules: evaluations.allEvaluations.map((e: any) => ({
        name: e.ruleName,
        triggered: e.triggered,
        shouldYeet: e.decision?.shouldYeet || false,
        reason: e.reason,
        priority: e.decision?.priority || 0,
        thoughts: e.thoughts ? {
          currentValue: e.thoughts.currentValue,
          targetValue: e.thoughts.targetValue,
          progress: e.thoughts.progress,
          reasoning: e.thoughts.reasoning,
          metadata: e.thoughts.metadata
        } : null
      }))
    };
  }

  public start(): void {
    // Listen for state changes to emit historical data updates
    this.stateChangeUnsubscribe = this.stateManager.onStateChange((state) => {
      if (state.historicalData) {
        // Emit historical data updates when they change
        this.io.emit('history:update', state.historicalData.history);
        this.io.emit('pl:update', state.historicalData.plData);
      }
    });
    
    // Start update loop
    this.updateInterval = setInterval(() => {
      const state = this.stateManager.getState();
      const realtimeAuction = this.stateManager.getRealtimeAuction();
      const decisionEngine = this.botRunner.getDecisionEngine();
      const evaluations = decisionEngine?.getLastEvaluations();
      
      // Use real-time auction if available
      const stateToSend = realtimeAuction ? { ...state, auction: realtimeAuction } : state;
      
      // Debug: Log state updates periodically
      const now = Date.now();
      if (!this.lastDebugLog || now - this.lastDebugLog > 5000) {
        this.lastDebugLog = now;
        logger.debug('Dashboard state broadcast', {
          hasState: !!stateToSend,
          isAuctionPhase: stateToSend?.auction?.isAuctionPhase,
          currentPrice: stateToSend?.auction?.currentPrice?.toString(),
          hasEvaluations: !!evaluations,
          connectedClients: this.io.sockets.sockets.size
        });
      }
      
      // Broadcast to all connected clients
      this.io.emit('state:update', {
        state: this.formatState(stateToSend),
        rules: this.formatRules(evaluations)
      });
    }, 1000); // Update every second

    this.server.listen(this.port, () => {
      logger.info(`Dashboard server running on http://localhost:${this.port}`);
    });
  }

  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Unsubscribe from state changes
    if (this.stateChangeUnsubscribe) {
      this.stateChangeUnsubscribe();
    }
    
    // Remove WebSocket transport from logger
    const winstonLogger = logger.getWinstonLogger();
    winstonLogger.remove(this.wsTransport);
    
    this.io.close();
    this.server.close();
  }
}

// Export convenience function
export async function startDashboardServer(botRunner: BotRunner, port?: number): Promise<DashboardServer> {
  const server = new DashboardServer(botRunner, port);
  server.start();
  return server;
}