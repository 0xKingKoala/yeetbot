import { config as dotenvConfig } from 'dotenv';
import { parseEther } from 'viem';
import { validateConfig, type Config as ConfigType } from './ConfigSchema';
import { existsSync } from 'fs';

export class Config {
  private static instance: Config;
  private config: ConfigType;
  
  private constructor() {
    // Load environment variables
    this.loadEnvironment();
    
    // Build configuration from environment
    const rawConfig = this.buildConfigFromEnv();
    
    // Validate configuration
    this.config = validateConfig(rawConfig);
  }
  
  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
  
  public get(): ConfigType {
    return this.config;
  }
  
  private loadEnvironment(): void {
    // Determine environment
    const env = process.env.NODE_ENV || 'development';
    
    // Load base .env file
    dotenvConfig();
    
    // Load environment-specific .env file if it exists
    const envFile = `.env.${env}`;
    if (existsSync(envFile)) {
      dotenvConfig({ path: envFile, override: true });
    }
    
    // Load local overrides if they exist
    const localFile = '.env.local';
    if (existsSync(localFile)) {
      dotenvConfig({ path: localFile, override: true });
    }
  }
  
  private buildConfigFromEnv(): unknown {
    // Helper to get required env var
    const required = (key: string): string => {
      const value = process.env[key];
      if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
      return value;
    };
    
    // Helper to get optional env var
    const optional = (key: string): string | undefined => {
      return process.env[key];
    };
    
    // Helper to parse boolean
    const bool = (key: string): boolean | undefined => {
      const value = process.env[key];
      if (!value) return undefined;
      return value.toLowerCase() === 'true';
    };
    
    // Helper to parse number
    const num = (key: string): number | undefined => {
      const value = process.env[key];
      if (!value) return undefined;
      const parsed = Number(value);
      if (isNaN(parsed)) {
        throw new Error(`Invalid number for ${key}: ${value}`);
      }
      return parsed;
    };
    
    // Helper to parse BigInt
    const bigint = (key: string): bigint | undefined => {
      const value = process.env[key];
      if (!value) return undefined;
      try {
        return BigInt(value);
      } catch {
        throw new Error(`Invalid BigInt for ${key}: ${value}`);
      }
    };
    
    // Parse blacklisted addresses
    const blacklistedAddresses = optional('BLACKLISTED_ADDRESSES')
      ?.split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
    
    // Parse additional private keys
    const additionalPrivateKeys = optional('ADDITIONAL_PRIVATE_KEYS')
      ?.split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);
    
    return {
      environment: process.env.NODE_ENV,
      
      network: {
        rpcUrl: required('RPC_URL'),
        wsUrl: optional('WS_URL'),
        chainId: num('CHAIN_ID'),
      },
      
      wallet: {
        privateKey: required('PRIVATE_KEY'),
        additionalPrivateKeys,
      },
      
      contracts: {
        yeetGame: required('YEET_GAME_CONTRACT'),
        yeetSettings: required('YEET_SETTINGS_CONTRACT'),
        bgtReward: optional('BGT_REWARD_CONTRACT'),
        bgtRedeem: optional('BGT_REDEEM_CONTRACT'),
      },
      
      strategy: {
        maxYeetAmount: optional('MAX_YEET_AMOUNT'),
        expectedAuctionDuration: num('EXPECTED_AUCTION_DURATION'),
        gasLimit: bigint('GAS_LIMIT'),
        
        rules: {
          othersProfitThreshold: num('OTHERS_PROFIT_THRESHOLD'),
          selfProfitThreshold: num('SELF_PROFIT_THRESHOLD'),
          blacklistProfitThreshold: num('BLACKLIST_PROFIT_THRESHOLD'),
          snipeBufferSeconds: num('SNIPE_BUFFER_SECONDS'),
          maxAuctionFactor: num('MAX_AUCTION_FACTOR'),
          blacklistedAddresses,
          bgtEqualsPriceBuffer: num('BGT_EQUALS_PRICE_BUFFER'),
          marketPriceDiscountThreshold: num('MARKET_PRICE_DISCOUNT_THRESHOLD'),
        },
        
        // Gas multipliers
        gasMultipliers: (optional('GAS_MULTIPLIER_STANDARD') || 
                        optional('GAS_MULTIPLIER_PRIORITY') ||
                        optional('GAS_MULTIPLIER_AGGRESSIVE') ||
                        optional('GAS_MULTIPLIER_MAXIMUM')) ? {
          standard: num('GAS_MULTIPLIER_STANDARD'),
          priority: num('GAS_MULTIPLIER_PRIORITY'),
          aggressive: num('GAS_MULTIPLIER_AGGRESSIVE'),
          maximum: num('GAS_MULTIPLIER_MAXIMUM'),
        } : undefined,
        
        // BGT claiming configuration
        bgtClaiming: {
          enabled: bool('BGT_CLAIMING_ENABLED'),
          intervalMinutes: num('BGT_CLAIMING_INTERVAL'),
          processingDelayMs: num('BGT_CLAIM_PROCESSING_DELAY'),
        },
        
        // Profit thresholds array
        profitThresholds: optional('PROFIT_THRESHOLDS')
          ?.split(',').map(Number).filter(n => !isNaN(n)),
      },
      
      monitoring: {
        enabled: bool('MONITORING_ENABLED'),
        heartbeatInterval: num('HEARTBEAT_INTERVAL'),
        metricsInterval: num('METRICS_INTERVAL'),
      },
      
      logging: {
        level: optional('LOG_LEVEL') as any,
        format: optional('LOG_FORMAT') as any,
        
        file: {
          enabled: bool('LOG_FILE_ENABLED'),
          path: optional('LOG_FILE_PATH'),
          maxSize: optional('LOG_FILE_MAX_SIZE'),
          maxFiles: num('LOG_FILE_MAX_FILES'),
        },
        
        console: {
          enabled: bool('LOG_CONSOLE_ENABLED'),
          colors: bool('LOG_CONSOLE_COLORS'),
        },
      },
      
      notifications: {},
      
      safety: {
        dryRun: bool('DRY_RUN'),
        minWalletBalance: optional('MIN_WALLET_BALANCE'),
        
        circuitBreaker: {
          enabled: bool('CIRCUIT_BREAKER_ENABLED'),
          errorThreshold: num('CIRCUIT_BREAKER_ERROR_THRESHOLD'),
          resetTimeout: num('CIRCUIT_BREAKER_RESET_TIMEOUT'),
        },
      },
    };
  }
  
  // Utility methods for common conversions
  public getMaxYeetAmountWei(): bigint {
    return parseEther(this.config.strategy.maxYeetAmount);
  }
  
  public getMinWalletBalanceWei(): bigint {
    return parseEther(this.config.safety.minWalletBalance);
  }
  
  public isProduction(): boolean {
    return this.config.environment === 'production';
  }
  
  public isDevelopment(): boolean {
    return this.config.environment === 'development';
  }
}

// Export singleton getter for convenience
export function getConfig(): ConfigType {
  return Config.getInstance().get();
}