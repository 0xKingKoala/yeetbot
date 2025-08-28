import clsx from 'clsx';

interface HeaderProps {
  connected: boolean;
  dryRun?: boolean;
}

export default function Header({ connected, dryRun }: HeaderProps) {
  return (
    <header className="bg-gray-800 border-b border-gray-700 h-16">
      <div className="container mx-auto px-4 h-full">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-yeet-purple to-yeet-pink bg-clip-text text-transparent">
              🚀 YEET BOT V2
            </h1>
            {dryRun !== undefined && (
              <span className={clsx(
                'px-2 py-0.5 rounded-full text-xs font-semibold',
                dryRun ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
              )}>
                {dryRun ? '🧪 DRY RUN' : '💰 LIVE'}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className={clsx(
              'status-indicator',
              connected ? 'bg-green-500' : 'bg-red-500'
            )} />
            <span className="text-sm text-gray-400">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}