import blessed from 'blessed';
import { DashboardCallbacks } from './Dashboard';

interface Action {
  key: string;
  label: string;
  description: string;
  callback: () => void | Promise<void>;
  color?: string;
}

export class ActionsPanel {
  private box: blessed.Widgets.BoxElement;
  private content: blessed.Widgets.TextElement;
  private statusText: blessed.Widgets.TextElement;
  private actions: Action[];
  private lastStatus: string = '';

  constructor(
    screen: blessed.Widgets.Screen, 
    options: blessed.Widgets.BoxOptions,
    callbacks: DashboardCallbacks
  ) {
    this.box = blessed.box({
      parent: screen,
      ...options,
      label: ' Actions ',
      tags: true,
      style: {
        fg: 'white',
        border: {
          fg: 'yellow'
        },
        label: {
          fg: 'yellow',
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

    // Define available actions
    this.actions = [
      {
        key: '1',
        label: 'Force Yeet',
        description: 'Yeet at current price',
        callback: callbacks.onForceYeet,
        color: 'red'
      },
      {
        key: '2',
        label: 'Claim BGT',
        description: 'Claim BGT rewards',
        callback: callbacks.onClaimBGT,
        color: 'green'
      },
      {
        key: '3',
        label: 'Pause Bot',
        description: 'Pause monitoring',
        callback: callbacks.onPause,
        color: 'yellow'
      },
      {
        key: '4',
        label: 'Resume Bot',
        description: 'Resume monitoring',
        callback: callbacks.onResume,
        color: 'green'
      },
      {
        key: 'Q',
        label: 'Quit',
        description: 'Exit dashboard',
        callback: callbacks.onQuit,
        color: 'red'
      }
    ];

    this.content = blessed.text({
      parent: this.box,
      tags: true,
      style: {
        fg: 'white'
      }
    });

    // Status text at bottom of panel
    this.statusText = blessed.text({
      parent: this.box,
      bottom: 0,
      tags: true,
      style: {
        fg: 'cyan'
      }
    });

    this.updateDisplay();
  }

  private updateDisplay(): void {
    const lines: string[] = [];
    
    // Create horizontal display of actions
    const actionButtons: string[] = [];
    for (const action of this.actions) {
      const color = action.color || 'white';
      actionButtons.push(`{bold}{${color}-fg}[${action.key}]{/} ${action.label}`);
    }
    
    lines.push('{center}' + actionButtons.join('    ') + '{/center}');
    lines.push('');
    lines.push('{center}{gray-fg}Press the key shown in brackets to execute action{/}{/center}');
    
    this.content.setContent(lines.join('\n'));

    if (this.lastStatus) {
      this.statusText.setContent(`\n{cyan-fg}Status: ${this.lastStatus}{/}`);
    }
  }

  public updateStatus(action: string, status: string): void {
    this.lastStatus = `${action}: ${status}`;
    this.updateDisplay();
  }

  public clearStatus(): void {
    this.lastStatus = '';
    this.updateDisplay();
  }

  public highlightAction(key: string): void {
    // Flash the action briefly to show it was triggered
    const action = this.actions.find(a => a.key === key);
    if (action) {
      this.updateStatus(action.label, 'Executing...');
      setTimeout(() => {
        this.clearStatus();
      }, 2000);
    }
  }
}