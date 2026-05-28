import { IFileSystem } from '../ports/IFileSystem';
import { Logger } from '../utils/Logger';

export class PbipProjectReader {
    constructor(private fs: IFileSystem) {}

    public async loadSemanticModel(basePath: string): Promise<Map<string, string>> {
        const fileContents = new Map<string, string>();

        if (!(await this.fs.pathExists(basePath))) {
            throw new Error(`Project base path not found: ${basePath}`);
        }

        let semanticModelDir = '';

        // Check if the provided base path directly references a SemanticModel directory.
        if (basePath.endsWith('.SemanticModel') && (await this.fs.isDirectory(basePath))) {
            semanticModelDir = basePath;
        } else {
            // Search for a .SemanticModel subdirectory within the workspace root.
            const entries = await this.fs.readDirectory(basePath);
            for (const entry of entries) {
                if (entry.endsWith('.SemanticModel')) {
                    const fullPath = this.fs.joinPaths(basePath, entry);
                    if (await this.fs.isDirectory(fullPath)) {
                        semanticModelDir = fullPath;
                        break;
                    }
                }
            }
        }

        if (!semanticModelDir) {
            throw new Error(`No .SemanticModel directory found in ${basePath}`);
        }

        // Read TMDL files recursively from the 'definition' directory.
        const definitionDir = this.fs.joinPaths(semanticModelDir, 'definition');
        if (await this.fs.pathExists(definitionDir)) {
            const tmdlFiles = await this.getAllTmdlFiles(definitionDir);

            // Parallel file reading using bounded concurrency chunks.
            const CHUNK_SIZE = 50;
            for (let i = 0; i < tmdlFiles.length; i += CHUNK_SIZE) {
                const chunk = tmdlFiles.slice(i, i + CHUNK_SIZE);
                const chunkPromises = chunk.map(async (filePath) => {
                    try {
                        const content = await this.fs.readFile(filePath);
                        return { filePath, content };
                    } catch (error) {
                        Logger.error(`Error leyendo ${filePath}: ${error}`);
                        return null;
                    }
                });

                const chunkResults = await Promise.all(chunkPromises);
                for (const res of chunkResults) {
                    if (res) {
                        fileContents.set(res.filePath, res.content);
                    }
                }
            }
        }

        // Fallback to legacy single-file model.bim if no TMDL files are found.
        if (fileContents.size === 0) {
            const bimPath = this.fs.joinPaths(semanticModelDir, 'model.bim');
            if (await this.fs.pathExists(bimPath)) {
                const content = await this.fs.readFile(bimPath);
                fileContents.set(bimPath, content);
            }
        }

        return fileContents;
    }

    private async getAllTmdlFiles(currentPath: string): Promise<string[]> {
        const entries = await this.fs.readDirectory(currentPath);
        const promises = entries.map(async (entry) => {
            const fullPath = this.fs.joinPaths(currentPath, entry);
            const isDir = await this.fs.isDirectory(fullPath);
            if (isDir) {
                return await this.getAllTmdlFiles(fullPath);
            } else if (entry.endsWith('.tmdl')) {
                return [fullPath];
            }
            return [];
        });
        const results = await Promise.all(promises);
        return results.flat();
    }
}

