import { ILogger } from '../../core/ports/ILogger';

export class ConsoleLogger implements ILogger {
    private formatMessage(level: string, colorCode: string, message: string): string {
        const now = new Date();
        const timestamp = now.toTimeString().split(' ')[0]; // HH:MM:SS
        // ANSI escape code: colorCode for level, \x1b[0m resets
        return `\x1b[90m[${timestamp}]\x1b[0m ${colorCode}[${level}]\x1b[0m ${message}`;
    }

    public info(message: string): void {
        // Cyan color for INFO
        const formatted = this.formatMessage('INFO', '\x1b[36m', message);
        process.stdout.write(formatted + '\n');
    }

    public warn(message: string): void {
        // Yellow color for WARN
        const formatted = this.formatMessage('WARN', '\x1b[33m', message);
        process.stdout.write(formatted + '\n');
    }

    public error(message: string, error?: any): void {
        // Red color for ERROR
        let msg = message;
        if (error !== undefined) {
            const errorStr = error instanceof Error ? error.stack || error.message : String(error);
            msg += ` | Error: ${errorStr}`;
        }
        const formatted = this.formatMessage('ERROR', '\x1b[31m', msg);
        process.stderr.write(formatted + '\n');
    }

    public perf(message: string, durationMs: number): void {
        // Magenta color for PERF
        const formatted = this.formatMessage('PERF', '\x1b[35m', `${message} completed in ${durationMs.toFixed(2)}ms`);
        process.stdout.write(formatted + '\n');
    }
}
