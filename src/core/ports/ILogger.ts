export interface ILogger {
    info(message: string): void;
    error(message: string, error?: any): void;
    warn(message: string): void;
    perf(message: string, durationMs: number): void;
}
