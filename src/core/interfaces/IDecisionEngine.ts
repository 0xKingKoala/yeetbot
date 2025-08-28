import { RuleContext, YeetDecision } from '../types';
import { IRule } from './IRule';

export interface IDecisionEngine {
  addRule(rule: IRule): void;
  removeRule(ruleName: string): void;
  evaluate(context: RuleContext): YeetDecision;
}