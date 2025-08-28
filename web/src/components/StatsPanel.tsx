interface StatsPanelProps {
  stats?: any;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) {
    return (
      <div className="panel">
        <div className="panel-header text-green-400">
          <span>📈</span>
          <span>Stats</span>
        </div>
        <div className="text-gray-500 text-xs">No statistics yet...</div>
      </div>
    );
  }

  const successRate = stats.totalYeets > 0 
    ? ((stats.successfulYeets / stats.totalYeets) * 100).toFixed(1)
    : '0';

  const roi = parseFloat(stats.totalSpent) > 0
    ? (((parseFloat(stats.totalBgtEarned) - parseFloat(stats.totalSpent)) / parseFloat(stats.totalSpent)) * 100).toFixed(1)
    : '0';

  const sessionDuration = () => {
    const duration = Date.now() - new Date(stats.sessionStartTime).getTime();
    const hours = Math.floor(duration / 3600000);
    const minutes = Math.floor((duration % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const pl = parseFloat(stats.totalBgtEarned) - parseFloat(stats.totalSpent);

  return (
    <div className="panel">
      <div className="panel-header text-green-400">
        <span>📈</span>
        <span>Stats</span>
        <span className="ml-auto text-xs text-gray-400">{sessionDuration()}</span>
      </div>

      <div className="space-y-2 text-xs">
        {/* Compact Yeet Activity */}
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <div className="text-gray-500">Total Yeets:</div>
          <div className="text-white">{stats.totalYeets}</div>
          
          <div className="text-gray-500">Success Rate:</div>
          <div className="text-cyan-400">{successRate}%</div>
          
          <div className="text-gray-500">Successful:</div>
          <div className="text-green-400">{stats.successfulYeets}</div>
          
          <div className="text-gray-500">Failed:</div>
          <div className="text-red-400">{stats.failedYeets}</div>
        </div>

        {/* Compact Financials */}
        <div className="border-t border-gray-700 pt-2">
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div className="text-gray-500">Spent:</div>
            <div className="text-yellow-400">{parseFloat(stats.totalSpent).toFixed(2)} BERA</div>
            
            <div className="text-gray-500">BGT Earned:</div>
            <div className="text-green-400">{parseFloat(stats.totalBgtEarned).toFixed(2)}</div>
            
            <div className="text-gray-500">P&L:</div>
            <div className={pl > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
              {pl > 0 ? '+' : ''}{pl.toFixed(2)}
            </div>
            
            <div className="text-gray-500">ROI:</div>
            <div className={parseFloat(roi) > 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
              {parseFloat(roi) > 0 ? '+' : ''}{roi}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}