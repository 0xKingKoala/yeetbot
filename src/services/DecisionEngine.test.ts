import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionEngine } from './DecisionEngine';
import { IRule } from '../core/interfaces/IRule';
import { RuleContext, YeetDecision } from '../core/types';

class MockRule implements IRule {
  constructor(
    public name: string,
    public priority: number,
    private decision: YeetDecision | null
  ) {}

  evaluate(context: RuleContext): YeetDecision | null {
    return this.decision;
  }
}

describe('DecisionEngine', () => {
  let engine: DecisionEngine;
  let mockContext: RuleContext;

  beforeEach(() => {
    engine = new DecisionEngine();
    mockContext = {} as RuleContext; // Details not important for engine tests
  });

  it('should add and remove rules', () => {
    const rule = new MockRule('TestRule', 50, null);
    
    engine.addRule(rule);
    expect(engine.getRules()).toHaveLength(1);
    expect(engine.getRules()[0].name).toBe('TestRule');
    
    engine.removeRule('TestRule');
    expect(engine.getRules()).toHaveLength(0);
  });

  it('should return default decision when no rules trigger', () => {
    const rule1 = new MockRule('Rule1', 50, null);
    const rule2 = new MockRule('Rule2', 60, null);
    
    engine.addRule(rule1);
    engine.addRule(rule2);
    
    const decision = engine.evaluate(mockContext);
    
    expect(decision.shouldYeet).toBe(false);
    expect(decision.reason).toBe('No rules triggered');
    expect(decision.priority).toBe(0);
  });

  it('should return highest priority decision when multiple rules trigger', () => {
    const lowPriorityDecision: YeetDecision = {
      shouldYeet: true,
      reason: 'Low priority reason',
      priority: 50
    };
    
    const highPriorityDecision: YeetDecision = {
      shouldYeet: true,
      reason: 'High priority reason',
      priority: 80
    };
    
    engine.addRule(new MockRule('LowRule', 50, lowPriorityDecision));
    engine.addRule(new MockRule('HighRule', 80, highPriorityDecision));
    
    const decision = engine.evaluate(mockContext);
    
    expect(decision).toBe(highPriorityDecision);
  });

  it('should prioritize blocking decisions regardless of priority', () => {
    const blockingDecision: YeetDecision = {
      shouldYeet: false,
      reason: 'Safety block',
      priority: 50
    };
    
    const allowDecision: YeetDecision = {
      shouldYeet: true,
      reason: 'Should yeet',
      priority: 100
    };
    
    engine.addRule(new MockRule('BlockRule', 50, blockingDecision));
    engine.addRule(new MockRule('AllowRule', 100, allowDecision));
    
    const decision = engine.evaluate(mockContext);
    
    expect(decision).toBe(blockingDecision);
    expect(decision.shouldYeet).toBe(false);
  });

  it('should handle multiple blocking rules', () => {
    const block1: YeetDecision = {
      shouldYeet: false,
      reason: 'Block 1',
      priority: 90
    };
    
    const block2: YeetDecision = {
      shouldYeet: false,
      reason: 'Block 2',
      priority: 50
    };
    
    engine.addRule(new MockRule('Block1', 90, block1));
    engine.addRule(new MockRule('Block2', 50, block2));
    
    const decision = engine.evaluate(mockContext);
    
    // Should return the first blocking decision found (order may vary)
    expect(decision.shouldYeet).toBe(false);
    expect(['Block 1', 'Block 2']).toContain(decision.reason);
  });
});