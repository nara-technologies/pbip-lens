import * as vscode from 'vscode';
import * as path from 'path';
import { IFileSystem } from '../core/ports/IFileSystem';

/**
 * VSCodeFileSystem - IFileSystem implementation using VS Code native VFS API (vscode.workspace.fs).
 *
 * Ensures consistency with open editor buffers and avoids discrepant reads
 * caused by operating system flush latencies.
 */
export class VSCodeFileSystem implements IFileSystem {
    public async readFile(filePath: string): Promise<string> {
        const uri = vscode.Uri.file(filePath);
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf-8');
    }

    public async readDirectory(dirPath: string): Promise<string[]> {
        const uri = vscode.Uri.file(dirPath);
        const entries = await vscode.workspace.fs.readDirectory(uri);
        // VS Code's readDirectory returns an array of [name, type] tuples. Extract names.
        return entries.map(([name]) => name);
    }

    public async isDirectory(targetPath: string): Promise<boolean> {
        const uri = vscode.Uri.file(targetPath);
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            return (stat.type & vscode.FileType.Directory) !== 0;
        } catch {
            return false;
        }
    }

    public async pathExists(targetPath: string): Promise<boolean> {
        const uri = vscode.Uri.file(targetPath);
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    public joinPaths(...paths: string[]): string {
        return path.join(...paths);
    }

    public getDirname(filePath: string): string {
        return path.dirname(filePath);
    }

    public getBasename(filePath: string): string {
        return path.basename(filePath);
    }

    public async writeFile(filePath: string, content: string): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        const bytes = Buffer.from(content, 'utf-8');
        await vscode.workspace.fs.writeFile(uri, bytes);
    }
}

