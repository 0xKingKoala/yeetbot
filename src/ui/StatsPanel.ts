import blessed from 'blessed';
import { formatBera, formatPercent } from '../utils/formatters';

export interface SessionStats {
  totalYeets: number;
  successfulYeets: number;
  failedYeets: number;
  totalSpent: bigint;
  totalBgtEarned: bigint;
  sessionStartTime: Date;
  lastYeetTime?: Date;
  avgGasUsed?: bigint;
  highestProfit?: bigint;
  lowestProfit?: bigint;
}

export class StatsPanel {
  private box: blessed.Widgets.BoxElement;
  private content: blessed.Widgets.TextElement;
  private lastUpdate: Date = new Date();
  private stats: SessionStats | null = null;

  constructor(screen: blessed.Widgets.Screen, options: blessed.Widgets.BoxOptions) {
    this.box = blessed.box({
      parent: screen,
      ...options,
      label: ' 📈 Session Stats ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      style: {
        fg: 'white',
        border: {
          fg: 'magenta'
        },
        label: {
          fg: 'magenta',
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

  public update(stats: SessionStats): void {
    this.lastUpdate = new Date();
    this.stats = stats;
    
    const lines: string[] = [];
    
    // Yeet statistics
    lines.push('{bold}{yellow-fg}Yeet Activity{/}');
    lines.push(`Total: {white-fg}${stats.totalYeets}{/}`);
    lines.push(`Success: {green-fg}${stats.successfulYeets}{/}`);
    lines.push(`Failed: {red-fg}${stats.failedYeets}{/}`);
    
    if (stats.totalYeets > 0) {
      const successRate = stats.successfulYeets / stats.totalYeets * 100;
      lines.push(`Rate: {cyan-fg}${formatPercent(successRate)}%{/}`);
    }
    
    lines.push('');
    
    // Financial statistics
    lines.push('{bold}{yellow-fg}Financials{/}');
    lines.push(`Spent: {yellow-fg}${formatBera(stats.totalSpent)}{/}`);
    lines.push(`BGT: {green-fg}${formatBera(stats.totalBgtEarned)}{/}`);
    
    if (stats.totalSpent > 0n) {
      const profit = stats.totalBgtEarned - stats.totalSpent;
      const roi = Number((profit * 100n) / stats.totalSpent);
      const profitColor = profit > 0n ? 'green-fg' : 'red-fg';
      const profitSign = profit > 0n ? '+' : '';
      
      lines.push(`P&L: {${profitColor}}${profitSign}${formatBera(profit)}{/}`);
      lines.push(`ROI: {${profitColor}}${profitSign}${formatPercent(roi)}%{/}`);
    }
    
    lines.push('');
    
    // Session info
    lines.push('{bold}{yellow-fg}Session{/}');
    const sessionDuration = Date.now() - stats.sessionStartTime.getTime();
    const hours = Math.floor(sessionDuration / 3600000);
    const minutes = Math.floor((sessionDuration % 3600000) / 60000);
    lines.push(`Time: {white-fg}${hours}h ${minutes}m{/}`);
    
    if (stats.lastYeetTime) {
      const timeSinceLastYeet = Date.now() - stats.lastYeetTime.getTime();
      const mins = Math.floor(timeSinceLastYeet / 60000);
      lines.push(`Last: {gray-fg}${mins}m ago{/}`);
    }
    
    // Footer
    lines.push('');
    lines.push('{gray-fg}─────────────{/}');
    lines.push(`{gray-fg}${this.lastUpdate.toTimeString().slice(0, 8)}{/}`);

    this.content.setContent(lines.join('\n'));
  }

  public clear(): void {
    this.stats = null;
    this.content.setContent('{gray-fg}No statistics yet...{/}');
  }
}