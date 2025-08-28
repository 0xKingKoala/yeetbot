import { useEffect, useRef } from 'react';
import clsx from 'clsx';

interface ActivityLogProps {
  logs: any[];
}

export default function ActivityLog({ logs }: ActivityLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-green-400';
      case 'debug': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-0.5 text-xs font-mono bg-gray-900/50 rounded p-2 min-h-[200px]">
        {logs.length === 0 ? (
          <div className="text-gray-500">No activity yet...</div>
        ) : (
          logs.map((log, index) => {
            const time = new Date(log.timestamp).toTimeString().slice(0, 8);
            return (
              <div key={index} className="flex gap-2 hover:bg-gray-800/50 px-1 py-0.5 rounded">
                <span className="text-gray-600">{time}</span>
                <span className={clsx(
                  'font-semibold w-12',
                  getLevelColor(log.level)
                )}>
                  [{(log.level?.toUpperCase() || 'INFO').slice(0, 4)}]
                </span>
                <span className="text-gray-300 break-all flex-1">{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}