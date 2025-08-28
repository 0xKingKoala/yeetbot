import Transport from 'winston-transport';
import { Server as SocketIOServer } from 'socket.io';

interface WebSocketTransportOptions extends Transport.TransportStreamOptions {
  io?: SocketIOServer;
}

export class WebSocketTransport extends Transport {
  private io?: SocketIOServer;

  constructor(opts: WebSocketTransportOptions = {}) {
    super(opts);
    this.io = opts.io;
  }

  setSocketServer(io: SocketIOServer): void {
    this.io = io;
  }

  log(info: any, callback: () => void): void {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Send log to all connected WebSocket clients
    if (this.io) {
      this.io.emit('log', {
        timestamp: new Date(),
        level: info.level,
        message: info.message,
        ...info.metadata
      });
    }

    callback();
  }
}