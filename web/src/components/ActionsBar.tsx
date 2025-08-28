import { useState } from 'react';
import clsx from 'clsx';

interface ActionsBarProps {
  onAction: (action: string) => void;
  currentPrice?: string;
  isPaused?: boolean;
}

export default function ActionsBar({ onAction, currentPrice, isPaused }: ActionsBarProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setLoading(action);
    await onAction(action);
    setTimeout(() => setLoading(null), 1000);
  };

  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-4">
        {/* Left side - Main actions */}
        <div className="flex items-center gap-3">
          <div className="panel-header text-yellow-400 m-0">
            <span>⚡</span>
            <span>Actions</span>
          </div>
          
          <div className="h-8 w-px bg-gray-700" /> {/* Divider */}
          
          <button
            onClick={() => handleAction('yeet')}
            disabled={loading !== null}
            title={`Execute yeet at current price: ${currentPrice || 'N/A'} BERA`}
            className={clsx(
              'px-4 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200',
              'bg-red-500/20 text-red-400 hover:bg-red-500/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center gap-2 group relative'
            )}
          >
            {loading === 'yeet' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>🚀</span>
            )}
            <span>Force Yeet</span>
            {currentPrice && (
              <span className="text-xs opacity-70">@ {parseFloat(currentPrice).toFixed(2)}</span>
            )}
          </button>

          <button
            onClick={() => handleAction('claim')}
            disabled={loading !== null}
            title="Claim accumulated BGT rewards"
            className={clsx(
              'px-4 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200',
              'bg-green-500/20 text-green-400 hover:bg-green-500/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center gap-2'
            )}
          >
            {loading === 'claim' ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>🍯</span>
            )}
            <span>Claim BGT</span>
          </button>
          
          <div className="h-8 w-px bg-gray-700" /> {/* Divider */}
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAction('pause')}
              disabled={loading !== null || isPaused}
              title="Pause bot monitoring"
              className={clsx(
                'px-3 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200',
                'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-1'
              )}
            >
              {loading === 'pause' ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <span>⏸</span>
              )}
              <span>Pause</span>
            </button>

            <button
              onClick={() => handleAction('resume')}
              disabled={loading !== null || !isPaused}
              title="Resume bot monitoring"
              className={clsx(
                'px-3 py-1.5 rounded-lg font-semibold text-sm transition-all duration-200',
                'bg-green-500/20 text-green-400 hover:bg-green-500/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-1'
              )}
            >
              {loading === 'resume' ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <span>▶</span>
              )}
              <span>Resume</span>
            </button>
          </div>
        </div>

        {/* Right side - Status indicator */}
        <div className="flex items-center gap-4">
          {loading && (
            <span className="text-sm text-cyan-400 animate-pulse">
              Processing {loading}...
            </span>
          )}
          {isPaused !== undefined && (
            <div className="flex items-center gap-2">
              <span className={clsx(
                'text-sm font-semibold',
                isPaused ? 'text-yellow-400' : 'text-green-400'
              )}>
                {isPaused ? 'Bot Paused' : 'Bot Active'}
              </span>
              <div className={clsx(
                'w-2 h-2 rounded-full animate-pulse',
                isPaused ? 'bg-yellow-400' : 'bg-green-400'
              )} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}