# Yeet Bot V2

An automated bot for the Yeet V2 game on Berachain with real-time price calculation, web dashboard, and intelligent decision-making.

## Features

- **Real-Time Price Calculation**: Calculates auction prices locally for zero-latency decisions
- **Web Dashboard**: React-based UI for monitoring and control
- **Terminal Dashboard**: Real-time CLI interface for monitoring bot activity
- **Rule-Based Decision Engine**: Modular rules system for flexible strategies
- **Event-Driven Architecture**: Reacts to blockchain events in real-time
- **Safety Features**: Dry run mode, max spend limits, and safety rules
- **Automatic BGT Claiming**: Claims and redeems BGT rewards periodically
- **Force Yeet**: Manual control via dashboard or API
- **P&L Tracking**: Comprehensive profit/loss tracking and statistics

## Quick Start

1. **Install dependencies**:
   ```bash
   bun install
   cd web && bun install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run the bot with terminal dashboard**:
   ```bash
   bun run start:dashboard
   ```

4. **Run the bot with web dashboard**:
   ```bash
   bun run start:web
   # Open browser to http://localhost:3000
   ```

5. **Run web UI separately** (for development):
   ```bash
   cd web && bun run dev
   # Open browser to http://localhost:5173
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
3. **PriceCalculator**: Real-time price calculation using linear decay
4. **BlockchainService**: Handles all blockchain interactions
5. **EventManager**: Monitors and processes blockchain events
6. **StateManager**: Tracks game and auction state with real-time prices
7. **BGTClaimService**: Automatically claims and redeems BGT rewards
8. **Dashboard Server**: WebSocket server for real-time UI updates

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
```

### Available Scripts

```bash
# Start with terminal dashboard
bun run start:dashboard

# Start with web dashboard  
bun run start:web

# Start bot only (no UI)
bun run start

# Claim BGT manually
bun run claim

# Run all components
bun run start:all
```

## Monitoring

The bot provides comprehensive monitoring through:

- **Web Dashboard**: Full-featured React UI at http://localhost:3000
- **Terminal Dashboard**: Real-time CLI interface with colored output
- **Console Logs**: Structured logging with timestamps
- **WebSocket Updates**: Real-time state updates to connected clients
- **P&L Tracking**: Win/loss statistics and profitability metrics

## Safety Features

- **Dry Run Mode**: Test without real transactions
- **Balance Checks**: Ensures minimum wallet balance
- **Max Spend Limits**: Daily and per-transaction limits
- **Circuit Breakers**: Automatic shutdown on repeated errors
- **Input Validation**: Comprehensive validation of all inputs

## Web Dashboard Features

- **Real-time State Display**: Current price, leader, auction progress
- **Rules Panel**: Live rule evaluations and decisions
- **P&L Tab**: Profit/loss tracking with win rate and statistics
- **History Tab**: Round-by-round auction history
- **Activity Log**: Real-time bot activity feed
- **Action Buttons**: Force yeet, pause/resume, claim BGT
- **Stats Panel**: Session statistics and performance metrics

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

1. Configure production environment:
   ```bash
   cp .env.example .env
   # Set DRY_RUN=false for production
   ```

2. Build web UI:
   ```bash
   cd web && bun run build
   ```

3. Run in production:
   ```bash
   NODE_ENV=production bun run start:web
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