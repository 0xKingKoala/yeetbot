import blessed from 'blessed';
import { GameState } from '../services/StateManager';
import { formatBera, formatPercent, formatAddress } from '../utils/formatters';
import { Config } from '../config/Config';

export class StatePanel {
  private box: blessed.Widgets.BoxElement;
  private content: blessed.Widgets.TextElement;
  private lastUpdate: Date = new Date();
  private config = Config.getInstance().get();

  constructor(screen: blessed.Widgets.Screen, options: blessed.Widgets.BoxOptions) {
    this.box = blessed.box({
      parent: screen,
      ...options,
      label: ' 📊 Current State ',
      tags: true,
      style: {
        fg: 'white',
        border: {
          fg: 'green'
        },
        label: {
          fg: 'green',
          bold: true
        }
      },
      border: {
        type: 'line'
      },
      padding: {
        left: 1,
        right: 1,
        top: 0,
        bottom: 0
      }
    });

    this.content = blessed.text({
      parent: this.box,
      tags: true,
      style: {
        fg: 'white'
      }
    });
  }

  public update(state: GameState): void {
    this.lastUpdate = new Date();
    const lines: string[] = [];

    // Add a nice header
    lines.push('{bold}{yellow-fg}╔════════════════════════════════════════════════════════════════════╗{/}');
    lines.push('{bold}{yellow-fg}║{/} {bold}{cyan-fg}                     🚀 YEET BOT V2 STATUS                      {/} {bold}{yellow-fg}║{/}');
    lines.push('{bold}{yellow-fg}╚════════════════════════════════════════════════════════════════════╝{/}');
    lines.push('');

    // Create sections with better formatting
    const sections: string[] = [];

    // Bot Status Section
    const statusIcon = state.isInCooldown ? '⏸' : '▶';
    const statusColor = state.isInCooldown ? 'yellow-fg' : 'green-fg';
    const dryRunIcon = this.config.safety.dryRun ? '🧪' : '💰';
    
    sections.push('{bold}{cyan-fg}┌─ BOT STATUS ─────────────────────────┐{/}');
    sections.push(`{cyan-fg}│{/} ${statusIcon} Status: {${statusColor}}${state.isInCooldown ? 'COOLDOWN' : 'ACTIVE'}{/}`);
    sections.push(`{cyan-fg}│{/} ${dryRunIcon} Mode: ${this.config.safety.dryRun ? '{yellow-fg}DRY RUN{/}' : '{green-fg}LIVE{/}'}`);
    sections.push('{cyan-fg}└──────────────────────────────────────┘{/}');

    // Auction Info Section
    if (state.auction) {
      const priceIcon = '💎';
      const leaderIcon = state.auction.currentLeader ? '👑' : '❓';
      const phaseIcon = state.auction.isAuctionPhase ? '🔥' : '❄️';
      
      const currentPrice = state.auction.currentPrice;
      // Price drop would require startPrice which isn't available in AuctionState
      // Using placeholder for now
      
      sections.push('');
      sections.push('{bold}{magenta-fg}┌─ AUCTION INFO ───────────────────────┐{/}');
      sections.push(`{magenta-fg}│{/} ${phaseIcon} Phase: ${state.auction.isAuctionPhase ? '{green-fg}AUCTION ACTIVE{/}' : '{gray-fg}WAITING{/}'}`);
      sections.push(`{magenta-fg}│{/} ${priceIcon} Price: {yellow-fg}${formatBera(state.auction.currentPrice)} BERA{/}`);
      
      if (state.auction.currentLeader) {
        const shortAddr = formatAddress(state.auction.currentLeader);
        sections.push(`{magenta-fg}│{/} ${leaderIcon} Leader: {white-fg}${shortAddr}{/}`);
      }
      sections.push('{magenta-fg}└──────────────────────────────────────┘{/}');
    } else {
      sections.push('');
      sections.push('{bold}{magenta-fg}┌─ AUCTION INFO ───────────────────────┐{/}');
      sections.push('{magenta-fg}│{/} {gray-fg}No active auction data{/}');
      sections.push('{magenta-fg}└──────────────────────────────────────┘{/}');
    }

    // BGT & Profit Section
    const bgtIcon = '🍯';
    const profitIcon = state.auction?.currentLeader ? '📊' : '📈';
    
    sections.push('');
    sections.push('{bold}{green-fg}┌─ BGT & PROFIT ───────────────────────┐{/}');
    sections.push(`{green-fg}│{/} ${bgtIcon} Rate: {yellow-fg}${formatBera(state.bgtPerSecond)}/s{/}`);
    
    if (state.auction?.currentLeader) {
      const timeSinceLeader = Math.floor((Date.now() - state.auction.leaderTimestamp.getTime()) / 1000);
      const accumulatedBGT = state.bgtPerSecond * BigInt(timeSinceLeader);
      sections.push(`{green-fg}│{/} ⏱ Time as leader: {cyan-fg}${timeSinceLeader}s{/}`);
      sections.push(`{green-fg}│{/} 💰 BGT Accumulated: {green-fg}${formatBera(accumulatedBGT)}{/}`);
      
      if (state.auction.currentPrice > 0n) {
        const profit = accumulatedBGT - state.auction.currentPrice;
        const profitPercent = Number((profit * 100n) / state.auction.currentPrice);
        const profitColor = profit > 0n ? 'green-fg' : 'red-fg';
        const profitSymbol = profit > 0n ? '↑' : '↓';
        const profitSign = profit > 0n ? '+' : '';
        sections.push(`{green-fg}│{/} ${profitIcon} P&L: {${profitColor}}${profitSign}${formatBera(profit)} ${profitSymbol}{/}`);
        sections.push(`{green-fg}│{/} 📈 ROI: {${profitColor}}${profitSign}${formatPercent(profitPercent)}%{/}`);
      }
    } else {
      sections.push('{green-fg}│{/} {gray-fg}Waiting for leader data...{/}');
    }
    sections.push('{green-fg}└──────────────────────────────────────┘{/}');


    // Combine all sections
    lines.push(...sections);
    
    // Footer
    lines.push('');
    lines.push('{gray-fg}───────────────────────────────────────{/}');
    lines.push(`{gray-fg}Last Update: ${this.lastUpdate.toTimeString().slice(0, 8)}{/}`);

    this.content.setContent(lines.join('\n'));
  }
}