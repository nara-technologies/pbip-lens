import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { IFileSystem } from '../core/ports/IFileSystem';

export class NodeFileSystem implements IFileSystem {
    public async readFile(filePath: string): Promise<string> {
        return await fs.readFile(filePath, 'utf-8');
    }

    public async readDirectory(dirPath: string): Promise<string[]> {
        return await fs.readdir(dirPath);
    }

    public async isDirectory(targetPath: string): Promise<boolean> {
        const stats = await fs.stat(targetPath);
        return stats.isDirectory();
    }

    public async pathExists(targetPath: string): Promise<boolean> {
        try {
            await fs.access(targetPath, fsSync.constants.F_OK);
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
        await fs.writeFile(filePath, content, 'utf-8');
    }
}

