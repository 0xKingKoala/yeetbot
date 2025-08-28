import winston from 'winston';
import Transport from 'winston-transport';
import { Dashboard } from './Dashboard';

/**
 * Custom Winston transport that sends logs directly to the dashboard UI
 * Extends the base Transport class instead of Stream since we don't need actual stream functionality
 */
export class DashboardTransport extends Transport {
  private dashboard: Dashboard | null = null;

  constructor(options?: Transport.TransportStreamOptions) {
    super(options);
  }

  public setDashboard(dashboard: Dashboard): void {
    this.dashboard = dashboard;
  }

  /**
   * Core logging method that receives log entries from Winston
   * and forwards them to the dashboard UI
   */
  log(info: any, callback: () => void): void {
    // Emit logged event for Winston's internal tracking
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Send log to dashboard if it's been initialized
    if (this.dashboard) {
      const { level, message, timestamp } = info;
      
      // Forward the log entry to the dashboard's log panel
      this.dashboard.addLog(
        level, 
        message, 
        timestamp ? new Date(timestamp) : new Date()
      );
    }

    // Callback to indicate log processing is complete
    if (callback) {
      callback();
    }
  }
}