import type * as vscode from 'vscode';

/**
 * Logger - Observability Subsystem
 *
 * Implements a VS Code OutputChannel log stream.
 * Provides fault-tolerance to run seamlessly within unit test environments
 * (e.g., Jest) without dependencies on 'vscode' modules.
 */
export class Logger {
    private static instance: Logger;
    private channel: vscode.OutputChannel | null = null;

    private constructor() {
        try {
            const vscodeModule = require('vscode');
            this.channel = vscodeModule.window.createOutputChannel('PBIP Lens');
        } catch {
            // Mute or redirect to stdout when running outside VS Code (e.g., tests)
            this.channel = null;
        }
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private formatMessage(level: string, msg: string): string {
        const now = new Date();
        const timestamp = now.toTimeString().split(' ')[0]; // HH:MM:SS
        return `[${timestamp}] [${level}] ${msg}`;
    }

    public log(level: string, msg: string): void {
        const formatted = this.formatMessage(level, msg);
        if (this.channel) {
            this.channel.appendLine(formatted);
        } else {
            console.log(formatted);
        }
    }

    public static info(msg: string): void {
        Logger.getInstance().log('INFO', msg);
    }

    public static warn(msg: string): void {
        Logger.getInstance().log('WARN', msg);
    }

    public static error(msg: string): void {
        Logger.getInstance().log('ERROR', msg);
    }

    public static perf(operation: string, ms: number): void {
        Logger.getInstance().log('PERF', `${operation} completed in ${ms.toFixed(2)}ms`);
    }

    public static show(): void {
        const inst = Logger.getInstance();
        if (inst.channel) {
            inst.channel.show(true);
        }
    }
}
