import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Config } from '../config/Config';
import { join } from 'path';

// Custom log levels with colors
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'gray',
  },
};

// Add colors to winston
winston.addColors(customLevels.colors);

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;
  private config = Config.getInstance().get();
  
  private constructor() {
    this.logger = this.createLogger();
  }
  
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];
    
    // Console transport
    if (this.config.logging.console.enabled) {
      const consoleFormat = this.config.logging.format === 'json'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize({ all: this.config.logging.console.colors }),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.printf(this.formatPrettyLog)
          );
      
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
        })
      );
    }
    
    // File transport with rotation
    if (this.config.logging.file?.enabled) {
      const fileFormat = winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      );
      
      // Error log file
      transports.push(
        new DailyRotateFile({
          filename: join(this.config.logging.file.path, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.logging.file.maxSize,
          maxFiles: this.config.logging.file.maxFiles,
          level: 'error',
          format: fileFormat,
        })
      );
      
      // Combined log file
      transports.push(
        new DailyRotateFile({
          filename: join(this.config.logging.file.path, 'combined-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: this.config.logging.file.maxSize,
          maxFiles: this.config.logging.file.maxFiles,
          format: fileFormat,
        })
      );
    }
    
    return winston.createLogger({
      levels: customLevels.levels,
      level: this.config.logging.level,
      transports,
      // Add default metadata
      defaultMeta: {
        service: 'yeet-bot-v2',
        environment: this.config.environment,
      },
    });
  }
  
  private formatPrettyLog(info: winston.Logform.TransformableInfo): string {
    const { timestamp, level, message, context, ...rest } = info;
    
    let log = `[${timestamp}] ${level}: ${message}`;
    
    // Add context if present
    if (context && Object.keys(context).length > 0) {
      log += ` ${JSON.stringify(context)}`;
    }
    
    // Add any additional fields
    const additional = Object.keys(rest).filter(key => 
      !['service', 'environment'].includes(key)
    );
    
    if (additional.length > 0) {
      const additionalData = additional.reduce((acc, key) => {
        acc[key] = rest[key];
        return acc;
      }, {} as any);
      log += ` ${JSON.stringify(additionalData)}`;
    }
    
    return log;
  }
  
  // Logging methods
  public error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, {
      ...context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : undefined,
    });
  }
  
  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }
  
  public info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }
  
  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }
  
  public trace(message: string, context?: LogContext): void {
    this.logger.log('trace', message, context);
  }
  
  // Specialized logging methods
  public transaction(action: string, details: {
    hash?: string;
    from?: string;
    to?: string;
    value?: string;
    gasUsed?: string;
    status?: 'pending' | 'success' | 'failed';
    error?: string;
  }): void {
    const level = details.status === 'failed' ? 'error' : 'info';
    this.logger.log(level, `Transaction ${action}`, {
      category: 'transaction',
      ...details,
    });
  }
  
  public ruleEvaluation(ruleName: string, decision: {
    shouldYeet: boolean;
    reason: string;
    priority: number;
    metadata?: any;
  }): void {
    this.debug(`Rule evaluation: ${ruleName}`, {
      category: 'rule',
      rule: ruleName,
      decision,
    });
  }
  
  public metric(name: string, value: number, unit?: string, metadata?: LogContext): void {
    this.info(`Metric: ${name}`, {
      category: 'metric',
      metric: name,
      value,
      unit,
      ...metadata,
    });
  }
  
  public stateChange(state: string, details?: LogContext): void {
    this.info(`State change: ${state}`, {
      category: 'state',
      state,
      ...details,
    });
  }
  
  // Create child logger with persistent context
  public child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
  
  // Get the underlying Winston logger for adding transports
  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}

// Child logger that maintains context
export class ChildLogger {
  constructor(
    private parent: Logger,
    private context: LogContext
  ) {}
  
  error(message: string, error?: Error, context?: LogContext): void {
    this.parent.error(message, error, { ...this.context, ...context });
  }
  
  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...context });
  }
  
  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...this.context, ...context });
  }
  
  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...context });
  }
  
  trace(message: string, context?: LogContext): void {
    this.parent.trace(message, { ...this.context, ...context });
  }
}

// Export singleton getter
export function getLogger(): Logger {
  return Logger.getInstance();
}

// Export convenience functions
export const logger = {
  error: (message: string, error?: Error, context?: LogContext) => 
    getLogger().error(message, error, context),
  warn: (message: string, context?: LogContext) => 
    getLogger().warn(message, context),
  info: (message: string, context?: LogContext) => 
    getLogger().info(message, context),
  debug: (message: string, context?: LogContext) => 
    getLogger().debug(message, context),
  trace: (message: string, context?: LogContext) => 
    getLogger().trace(message, context),
  transaction: (action: string, details: any) => 
    getLogger().transaction(action, details),
  ruleEvaluation: (ruleName: string, decision: any) => 
    getLogger().ruleEvaluation(ruleName, decision),
  metric: (name: string, value: number, unit?: string, metadata?: LogContext) => 
    getLogger().metric(name, value, unit, metadata),
  stateChange: (state: string, details?: LogContext) => 
    getLogger().stateChange(state, details),
  child: (context: LogContext) => 
    getLogger().child(context),
};