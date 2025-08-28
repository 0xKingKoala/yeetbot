import clsx from 'clsx';

interface RulesPanelProps {
  rules?: any;
}

const ruleDisplayNames: Record<string, string> = {
  'BGTEqualsCurrentPrice': '📊 BGT Equals Price',
  'Safety': '⚠️ Safety Rule',
  'Blacklist': '🚫 Blacklist',
  'SelfProtection': '🛡️ Self Protection',
  'StandardSnipe': '🎯 Standard Snipe',
  'MarketPrice': '💹 Market Price',
  'AuctionTimeDecay': '⏰ Time Decay',
  'PredictiveTiming': '🔮 Predictive Timing'
};

export default function RulesPanel({ rules }: RulesPanelProps) {
  if (!rules) {
    return (
      <div className="panel">
        <div className="panel-header text-purple-400">
          <span>🎯</span>
          <span>Rules</span>
          <span className="ml-auto text-xs text-gray-500">No evaluations yet...</span>
        </div>
      </div>
    );
  }

  const sortedRules = rules.rules ? [...rules.rules].sort((a: any, b: any) => {
    if (a.triggered !== b.triggered) return a.triggered ? -1 : 1;
    return b.priority - a.priority;
  }) : [];

  return (
    <div className="panel">
      <div className="panel-header text-purple-400">
        <span>🎯</span>
        <span>Rules</span>
        {rules.decision && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400">Decision:</span>
            <span className={clsx(
              'font-bold text-sm',
              rules.decision.shouldYeet ? 'text-green-400' : 'text-red-400'
            )}>
              {rules.decision.shouldYeet ? '✓ YEET' : '✗ WAIT'}
            </span>
          </span>
        )}
      </div>

      <div className="space-y-2">
        {/* Final Decision Reason - Compact */}
        {rules.decision && (
          <div className="text-xs text-gray-300 px-2">
            {rules.decision.reason}
            {rules.decision.priority > 0 && (
              <span className="text-cyan-400 ml-2">[P{rules.decision.priority}]</span>
            )}
          </div>
        )}

        {/* Individual Rules - More Compact */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1 px-2">
            {sortedRules.map((rule: any, index: number) => {
              const displayName = ruleDisplayNames[rule.name] || rule.name;
              const icon = rule.triggered ? (rule.shouldYeet ? '✓' : '✗') : '○';
              const color = rule.triggered 
                ? (rule.shouldYeet ? 'text-green-400' : 'text-red-400') 
                : 'text-gray-500';
              
              return (
                <div key={index} className="bg-gray-700/20 rounded p-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className={clsx('flex items-center gap-1', color)}>
                    <span className="text-xs">{icon}</span>
                    <span className="font-medium truncate">{displayName}</span>
                  </div>
                  {rule.triggered && rule.priority > 0 && (
                    <span className="text-xs text-gray-500">P{rule.priority}</span>
                  )}
                </div>
                
                {/* Compact Thought Process */}
                {rule.thoughts && (
                  <div className="mt-1">
                    {/* Progress Bar with integrated text */}
                    {rule.thoughts.progress !== undefined && (
                      <div className="relative w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div 
                          className={clsx(
                            'h-full transition-all duration-500',
                            rule.thoughts.progress >= 100 ? 'bg-green-500/30' :
                            rule.thoughts.progress >= 75 ? 'bg-yellow-500/30' :
                            rule.thoughts.progress >= 50 ? 'bg-orange-500/30' :
                            'bg-blue-500/30'
                          )}
                          style={{ width: `${Math.min(100, rule.thoughts.progress)}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-between px-1 text-[10px]">
                          <span className="text-cyan-400 truncate max-w-[45%]">{rule.thoughts.currentValue}</span>
                          <span className="text-gray-400">{Math.round(rule.thoughts.progress)}%</span>
                          <span className="text-yellow-400 truncate max-w-[45%]">{rule.thoughts.targetValue}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Reasoning - single line truncated */}
                    <div className={clsx(
                      'text-[10px] leading-tight truncate mt-0.5',
                      rule.triggered ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      {rule.thoughts.reasoning}
                    </div>
                  </div>
                )}
                
                {/* Fallback for old format */}
                {!rule.thoughts && (
                  <div className={clsx(
                    'text-xs mt-1 pl-6',
                    rule.triggered ? 'text-gray-300' : 'text-gray-500'
                  )}>
                    {rule.reason || 'Waiting...'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Compact Legend */}
        <div className="text-[10px] text-gray-500 px-2 flex justify-between">
          <span>✓ Yeet | ✗ Block | ○ Inactive</span>
          <span>P: <span className="text-red-400">100+</span> <span className="text-yellow-400">50+</span> <span className="text-gray-400">Low</span></span>
        </div>
      </div>
    </div>
  );
}