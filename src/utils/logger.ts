declare const __DEBUG_LOGGING__: boolean | undefined;

export type LogLevel = "debug" | "info" | "warn" | "error";

const prefix = "[UXBiblio]";

let enabled = typeof __DEBUG_LOGGING__ === "boolean" ? __DEBUG_LOGGING__ : true;

function emit(level: LogLevel, ...args: unknown[]) {
  if (!enabled) {
    return;
  }

  const message = [`${prefix}[${level.toUpperCase()}]`, ...args];
  const consoleMethod = console[level as keyof Console];
  const fallback = console.log.bind(console);

  if (typeof consoleMethod === "function") {
    (consoleMethod as (...values: unknown[]) => void).apply(console, message);
    return;
  }

  fallback(...message);
}

export const logger = {
  enable(): void {
    enabled = true;
  },
  disable(): void {
    enabled = false;
  },
  setEnabled(value: boolean): void {
    enabled = value;
  },
  isEnabled(): boolean {
    return enabled;
  },
  debug: (...args: unknown[]): void => emit("debug", ...args),
  info: (...args: unknown[]): void => emit("info", ...args),
  warn: (...args: unknown[]): void => emit("warn", ...args),
  error: (...args: unknown[]): void => emit("error", ...args)
};
