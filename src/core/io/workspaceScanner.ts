import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ReportPageFiles {
    pageJsonPath: string;
    visualJsonPaths: string[];
}

export class WorkspaceScanner {
    static async getPBIPBasePath(): Promise<string | null> {
        const pbipFiles = await vscode.workspace.findFiles('**/*.pbip', '**/node_modules/**', 1);
        if (pbipFiles.length === 0) {
            return null;
        }
        return path.dirname(pbipFiles[0].fsPath);
    }

    static async getTMDLFiles(basePath: string): Promise<string[]> {
        const tmdlFiles: string[] = [];
        
        let datasetDir = basePath;
        try {
            const rootEntries = fs.readdirSync(basePath, { withFileTypes: true });
            const validDatasetFolder = rootEntries.find(e => 
                e.isDirectory() && 
                (e.name.endsWith('.Dataset') || e.name.endsWith('.SemanticModel')) &&
                !e.name.toLowerCase().includes('backup') &&
                !e.name.toLowerCase().includes('copy') &&
                !e.name.toLowerCase().includes('copia')
            );
            if (validDatasetFolder) {
                datasetDir = path.join(basePath, validDatasetFolder.name);
                // Si existe la subcarpeta 'definition', limitarnos estrictamente a ella
                const defPath = path.join(datasetDir, 'definition');
                if (fs.existsSync(defPath)) {
                    datasetDir = defPath;
                }
            }
        } catch { /* fallback a basePath completo */ }

        const readRecursive = (dir: string) => {
            let entries;
            try {
                entries = fs.readdirSync(dir, { withFileTypes: true });
            } catch { return; }
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && entry.name !== '.git') {
                        // Filtro de seguridad adicional para subcarpetas de backup y omisión explícita de TMDLScripts
                        if (entry.name.toLowerCase().includes('backup') || 
                            entry.name.toLowerCase().includes('history') ||
                            entry.name.toLowerCase() === 'tmdlscripts') {
                            continue;
                        }
                        readRecursive(fullPath);
                    }
                } else if (entry.isFile() && entry.name.endsWith('.tmdl')) {
                    tmdlFiles.push(fullPath);
                }
            }
        };
        
        readRecursive(datasetDir);
        return tmdlFiles;
    }

    static async getReportPages(basePath: string): Promise<ReportPageFiles[]> {
        const results: ReportPageFiles[] = [];
        
        const readPagesRecursive = (dir: string) => {
            let entries;
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } 
            catch { return; }
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && entry.name !== '.git') {
                        readPagesRecursive(fullPath);
                    }
                } else if (entry.isFile() && entry.name === 'page.json') {
                    // Validamos que estemos en una estructura Report/report/pages/...
                    if (fullPath.includes('.Report') && fullPath.includes('pages')) {
                        const pageFolder = path.dirname(fullPath);
                        const visualsDir = path.join(pageFolder, 'visuals');
                        
                        let visualFiles: string[] = [];
                        if (fs.existsSync(visualsDir)) {
                            visualFiles = fs.readdirSync(visualsDir)
                                .filter(folderName => {
                                    const stats = fs.statSync(path.join(visualsDir, folderName));
                                    return stats.isDirectory();
                                })
                                .map(folderName => path.join(visualsDir, folderName, 'visual.json'))
                                .filter(filePath => fs.existsSync(filePath));
                        }
                            
                        results.push({
                            pageJsonPath: fullPath,
                            visualJsonPaths: visualFiles
                        });
                    }
                }
            }
        };
        
        readPagesRecursive(basePath);
        return results;
    }
}
