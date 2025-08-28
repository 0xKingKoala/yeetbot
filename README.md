# Yeet Bot V2

A modular, rule-based bot for the Yeet game on Berachain with comprehensive logging, monitoring, and testing infrastructure.

## Features

- **Rule-Based Decision Engine**: Modular rules system for flexible strategies
- **Comprehensive Logging**: Structured logging with file rotation and multiple transports
- **Event-Driven Architecture**: Reacts to blockchain events in real-time
- **Safety Features**: Circuit breakers, retry logic, and extensive validation
- **Dry Run Mode**: Test strategies without spending real funds
- **Extensive Configuration**: Environment-based configuration with validation
- **Test Coverage**: Unit and integration tests for all components
- **Automatic BGT Claiming**: Claims and redeems BGT rewards periodically

## Quick Start

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run in dry mode** (recommended for testing):
   ```bash
   bun run start:dry
   ```

4. **Run in production**:
   ```bash
   DRY_RUN=false bun run start
   ```

5. **Manually claim BGT** (optional - bot does this automatically):
   ```bash
   bun run claim
   ```

## Configuration

The bot uses environment variables for configuration. See `.env.example` for all available options.

### Key Configuration Options

- `PRIVATE_KEY`: Your wallet private key
- `YEET_GAME_CONTRACT`: Yeet game contract address
- `YEET_SETTINGS_CONTRACT`: Yeet settings contract address
- `MAX_YEET_AMOUNT`: Maximum BERA to spend per yeet
- `DRY_RUN`: Enable/disable dry run mode
- `BGT_CLAIMING_ENABLED`: Enable automatic BGT claiming
- `BGT_CLAIMING_INTERVAL`: Minutes between BGT claims (default: 30)

### Rule Configuration

- `OTHERS_PROFIT_THRESHOLD`: Max profit % before sniping other players
- `SELF_PROFIT_THRESHOLD`: Target profit % for our own positions
- `BLACKLIST_PROFIT_THRESHOLD`: Profit threshold for blacklisted addresses
- `SNIPE_BUFFER_SECONDS`: Time buffer before profit thresholds
- `BLACKLISTED_ADDRESSES`: Comma-separated list of addresses to snipe aggressively

## Architecture

### Core Components

1. **BotRunner**: Main orchestration class
2. **DecisionEngine**: Evaluates rules and makes yeet decisions
3. **BlockchainService**: Handles all blockchain interactions
4. **EventManager**: Monitors and processes blockchain events
5. **StateManager**: Tracks game and auction state
6. **Logger**: Comprehensive logging system
7. **BGTClaimService**: Automatically claims and redeems BGT rewards

### Rules System

The bot uses a priority-based rule system:

1. **BGTEqualsCurrentPriceRule** (Priority: 90): Yeets when BGT rewards equal price
2. **BlacklistRule** (Priority: 80): Aggressive sniping of blacklisted addresses
3. **SafetyRule** (Priority: 70): Prevents yeets when safety thresholds are exceeded
4. **SelfProtectionRule** (Priority: 60): Protects our own profitable positions
5. **StandardSnipeRule** (Priority: 50): Standard sniping of other players

## Development

### Running Tests

```bash
# Run all tests
bun test

# Watch mode
bun run test:watch

# Coverage report
bun run test:coverage
```

### Type Checking

```bash
bun run type-check
```

### Linting

```bash
# Check for issues
bun run lint

# Auto-fix issues
bun run lint:fix
```

### Development Mode

```bash
# Run with auto-reload
bun run dev
```

## Monitoring

The bot provides comprehensive monitoring through:

- **Console Logs**: Real-time activity with timestamps
- **File Logs**: Rotating log files in `./logs` directory
- **Metrics**: Performance metrics and statistics
- **Health Checks**: Blockchain connection and service health
- **Notifications**: Discord/SQS alerts for important events

## Safety Features

- **Dry Run Mode**: Test without real transactions
- **Balance Checks**: Ensures minimum wallet balance
- **Max Spend Limits**: Daily and per-transaction limits
- **Circuit Breakers**: Automatic shutdown on repeated errors
- **Input Validation**: Comprehensive validation of all inputs

## Usage Example

```typescript
import { 
  createDecisionEngine, 
  createDefaultConfig,
  ProfitCalculator,
  RuleContext 
} from './src';

// Create components
const config = createDefaultConfig();
config.ourWallets.add('0xYourWallet'.toLowerCase());

const engine = createDecisionEngine();
const calculator = new ProfitCalculator();

// Create context from blockchain data
const bgtRewards = calculator.calculateBGTRewards(
  bgtPerSecond,
  leaderTimestamp,
  currentTimestamp
);

const profit = calculator.calculateProfitMetrics(currentPrice, bgtRewards);

const context: RuleContext = {
  auction: { /* auction state */ },
  bgtRewards,
  profit,
  wallet: { /* wallet info */ },
  config
};

// Get decision
const decision = engine.evaluate(context);
if (decision.shouldYeet) {
  // Execute yeet with decision.suggestedGasMultiplier
}
```

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check RPC URL and network connectivity
2. **Insufficient Balance**: Ensure wallet has enough BERA
3. **Transaction Failures**: Check gas settings and network congestion
4. **Missing Events**: Verify WebSocket URL if using event subscriptions

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug bun run start
```

## Production Deployment

1. Use environment-specific config files:
   ```bash
   cp .env.example .env.production
   ```

2. Run with PM2 for process management:
   ```bash
   pm2 start ecosystem.config.js
   ```

3. Monitor logs:
   ```bash
   tail -f logs/combined-*.log
   ```

## Security

- Never commit private keys or sensitive data
- Use environment variables for all secrets
- Enable circuit breakers in production
- Monitor for unusual activity
- Keep dependencies updated

## Disclaimer

**⚠️ IMPORTANT: READ BEFORE USE**

This software automates participation in the Yeet V2 game on Berachain and carries substantial financial risk. Please read [DISCLAIMER.md](./DISCLAIMER.md) for important risk warnings and liability limitations.

**USE AT YOUR OWN RISK** - You can lose all funds used in the game.

## License

MIT