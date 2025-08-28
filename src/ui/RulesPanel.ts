import blessed from 'blessed';
import { YeetDecision } from '../core/types';

export interface RuleEvaluation {
  name: string;
  shouldYeet: boolean;
  reason: string;
  priority: number;
  triggered: boolean;
}

export class RulesPanel {
  private box: blessed.Widgets.BoxElement;
  private content: blessed.Widgets.TextElement;
  private lastUpdate: Date = new Date();
  private evaluations: RuleEvaluation[] = [];

  constructor(screen: blessed.Widgets.Screen, options: blessed.Widgets.BoxOptions) {
    this.box = blessed.box({
      parent: screen,
      ...options,
      label: ' 🎯 Rule Decisions ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      style: {
        fg: 'white',
        border: {
          fg: 'cyan'
        },
        label: {
          fg: 'cyan',
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

  public updateRules(evaluations: RuleEvaluation[], finalDecision?: YeetDecision): void {
    this.lastUpdate = new Date();
    this.evaluations = evaluations;
    
    const lines: string[] = [];
    
    // Sort evaluations by priority (highest first), then by triggered status
    const sortedEvals = [...evaluations].sort((a, b) => {
      if (a.triggered !== b.triggered) {
        return a.triggered ? -1 : 1; // Triggered rules first
      }
      return b.priority - a.priority;
    });
    
    // Show final decision first if available
    if (finalDecision) {
      lines.push('{bold}{yellow-fg}═══ FINAL DECISION ═══{/}');
      const decisionColor = finalDecision.shouldYeet ? 'green-fg' : 'red-fg';
      lines.push(`{bold}{${decisionColor}}${finalDecision.shouldYeet ? '✓ YEET' : '✗ WAIT'}{/}`);
      lines.push(`{white-fg}${finalDecision.reason}{/}`);
      if (finalDecision.priority > 0) {
        lines.push(`{cyan-fg}Priority: ${finalDecision.priority}{/}`);
      }
      lines.push('');
    }
    
    // Show individual rule evaluations
    lines.push('{bold}{cyan-fg}═══ RULE STATUS ═══{/}');
    
    // Format rule names for display
    const ruleDisplayNames: Record<string, string> = {
      'BGTEqualsCurrentPrice': '📊 BGT Equals Price',
      'Safety': '⚠️ Safety Rule',
      'Blacklist': '🚫 Blacklist',
      'SelfProtection': '🛡️ Self Protection',
      'StandardSnipe': '🎯 Standard Snipe'
    };
    
    for (const ruleEval of sortedEvals) {
      const displayName = ruleDisplayNames[ruleEval.name] || ruleEval.name;
      const icon = ruleEval.triggered ? (ruleEval.shouldYeet ? '✓' : '✗') : '○';
      const color = ruleEval.triggered ? (ruleEval.shouldYeet ? 'green-fg' : 'red-fg') : 'gray-fg';
      
      // Rule name and status
      let ruleLine = `{${color}}${icon} ${displayName}{/}`;
      
      // Add priority only if triggered and has priority
      if (ruleEval.triggered && ruleEval.priority > 0) {
        const priorityColor = ruleEval.priority >= 100 ? 'red-fg' : ruleEval.priority >= 50 ? 'yellow-fg' : 'white-fg';
        ruleLine += ` {${priorityColor}}[P${ruleEval.priority}]{/}`;
      }
      
      lines.push(ruleLine);
      
      // Always show reason (context-aware for inactive rules too)
      const reasonColor = ruleEval.triggered ? 'white-fg' : 'gray-fg';
      const reason = ruleEval.reason || 'Waiting...';
      
      // Truncate reason if too long
      const maxReasonLength = 45;
      const displayReason = reason.length > maxReasonLength ? 
        reason.substring(0, maxReasonLength - 3) + '...' : reason;
      
      lines.push(`  └─ {${reasonColor}}${displayReason}{/}`);
      lines.push(''); // Add spacing between rules
    }
    
    // Add legend at bottom
    lines.push('');
    lines.push('{gray-fg}─────────────────────{/}');
    lines.push('{gray-fg}Legend: ✓ Yeet | ✗ Block | ○ Inactive{/}');
    lines.push('{gray-fg}Priority: {red-fg}High(100+){/} {yellow-fg}Med(50+){/} {white-fg}Low{/}{/}');
    lines.push(`{gray-fg}Updated: ${this.lastUpdate.toTimeString().slice(0, 8)}{/}`);

    this.content.setContent(lines.join('\n'));
  }

  public clear(): void {
    this.evaluations = [];
    this.content.setContent('{gray-fg}No rule evaluations yet...{/}');
  }
}