import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import StatePanel from './components/StatePanel';
import RulesPanel from './components/RulesPanel';
import StatsPanel from './components/StatsPanel';
import ActionsBar from './components/ActionsBar';
import InfoTabs from './components/InfoTabs';

interface BotState {
  state: any;
  rules: any;
  config?: any;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [botState, setBotState] = useState<BotState | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [plData, setPlData] = useState<any[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    // Connect to WebSocket server
    const newSocket = io('http://localhost:3000', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to dashboard server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from dashboard server');
      setConnected(false);
    });

    newSocket.on('state:update', (data: BotState) => {
      setBotState(data);
    });

    newSocket.on('log', (log: any) => {
      setLogs(prev => [...prev.slice(-99), log]); // Keep last 100 logs
    });

    newSocket.on('history:update', (data: any[]) => {
      setHistory(data);
    });

    newSocket.on('pl:update', (data: any[]) => {
      setPlData(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleAction = async (action: string) => {
    try {
      const response = await fetch(`/api/actions/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      
      // Update pause state
      if (action === 'pause') {
        setIsPaused(true);
      } else if (action === 'resume') {
        setIsPaused(false);
      }
      
      // Add to logs
      setLogs(prev => [...prev, {
        timestamp: new Date(),
        level: result.success ? 'info' : 'error',
        message: result.message || `Action ${action} ${result.success ? 'succeeded' : 'failed'}`
      }]);
    } catch (error) {
      console.error(`Failed to execute action ${action}:`, error);
      setLogs(prev => [...prev, {
        timestamp: new Date(),
        level: 'error',
        message: `Failed to execute ${action}: ${error}`
      }]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto px-4 py-4 flex flex-col h-screen">
        {/* Top Row - Actions Bar */}
        <div className="mb-4">
          <ActionsBar 
            onAction={handleAction}
            currentPrice={botState?.state?.auction?.currentPrice}
            isPaused={isPaused}
          />
        </div>
        
        {/* Main Grid Layout - Adjusted to give more space to rules */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
          {/* Left Column - State and Stats (narrower) */}
          <div className="lg:col-span-3 space-y-3">
            <StatePanel state={botState?.state} />
            <StatsPanel stats={botState?.state?.stats} />
          </div>
          
          {/* Right Column - Rules and Activity Log (wider) */}
          <div className="lg:col-span-9 flex flex-col space-y-3 min-h-0">
            <RulesPanel rules={botState?.rules} />
            <div className="flex-1 min-h-0">
              <InfoTabs logs={logs} history={history} plData={plData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;