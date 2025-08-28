import { useState } from 'react';
import clsx from 'clsx';
import ActivityLog from './ActivityLog';
import HistoryPanel from './HistoryPanel';
import PLPanel from './PLPanel';

interface InfoTabsProps {
  logs: any[];
  history?: any[];
  plData?: any[];
}

export default function InfoTabs({ logs, history = [], plData = [] }: InfoTabsProps) {
  const [activeTab, setActiveTab] = useState<'logs' | 'history' | 'pl'>('logs');

  const tabs = [
    { id: 'logs', label: '📋 Logs', count: logs.length },
    { id: 'history', label: '📜 History', count: history.length },
    { id: 'pl', label: '💰 P&L', count: plData.length },
  ];

  return (
    <div className="panel h-full overflow-hidden flex flex-col">
      {/* Tab Headers */}
      <div className="flex items-center border-b border-gray-700">
        <div className="flex gap-1 p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded transition-colors',
                activeTab === tab.id
                  ? 'bg-gray-700 text-cyan-400'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-xs opacity-60">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'logs' && <ActivityLog logs={logs} />}
        {activeTab === 'history' && <HistoryPanel history={history} />}
        {activeTab === 'pl' && <PLPanel plData={plData} />}
      </div>
    </div>
  );
}