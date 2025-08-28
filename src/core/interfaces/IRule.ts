import { RuleContext, RuleEvaluation } from '../types';

export interface IRule {
  name: string;
  priority: number;
  evaluate(context: RuleContext): RuleEvaluation;
}