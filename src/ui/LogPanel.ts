import blessed from 'blessed';

interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
}

export class LogPanel {
  private box: blessed.Widgets.BoxElement;
  private logList: blessed.Widgets.ListElement;
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  constructor(screen: blessed.Widgets.Screen, options: blessed.Widgets.BoxOptions) {
    this.box = blessed.box({
      parent: screen,
      ...options,
      label: ' Activity Logs ',
      tags: true,
      style: {
        fg: 'white',
        border: {
          fg: 'blue'
        },
        label: {
          fg: 'blue',
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

    this.logList = blessed.list({
      parent: this.box,
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      style: {
        selected: {
          bg: 'blue',
          fg: 'white'
        },
        scrollbar: {
          bg: 'blue'
        }
      },
      scrollbar: {
        ch: '█',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
      }
    });

    // Allow scrolling with mouse wheel
    this.logList.on('wheeldown', () => {
      this.logList.scroll(1);
      screen.render();
    });

    this.logList.on('wheelup', () => {
      this.logList.scroll(-1);
      screen.render();
    });
  }

  public addLog(level: string, message: string, timestamp?: Date): void {
    const entry: LogEntry = {
      timestamp: timestamp || new Date(),
      level: level.toUpperCase(),
      message
    };

    this.logs.push(entry);

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.updateDisplay();
  }

  private updateDisplay(): void {
    const formattedLogs = this.logs.map(log => {
      const time = log.timestamp.toTimeString().slice(0, 8);
      const levelColor = this.getLevelColor(log.level);
      const levelTag = `{${levelColor}-fg}[${log.level.padEnd(5)}]{/}`;
      
      // Truncate message if too long
      const maxMessageLength = 50;
      let displayMessage = log.message;
      if (displayMessage.length > maxMessageLength) {
        displayMessage = displayMessage.substring(0, maxMessageLength - 3) + '...';
      }

      // Special formatting for certain messages
      if (log.message.includes('DECISION:')) {
        displayMessage = `{bold}${displayMessage}{/}`;
      } else if (log.message.includes('BLOCKED')) {
        displayMessage = `{red-fg}${displayMessage}{/}`;
      } else if (log.message.includes('successful')) {
        displayMessage = `{green-fg}${displayMessage}{/}`;
      }

      return `{gray-fg}${time}{/} ${levelTag} ${displayMessage}`;
    });

    this.logList.setItems(formattedLogs);

    // Auto-scroll to bottom for new logs
    this.logList.scrollTo(this.logs.length - 1);
  }

  private getLevelColor(level: string): string {
    switch (level) {
      case 'ERROR':
        return 'red';
      case 'WARN':
        return 'yellow';
      case 'INFO':
        return 'green';
      case 'DEBUG':
        return 'blue';
      default:
        return 'white';
    }
  }

  public clear(): void {
    this.logs = [];
    this.updateDisplay();
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }
}