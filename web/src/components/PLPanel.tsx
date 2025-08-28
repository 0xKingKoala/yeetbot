import { useEffect, useRef } from 'react';
import clsx from 'clsx';

interface PLPanelProps {
  plData: any[];
}

export default function PLPanel({ plData }: PLPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new entries arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [plData]);

  // Calculate aggregate stats
  const stats = plData.reduce((acc, entry) => {
    const profit = (entry.bgtEarned || 0) - (entry.amount || 0);
    if (profit > 0) {
      acc.winners++;
      acc.totalProfit += profit;
    } else if (profit < 0) {
      acc.losers++;
      acc.totalLoss += Math.abs(profit);
    }
    acc.totalVolume += entry.amount || 0;
    acc.totalBgtEarned += entry.bgtEarned || 0;
    acc.totalBeraSpent += entry.amount || 0;
    return acc;
  }, { winners: 0, losers: 0, totalProfit: 0, totalLoss: 0, totalVolume: 0, totalBgtEarned: 0, totalBeraSpent: 0 });

  const winRate = plData.length > 0 ? (stats.winners / plData.length * 100).toFixed(1) : '0';
  const netPL = stats.totalBgtEarned - stats.totalBeraSpent;

  return (
    <div className="flex flex-col h-full">
      {/* Stats Summary */}
      {plData.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-2 mb-2 border border-gray-700">
          {/* Main P&L Stats */}
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-700">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-gray-500">BERA Spent</div>
                <div className="text-yellow-400 font-mono font-bold text-xs">
                  {stats.totalBeraSpent.toFixed(4)}
                </div>
              </div>
              <div className="text-gray-600 text-sm">→</div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-gray-500">BGT Earned</div>
                <div className="text-cyan-400 font-mono font-bold text-xs">
                  {stats.totalBgtEarned.toFixed(4)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-gray-500">Net P&L</div>
              <div className={clsx(
                'font-mono font-bold text-sm',
                netPL >= 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {netPL >= 0 ? '+' : ''}{netPL.toFixed(4)}
              </div>
            </div>
          </div>

          {/* Win/Loss Stats Grid */}
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className={clsx(
                'text-lg font-bold',
                parseFloat(winRate) >= 50 ? 'text-green-400' : 'text-red-400'
              )}>
                {winRate}%
              </div>
              <div className="text-[9px] uppercase text-gray-500">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-400">
                {stats.winners}
              </div>
              <div className="text-[9px] uppercase text-gray-500">Won</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-400">
                {stats.losers}
              </div>
              <div className="text-[9px] uppercase text-gray-500">Lost</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-400">
                {plData.length}
              </div>
              <div className="text-[9px] uppercase text-gray-500">Total</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1 text-xs font-mono bg-gray-900/50 rounded p-2 min-h-[200px]">
        {plData.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No P&L data available yet...</div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="flex gap-2 text-gray-500 text-xs border-b border-gray-700 pb-1">
              <span className="w-16">Time</span>
              <span className="flex-1">Address</span>
              <span className="w-20 text-right">Paid</span>
              <span className="w-20 text-right">BGT</span>
              <span className="w-20 text-right">P&L</span>
              <span className="w-16 text-right">ROI</span>
            </div>
            
            {/* P&L entries */}
            {plData.map((entry, index) => {
              const time = new Date(entry.timestamp).toTimeString().slice(0, 5);
              const profit = entry.bgtEarned - entry.amount;
              const roi = entry.amount > 0 ? (profit / entry.amount * 100) : 0;
              const isProfitable = profit > 0;
              
              return (
                <div 
                  key={index} 
                  className={clsx(
                    "flex gap-2 py-0.5 px-1 rounded",
                    entry.isActive && 'bg-blue-900/20 animate-pulse',
                    'hover:bg-gray-800/50'
                  )}
                >
                  <span className="w-16 text-gray-500">{time}</span>
                  <span className="flex-1 font-mono text-xs">
                    {entry.isOurs && '👑 '}
                    {entry.address 
                      ? `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`
                      : 'Unknown'}
                  </span>
                  <span className="w-20 text-right text-yellow-400">
                    {entry.amount?.toFixed(4) || '0'}
                  </span>
                  <span className="w-20 text-right text-cyan-400">
                    {entry.bgtEarned?.toFixed(4) || '0'}
                  </span>
                  <span className={clsx(
                    'w-20 text-right font-semibold',
                    isProfitable ? 'text-green-400' : 'text-red-400'
                  )}>
                    {isProfitable ? '+' : ''}{profit.toFixed(4)}
                  </span>
                  <span className={clsx(
                    'w-16 text-right',
                    isProfitable ? 'text-green-400' : 'text-red-400'
                  )}>
                    {roi > 0 ? '+' : ''}{roi.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}