import { logger, type LogLevel } from "../utils/logger";

export interface DebugEntry {
  level: LogLevel;
  context: string;
  message: string;
  details: unknown[];
  timestamp: number;
}

export type DebugListener = (entry: DebugEntry) => void;

export interface DebugChannel {
  debug(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
}

const DEFAULT_CONTEXT = "General";
const DEFAULT_HISTORY_LIMIT = 200;

class DebugService {
  private readonly history: DebugEntry[] = [];
  private readonly listeners = new Set<DebugListener>();
  private readonly channels = new Map<string, DebugChannel>();

  constructor(private readonly historyLimit: number = DEFAULT_HISTORY_LIMIT) {}

  log(level: LogLevel, context: string, message: string, ...details: unknown[]): void {
    const normalizedContext = context.trim() || DEFAULT_CONTEXT;
    const entry: DebugEntry = {
      level,
      context: normalizedContext,
      message,
      details: details.length ? [...details] : [],
      timestamp: Date.now()
    };

    this.append(entry);
    this.forward(entry);
  }

  debug(context: string, message: string, ...details: unknown[]): void {
    this.log("debug", context, message, ...details);
  }

  info(context: string, message: string, ...details: unknown[]): void {
    this.log("info", context, message, ...details);
  }

  warn(context: string, message: string, ...details: unknown[]): void {
    this.log("warn", context, message, ...details);
  }

  error(context: string, message: string, ...details: unknown[]): void {
    this.log("error", context, message, ...details);
  }

  forContext(context: string): DebugChannel {
    const normalizedContext = context.trim() || DEFAULT_CONTEXT;
    const existing = this.channels.get(normalizedContext);
    if (existing) {
      return existing;
    }

    const channel: DebugChannel = {
      debug: (message, ...details) => this.debug(normalizedContext, message, ...details),
      info: (message, ...details) => this.info(normalizedContext, message, ...details),
      warn: (message, ...details) => this.warn(normalizedContext, message, ...details),
      error: (message, ...details) => this.error(normalizedContext, message, ...details)
    };

    this.channels.set(normalizedContext, channel);
    return channel;
  }

  getHistory(): DebugEntry[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history.length = 0;
  }

  subscribe(listener: DebugListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  enable(): void {
    logger.enable();
  }

  disable(): void {
    logger.disable();
  }

  setEnabled(value: boolean): void {
    logger.setEnabled(value);
  }

  isEnabled(): boolean {
    return logger.isEnabled();
  }

  private append(entry: DebugEntry): void {
    this.history.push(entry);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }

    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch {
        // Avoid breaking debug flow if a listener throws.
      }
    }
  }

  private forward(entry: DebugEntry): void {
    const { level, context, message, details } = entry;
    const prefix = `[${context}] ${message}`;

    if (details.length === 0) {
      logger[level](prefix);
      return;
    }

    logger[level](prefix, ...details);
  }
}

export const debugService = new DebugService();
