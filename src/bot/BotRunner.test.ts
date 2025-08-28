import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BotRunner } from './BotRunner';
import { Config } from '../config/Config';
import { BlockchainService } from '../services/BlockchainService';
import { EventManager } from '../services/EventManager';
import { StateManager } from '../services/StateManager';

// Mock all services
vi.mock('../config/Config');
vi.mock('../services/BlockchainService');
vi.mock('../services/EventManager');
vi.mock('../services/StateManager');
vi.mock('../utils/Logger');

describe('BotRunner', () => {
  let botRunner: BotRunner;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Config
    vi.mocked(Config.getInstance).mockReturnValue({
      get: () => ({
        environment: 'test',
        safety: { dryRun: true, minWalletBalance: '1' },
        strategy: {
          maxYeetAmount: '10',
          rules: {
            othersProfitThreshold: 2,
            selfProfitThreshold: 5,
            blacklistProfitThreshold: 0,
            snipeBufferSeconds: 3,
            maxAuctionFactor: 1.4,
            blacklistedAddresses: [],
          },
        },
        wallet: { privateKey: '0x' + '0'.repeat(64) },
        contracts: {
          yeetGame: '0x' + '0'.repeat(40),
          yeetSettings: '0x' + '0'.repeat(40),
        },
      }),
      getMinWalletBalanceWei: () => 1000000000000000000n, // 1 BERA
      getMaxYeetAmountWei: () => 10000000000000000000n, // 10 BERA
    } as any);
    
    // Mock BlockchainService
    vi.mocked(BlockchainService.getInstance).mockReturnValue({
      checkHealth: vi.fn().mockResolvedValue({ connected: true, chainId: 1 }),
      getBalance: vi.fn().mockResolvedValue(5000000000000000000n), // 5 BERA
      getAccount: vi.fn().mockReturnValue({ address: '0x' + '1'.repeat(40) }),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as any);
    
    // Mock EventManager
    vi.mocked(EventManager.getInstance).mockReturnValue({
      setHandlers: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    } as any);
    
    // Mock StateManager
    vi.mocked(StateManager.getInstance).mockReturnValue({
      getState: vi.fn().mockReturnValue({
        auction: null,
        isInCooldown: false,
        stats: {
          totalYeets: 0,
          successfulYeets: 0,
          failedYeets: 0,
          totalSpent: 0n,
          totalBgtEarned: 0n,
          sessionStartTime: new Date(),
        },
      }),
      getSessionStats: vi.fn().mockReturnValue({
        totalYeets: 0,
        successfulYeets: 0,
        failedYeets: 0,
        totalSpent: 0n,
        totalBgtEarned: 0n,
        successRate: 0,
        sessionDuration: 0,
      }),
      isOurWallet: vi.fn().mockReturnValue(false),
      recordYeetAttempt: vi.fn(),
    } as any);
    
    botRunner = new BotRunner();
  });
  
  describe('start', () => {
    it('should start successfully with valid configuration', async () => {
      await expect(botRunner.start()).resolves.not.toThrow();
    });
    
    it('should fail if blockchain is not connected', async () => {
      vi.mocked(BlockchainService.getInstance().checkHealth).mockResolvedValueOnce({
        connected: false,
        lastCheckTime: new Date(),
      });
      
      await expect(botRunner.start()).rejects.toThrow('Failed to connect to blockchain');
    });
    
    it('should fail if wallet balance is insufficient', async () => {
      vi.mocked(BlockchainService.getInstance().getBalance).mockResolvedValueOnce(
        500000000000000000n // 0.5 BERA
      );
      
      await expect(botRunner.start()).rejects.toThrow('Insufficient balance');
    });
  });
  
  describe('stop', () => {
    it('should stop gracefully', async () => {
      await botRunner.start();
      await expect(botRunner.stop()).resolves.not.toThrow();
      
      expect(EventManager.getInstance().stop).toHaveBeenCalled();
      expect(BlockchainService.getInstance().cleanup).toHaveBeenCalled();
    });
    
    it('should do nothing if not running', async () => {
      await expect(botRunner.stop()).resolves.not.toThrow();
    });
  });
});