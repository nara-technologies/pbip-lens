import type * as vscode from 'vscode';
import { ILogger } from '../../core/ports/ILogger';

export class VSCodeLogger implements ILogger {
    private channel: vscode.OutputChannel | null = null;

    constructor(channelName: string = 'PBIP Lens') {
        try {
            const vscodeModule = require('vscode');
            this.channel = vscodeModule.window.createOutputChannel(channelName);
        } catch {
            this.channel = null;
        }
    }

    private formatMessage(level: string, message: string): string {
        const now = new Date();
        const timestamp = now.toTimeString().split(' ')[0]; // HH:MM:SS
        return `[${timestamp}] [${level}] ${message}`;
    }

    private log(level: string, message: string): void {
        const formatted = this.formatMessage(level, message);
        if (this.channel) {
            this.channel.appendLine(formatted);
        } else {
            console.log(formatted);
        }
    }

    public info(message: string): void {
        this.log('INFO', message);
    }

    public error(message: string, error?: any): void {
        let msg = message;
        if (error !== undefined) {
            const errorStr = error instanceof Error ? error.stack || error.message : String(error);
            msg += ` | Error: ${errorStr}`;
        }
        this.log('ERROR', msg);
    }

    public warn(message: string): void {
        this.log('WARN', message);
    }

    public perf(message: string, durationMs: number): void {
        this.log('PERF', `${message} completed in ${durationMs.toFixed(2)}ms`);
    }

    public show(): void {
        if (this.channel) {
            this.channel.show(true);
        }
    }
}
