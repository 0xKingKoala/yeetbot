import { useState, useEffect } from 'react';

interface StatePanelProps {
  state?: any;
}

export default function StatePanel({ state }: StatePanelProps) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update timer every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!state) {
    return (
      <div className="panel">
        <div className="panel-header text-cyan-400">
          <span>📊</span>
          <span>State</span>
        </div>
        <div className="text-gray-500 text-xs">Loading...</div>
      </div>
    );
  }

  const calculateTimeInAuction = () => {
    if (!state.auction?.isAuctionPhase || !state.auction?.auctionStartTime) return { display: '0s', elapsed: 0 };
    const elapsed = Math.floor((currentTime - new Date(state.auction.auctionStartTime).getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const display = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    return { display, elapsed };
  };

  const calculateCooldownRemaining = () => {
    if (!state.cooldownEndTime) return null;
    const remaining = Math.max(0, Math.floor((new Date(state.cooldownEndTime).getTime() - currentTime) / 1000));
    if (remaining === 0) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return `${minutes}m ${seconds}s`;
  };

  const calculateBGTAccumulated = () => {
    if (!state.auction?.currentLeader || !state.bgtPerSecond) return '0';
    const timeSinceLeader = Math.floor((currentTime - new Date(state.auction.leaderTimestamp).getTime()) / 1000);
    const accumulated = parseFloat(state.bgtPerSecond) * timeSinceLeader;
    return accumulated.toFixed(4);
  };

  const calculateTimeAsLeader = () => {
    if (!state.auction?.currentLeader || !state.auction?.leaderTimestamp) return '0s';
    const elapsed = Math.floor((currentTime - new Date(state.auction.leaderTimestamp).getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const calculatePL = () => {
    if (!state.auction?.currentLeader) return null;
    const accumulated = parseFloat(calculateBGTAccumulated());
    const price = parseFloat(state.auction.currentPrice);
    const profit = accumulated - price;
    const profitPercent = price > 0 ? (profit / price) * 100 : 0;
    return { profit: profit.toFixed(2), percent: profitPercent.toFixed(1) };
  };

  const pl = calculatePL();
  const cooldownRemaining = calculateCooldownRemaining();
  const auctionTime = calculateTimeInAuction();
  const auctionProgress = Math.min(100, (auctionTime.elapsed / 30) * 100); // Assuming 30s auction

  return (
    <div className="panel">
      <div className="panel-header text-cyan-400">
        <span>📊</span>
        <span>State</span>
        <span className="ml-auto text-xs">
          {state.isInCooldown ? 
            <span className="text-yellow-400">⏸ COOLDOWN</span> : 
            <span className="text-green-400">▶ ACTIVE</span>
          }
        </span>
      </div>
      
      <div className="space-y-2 text-xs">
        {/* Timers Section */}
        <div className="bg-gray-800/30 rounded p-1.5 space-y-1">
          {cooldownRemaining && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">⏱ Cooldown:</span>
              <span className="text-yellow-400 font-mono animate-pulse">{cooldownRemaining}</span>
            </div>
          )}
          {state.auction?.isAuctionPhase && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">⏰ In Auction:</span>
                <span className="text-cyan-400 font-mono">{auctionTime.display}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-1000"
                  style={{ width: `${auctionProgress}%` }}
                />
              </div>
            </>
          )}
          {state.auction?.currentLeader && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">👑 Leader Time:</span>
              <span className="text-green-400 font-mono">{calculateTimeAsLeader()}</span>
            </div>
          )}
        </div>

        {/* Compact Auction Info */}
        {state.auction && (
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div className="text-gray-500">Phase:</div>
            <div className={state.auction.isAuctionPhase ? 'text-green-400' : 'text-gray-400'}>
              {state.auction.isAuctionPhase ? '🔥 AUCTION' : '❄️ WAITING'}
            </div>
            
            <div className="text-gray-500">Price:</div>
            <div className="text-yellow-400">{parseFloat(state.auction.currentPrice).toFixed(4)}</div>
            
            {state.auction.isAuctionPhase && (
              <>
                <div className="text-gray-500">Auction Time:</div>
                <div className="text-purple-400">{auctionTime.display} ({Math.round(auctionProgress)}%)</div>
              </>
            )}
            
            {state.auction.lastPaidPrice && (
              <>
                <div className="text-gray-500">Last Paid:</div>
                <div className="text-cyan-400">{parseFloat(state.auction.lastPaidPrice).toFixed(4)}</div>
              </>
            )}
            
            {state.auction.currentLeader && state.auction.currentLeader !== '0x0000000000000000000000000000000000000000' && (
              <>
                <div className="text-gray-500">Leader:</div>
                <div className="text-white font-mono flex items-center gap-1">
                  <span className="text-yellow-400">👑</span>
                  <span className="text-xs">{state.auction.currentLeader.slice(0, 6)}...{state.auction.currentLeader.slice(-4)}</span>
                </div>
                
                <div className="text-gray-500">Leader Paid:</div>
                <div className="text-cyan-400">
                  {state.auction.leaderAmount ? parseFloat(state.auction.leaderAmount).toFixed(4) : 'N/A'}
                </div>
              </>
            )}
            
            {state.auction.auctionMaxFactor && (
              <>
                <div className="text-gray-500">Max Factor:</div>
                <div className={state.auction.auctionMaxFactor > 1.3 ? 'text-red-400' : 'text-green-400'}>
                  {state.auction.auctionMaxFactor.toFixed(2)}x
                </div>
              </>
            )}
          </div>
        )}

        {/* Compact BGT & Profit */}
        <div className="border-t border-gray-700 pt-2">
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <div className="text-gray-500">BGT Rate:</div>
            <div className="text-yellow-400">🍯 {parseFloat(state.bgtPerSecond).toFixed(4)}/s</div>
            
            {state.auction?.currentLeader && state.auction.currentLeader !== '0x0000000000000000000000000000000000000000' && (
              <>
                <div className="text-gray-500">BGT Earned:</div>
                <div className="text-green-400 font-bold animate-pulse">{calculateBGTAccumulated()}</div>
                
                {pl && (
                  <>
                    <div className="text-gray-500">Current P&L:</div>
                    <div className={parseFloat(pl.profit) > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                      {parseFloat(pl.profit) > 0 ? '↑ +' : '↓ '}{pl.profit} ({pl.percent}%)
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}