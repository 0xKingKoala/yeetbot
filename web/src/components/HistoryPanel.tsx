import { useEffect, useRef } from 'react';
import clsx from 'clsx';

interface HistoryPanelProps {
  history: any[];
}

export default function HistoryPanel({ history }: HistoryPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new entries arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-1 text-xs font-mono bg-gray-900/50 rounded p-2 min-h-[200px]">
        {history.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No yeet history yet...</div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="flex gap-2 text-gray-500 text-xs border-b border-gray-700 pb-1">
              <span className="w-20">Time</span>
              <span className="w-24">Round</span>
              <span className="flex-1">Yeeter</span>
              <span className="w-24 text-right">Amount</span>
              <span className="w-20 text-right">Duration</span>
            </div>
            
            {/* History entries */}
            {history.map((entry, index) => {
              const time = new Date(entry.timestamp).toTimeString().slice(0, 8);
              const isOurYeet = entry.isOurs || false;
              
              return (
                <div 
                  key={index} 
                  className={clsx(
                    "flex gap-2 py-0.5 px-1 rounded",
                    isOurYeet ? 'bg-green-900/20 text-green-400' : 'hover:bg-gray-800/50'
                  )}
                >
                  <span className="w-20 text-gray-500">{time}</span>
                  <span className="w-24 text-cyan-400">Round {entry.round || '?'}</span>
                  <span className="flex-1 font-mono text-xs">
                    {isOurYeet && '👑 '}
                    {entry.address 
                      ? `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`
                      : 'Unknown'}
                  </span>
                  <span className="w-24 text-right text-yellow-400">
                    {entry.amount ? parseFloat(entry.amount).toFixed(4) : '0'} BERA
                  </span>
                  <span className="w-20 text-right text-gray-400">
                    {entry.duration || '?'}s
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