import blessed from 'blessed';
import { StatePanel } from './StatePanel';
import { LogPanel } from './LogPanel';
import { ActionsPanel } from './ActionsPanel';
import { RulesPanel, RuleEvaluation } from './RulesPanel';
import { StatsPanel, SessionStats } from './StatsPanel';
import { GameState } from '../services/StateManager';
import { YeetDecision } from '../core/types';

export interface DashboardCallbacks {
  onForceYeet: () => Promise<void>;
  onClaimBGT: () => Promise<void>;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
}

export class Dashboard {
  private screen: blessed.Widgets.Screen;
  private statePanel: StatePanel;
  private logPanel: LogPanel;
  private actionsPanel: ActionsPanel;
  private rulesPanel: RulesPanel;
  private statsPanel: StatsPanel;
  private callbacks: DashboardCallbacks;
  private isRunning = false;

  constructor(callbacks: DashboardCallbacks) {
    this.callbacks = callbacks;
    
    // Create the main screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Yeet Bot V2 Dashboard',
      dockBorders: true,
      fullUnicode: true,
      autoPadding: true,
    });

    // Create header
    const header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 2,
      content: '{center}🚀 YEET BOT V2 DASHBOARD 🚀{/center}',
      tags: true,
      style: {
        fg: 'cyan',
        bold: true,
        border: {
          fg: 'cyan'
        }
      },
      border: {
        type: 'line'
      }
    });

    // Create log panel at top (below header)
    this.logPanel = new LogPanel(this.screen, {
      top: 2,
      left: 0,
      width: '100%',
      height: '30%',
    });

    // Create state panel at middle left
    this.statePanel = new StatePanel(this.screen, {
      top: '32%',
      left: 0,
      width: '50%',
      height: '40%',
    });

    // Create rules panel at middle right
    this.rulesPanel = new RulesPanel(this.screen, {
      top: '32%',
      left: '50%',
      width: '50%',
      height: '40%',
    });

    // Create stats panel at bottom left
    this.statsPanel = new StatsPanel(this.screen, {
      top: '72%',
      left: 0,
      width: '50%',
      height: '26%',
    });

    // Create actions panel at bottom right - much smaller
    this.actionsPanel = new ActionsPanel(this.screen, {
      top: '72%',
      left: '50%',
      width: '50%',
      height: '26%',
    }, this.callbacks);

    // Create footer with help text
    const footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 2,
      content: '{center}Tab: Switch panels | ↑↓: Scroll | Q: Quit{/center}',
      tags: true,
      style: {
        fg: 'gray',
        border: {
          fg: 'gray'
        }
      },
      border: {
        type: 'line'
      }
    });

    // Set up keyboard handlers
    this.setupKeyboardHandlers();

    // Handle screen resize
    this.screen.on('resize', () => {
      this.render();
    });
  }

  private setupKeyboardHandlers(): void {
    // Quit on Q or Ctrl+C
    this.screen.key(['q', 'C-c'], () => {
      this.callbacks.onQuit();
    });

    // Number keys for actions
    this.screen.key(['1'], () => {
      this.callbacks.onForceYeet();
    });

    this.screen.key(['2'], () => {
      this.callbacks.onClaimBGT();
    });

    this.screen.key(['3'], () => {
      this.callbacks.onPause();
    });

    this.screen.key(['4'], () => {
      this.callbacks.onResume();
    });

    // Tab to switch focus between panels
    this.screen.key(['tab'], () => {
      this.screen.focusNext();
    });

    // Escape to return focus to main screen
    this.screen.key(['escape'], () => {
      this.screen.focusPop();
    });
  }

  public start(): void {
    this.isRunning = true;
    this.render();
  }

  public stop(): void {
    this.isRunning = false;
    this.screen.destroy();
  }

  public render(): void {
    if (!this.isRunning) return;
    this.screen.render();
  }

  public updateState(state: GameState): void {
    this.statePanel.update(state);
    if (state.stats) {
      this.statsPanel.update(state.stats);
    }
    this.render();
  }

  public addLog(level: string, message: string, timestamp?: Date): void {
    this.logPanel.addLog(level, message, timestamp);
    this.render();
  }

  public updateActionStatus(action: string, status: string): void {
    this.actionsPanel.updateStatus(action, status);
    this.render();
  }

  public updateRules(evaluations: RuleEvaluation[], finalDecision?: YeetDecision): void {
    this.rulesPanel.updateRules(evaluations, finalDecision);
    this.render();
  }

  public clearRules(): void {
    this.rulesPanel.clear();
    this.render();
  }

  public showNotification(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
    const colors = {
      info: 'blue',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };

    const notification = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 'shrink',
      padding: 1,
      style: {
        fg: 'white',
        bg: colors[type],
        border: {
          fg: colors[type]
        }
      },
      border: {
        type: 'line'
      },
      tags: true,
    });

    notification.display(message, 3, () => {
      this.render();
    });
  }
}