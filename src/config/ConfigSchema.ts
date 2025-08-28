import { z, ZodError } from 'zod';

// Ethereum address validation
const ethereumAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' });

// Private key validation
const privateKey = z.string().regex(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid private key format' });

// Configuration schema
export const ConfigSchema = z.object({
  // Environment
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  
  // Network configuration
  network: z.object({
    rpcUrl: z.string().url({ message: 'Invalid RPC URL' }),
    wsUrl: z.string().url({ message: 'Invalid WebSocket URL' }).optional(),
    chainId: z.number().int().positive(),
  }),
  
  // Wallet configuration
  wallet: z.object({
    privateKey: privateKey,
    additionalPrivateKeys: z.array(privateKey).optional(),
  }),
  
  // Contract addresses
  contracts: z.object({
    yeetGame: ethereumAddress,
    yeetSettings: ethereumAddress,
    bgtReward: ethereumAddress.default('0xa63Af00B73a4D995c9bB4C399a81708f0b026A62'),
    bgtRedeem: ethereumAddress.default('0x656b95E550C07a9ffe548bd4085c72418Ceb1dba'),
  }),
  
  // Bot strategy configuration
  strategy: z.object({
    maxYeetAmount: z.string().regex(/^\d+(\.\d+)?$/, { message: 'Invalid amount format' }),
    expectedAuctionDuration: z.number().int().min(0).default(60),
    gasLimit: z.bigint().optional(),
    
    // Rule-specific thresholds
    rules: z.object({
      othersProfitThreshold: z.number().default(2),
      selfProfitThreshold: z.number().default(5),
      blacklistProfitThreshold: z.number().default(0),
      snipeBufferSeconds: z.number().default(3),
      maxAuctionFactor: z.number().default(1.4),
      blacklistedAddresses: z.array(ethereumAddress).default([]),
      bgtEqualsPriceBuffer: z.number().min(0).max(100).default(0), // Profit buffer % for BGT equals price rule
      marketPriceDiscountThreshold: z.number().min(0).max(100).default(5), // Discount % from last paid price to trigger
    }),
    
    // Gas multipliers for different scenarios
    gasMultipliers: z.object({
      standard: z.number().min(0.5).max(5).default(1.0),
      priority: z.number().min(0.5).max(5).default(1.2),
      aggressive: z.number().min(0.5).max(5).default(1.5),
      maximum: z.number().min(0.5).max(5).default(2.0),
    }).optional(),
    
    // BGT claiming configuration
    bgtClaiming: z.object({
      enabled: z.boolean().default(true),
      intervalMinutes: z.number().int().min(1).default(30),
      processingDelayMs: z.number().int().min(0).default(5000),
    }),
    
    // Profit thresholds to pre-calculate
    profitThresholds: z.array(z.number()).default([0, 10, 20, 40, 60]).optional(),
  }),
  
  // Monitoring configuration
  monitoring: z.object({
    enabled: z.boolean().default(true),
    heartbeatInterval: z.number().int().min(1000).default(30000), // 30 seconds
    metricsInterval: z.number().int().min(1000).default(60000), // 1 minute
  }),
  
  // Logging configuration
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'pretty']).default('pretty'),
    
    file: z.object({
      enabled: z.boolean().default(false),
      path: z.string().default('./logs'),
      maxSize: z.string().default('10m'),
      maxFiles: z.number().default(5),
    }).optional(),
    
    console: z.object({
      enabled: z.boolean().default(true),
      colors: z.boolean().default(true),
    }),
  }),
  
  // Notification configuration (placeholder for future implementation)
  notifications: z.object({}),
  
  // Safety and limits
  safety: z.object({
    dryRun: z.boolean().default(false),
    minWalletBalance: z.string().regex(/^\d+(\.\d+)?$/, { message: 'Invalid amount format' }).default('1'),
    
    // Circuit breaker configuration
    circuitBreaker: z.object({
      enabled: z.boolean().default(true),
      errorThreshold: z.number().int().min(1).default(5),
      resetTimeout: z.number().int().min(1000).default(60000), // 1 minute
    }),
  }),
});

// Export the inferred type
export type Config = z.infer<typeof ConfigSchema>;

// Validation function with detailed error messages
export function validateConfig(config: unknown): Config {
  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((err: any) => {
        const path = err.path.join('.');
        return `  - ${path}: ${err.message}`;
      }).join('\n');
      
      throw new Error(`Configuration validation failed:\n${errors}`);
    }
    throw error;
  }
}