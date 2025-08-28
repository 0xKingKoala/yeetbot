import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  type PublicClient,
  type WalletClient,
  type Account,
  type Chain,
  type Log,
  defineChain,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Config } from '../config/Config';
import { logger } from '../utils/Logger';

// Define Berachain
const berachainMainnet = defineChain({
  id: 80094,
  name: 'Berachain',
  nativeCurrency: {
    decimals: 18,
    name: 'BERA Token',
    symbol: 'BERA',
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 0,
    },
    ensRegistry: {
      address: '0x5b22280886a2f5e09a49bea7e320eab0e5320e28',
      blockCreated: 877007,
    },
    ensUniversalResolver: {
      address: '0xddfb18888a9466688235887dec2a10c4f5effee9',
      blockCreated: 877008,
    },
  },
  rpcUrls: {
    default: { http: ['https://rpc.berachain.com'] },
  },
  blockExplorers: {
    default: {
      name: 'Berascan',
      url: 'https://berascan.com',
    },
  },
  testnet: false,
});

export interface BlockchainHealthStatus {
  connected: boolean;
  blockNumber?: bigint;
  chainId?: number;
  clientVersion?: string;
  gasPrice?: bigint;
  lastCheckTime: Date;
  error?: string;
}

export class BlockchainService {
  private static instance: BlockchainService;
  private config = Config.getInstance().get();
  private publicClient!: PublicClient;
  private walletClient!: WalletClient;
  private wsClient?: PublicClient;
  private account!: Account;
  private chain!: Chain;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private eventUnsubscribers: (() => void)[] = [];

  private constructor() {
    this.initialize();
  }

  public static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService();
    }
    return BlockchainService.instance;
  }

  private initialize(): void {
    try {
      // Set up chain
      this.chain = {
        ...berachainMainnet,
        id: this.config.network.chainId,
      };

      // Set up account
      this.account = privateKeyToAccount(this.config.wallet.privateKey as `0x${string}`);

      // Create HTTP transport for public client
      const httpTransport = http(this.config.network.rpcUrl, {
        batch: true,
        retryCount: 3,
        retryDelay: 1000,
      });

      // Create public client
      this.publicClient = createPublicClient({
        chain: this.chain,
        transport: httpTransport,
      });

      // Create wallet client
      this.walletClient = createWalletClient({
        account: this.account,
        chain: this.chain,
        transport: httpTransport,
      });

      // Create WebSocket client if URL provided
      if (this.config.network.wsUrl) {
        this.initializeWebSocket();
      }

      logger.info('Blockchain service initialized', {
        chain: this.chain.name,
        chainId: this.chain.id,
        account: this.account.address,
        rpcUrl: this.config.network.rpcUrl,
        wsUrl: this.config.network.wsUrl,
      });
    } catch (error) {
      logger.error('Failed to initialize blockchain service', error as Error);
      throw error;
    }
  }

  private initializeWebSocket(): void {
    try {
      const wsTransport = webSocket(this.config.network.wsUrl!, {
        reconnect: {
          attempts: this.maxReconnectAttempts,
          delay: this.reconnectDelay,
        },
        retryCount: 3,
      });

      this.wsClient = createPublicClient({
        chain: this.chain,
        transport: wsTransport,
      });

      logger.info('WebSocket client initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket client', error as Error);
    }
  }

  // Public methods
  public getPublicClient(): PublicClient {
    return this.publicClient;
  }

  public getWalletClient(): WalletClient {
    return this.walletClient;
  }

  public getWsClient(): PublicClient | undefined {
    return this.wsClient;
  }

  public getAccount(): Account {
    return this.account;
  }

  public getChain(): Chain {
    return this.chain;
  }

  // Health check
  public async checkHealth(): Promise<BlockchainHealthStatus> {
    const status: BlockchainHealthStatus = {
      connected: false,
      lastCheckTime: new Date(),
    };

    try {
      // Get block number
      status.blockNumber = await this.publicClient.getBlockNumber();

      // Get chain ID
      status.chainId = await this.publicClient.getChainId();

      // Get gas price
      status.gasPrice = await this.publicClient.getGasPrice();

      // Try to get client version (may not be supported by all nodes)
      try {
        const clientVersion = await this.publicClient.request({
          method: 'web3_clientVersion' as any,
        });
        status.clientVersion = clientVersion as string;
      } catch {
        // Ignore if not supported
      }

      status.connected = true;

      logger.debug('Blockchain health check passed', status);
    } catch (error) {
      status.connected = false;
      status.error = (error as Error).message;
      logger.error('Blockchain health check failed', error as Error);
    }

    return status;
  }

  // Watch for events (uses WebSocket if available, falls back to HTTP polling)
  public async watchContractEvent(
    params: any,
    onLogs: (logs: Log[]) => void
  ): Promise<() => void> {
    const client = this.wsClient || this.publicClient;

    logger.debug('Setting up event watcher', {
      address: params.address,
      eventName: params.eventName,
      useWebSocket: !!this.wsClient,
    });

    const unwatch = client.watchContractEvent({
      ...params,
      onLogs: (logs: Log[]) => {
        logger.trace(`Received ${logs.length} events`, {
          eventName: params.eventName,
          count: logs.length,
        });
        onLogs(logs);
      },
      onError: (error: Error) => {
        logger.error('Event watcher error', error, {
          eventName: params.eventName,
        });
      },
    } as any);

    this.eventUnsubscribers.push(unwatch);
    return unwatch;
  }

  // Get balance
  public async getBalance(address?: `0x${string}`): Promise<bigint> {
    const targetAddress = address || this.account.address;
    return this.publicClient.getBalance({ address: targetAddress });
  }

  // Estimate gas
  public async estimateGas(params: any): Promise<bigint> {
    try {
      return await this.publicClient.estimateGas(params);
    } catch (error) {
      logger.error('Gas estimation failed', error as Error, params);
      throw error;
    }
  }

  // Send transaction with retry logic
  public async sendTransaction(params: any): Promise<Hash> {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let i = 0; i < maxRetries; i++) {
      try {
        logger.info('Sending transaction', {
          attempt: i + 1,
          to: params.to,
          value: params.value?.toString(),
          data: params.data ? `${params.data.slice(0, 10)}...` : undefined,
        });

        const hash = await this.walletClient.sendTransaction(params);

        logger.transaction('sent', {
          hash,
          from: this.account.address,
          to: params.to,
          value: params.value?.toString(),
          status: 'pending',
        });

        return hash;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Transaction send failed (attempt ${i + 1}/${maxRetries})`, {
          error: lastError.message,
        });

        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    throw lastError;
  }

  // Wait for transaction receipt
  public async waitForTransactionReceipt(hash: Hash) {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      logger.transaction('confirmed', {
        hash,
        status: receipt.status === 'success' ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber.toString(),
      });

      return receipt;
    } catch (error) {
      logger.error('Failed to get transaction receipt', error as Error, { hash });
      throw error;
    }
  }

  // Read contract
  public async readContract(params: any): Promise<any> {
    try {
      return await this.publicClient.readContract(params);
    } catch (error) {
      logger.error('Contract read failed', error as Error, {
        address: params.address,
        functionName: params.functionName,
      });
      throw error;
    }
  }

  // Write contract
  public async writeContract(params: any): Promise<Hash> {
    try {
      const { request } = await this.publicClient.simulateContract({
        ...params,
        account: this.account,
      });

      return await this.walletClient.writeContract(request as any);
    } catch (error) {
      logger.error('Contract write failed', error as Error, {
        address: params.address,
        functionName: params.functionName,
      });
      throw error;
    }
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up blockchain service');

    // Unsubscribe from all events
    for (const unsubscribe of this.eventUnsubscribers) {
      try {
        unsubscribe();
      } catch (error) {
        logger.warn('Failed to unsubscribe from event', { error });
      }
    }

    this.eventUnsubscribers = [];
  }
}

// Export singleton getter
export function getBlockchainService(): BlockchainService {
  return BlockchainService.getInstance();
}