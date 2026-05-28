import { IFileSystem } from '../ports/IFileSystem';
import { SemanticGraph } from '../graph/SemanticGraph';
import { SemanticNode, NodeKinds, EdgeTypes, RelationshipNode } from '../models/CanonicalModel';

interface RawRelationship {
    name: string;
    from: string;
    to: string;
    behavior: 'Both' | 'Single' | 'Automatic';
    filePath: string;
    lineNum: number;
}

export class RelationshipParser {
    constructor(private fs: IFileSystem) {}

    /**
     * Parses relationship definitions from TMDL files and registers them in the semantic graph.
     */
    public async parse(folderPath: string, graph: SemanticGraph): Promise<void> {
        const tmdlFiles = await this.findTmdlFiles(folderPath);
        const parsedRelationships: RawRelationship[] = [];

        for (const filePath of tmdlFiles) {
            try {
                const content = await this.fs.readFile(filePath);
                const rels = this.parseFileContent(filePath, content);
                parsedRelationships.push(...rels);
            } catch (error) {
                // Fail-safe file reading: log and continue
                console.error(`Error reading or parsing relationship from ${filePath}:`, error);
            }
        }

        // Ingest into the graph
        for (const rel of parsedRelationships) {
            const fromParsed = this.parseTableAndColumn(rel.from);
            const toParsed = this.parseTableAndColumn(rel.to);

            if (fromParsed && toParsed) {
                const fromColumnId = `column:${fromParsed.tableName.toLowerCase()}.${fromParsed.columnName.toLowerCase()}`;
                const toColumnId = `column:${toParsed.tableName.toLowerCase()}.${toParsed.columnName.toLowerCase()}`;

                const fromNode = graph.getNode(fromColumnId);
                const toNode = graph.getNode(toColumnId);

                if (fromNode && toNode) {
                    // Create the canonical RelationshipNode to be part of the graph nodes
                    const relNodeId = `relationship:${fromColumnId}-${toColumnId}`;
                    const relNode: RelationshipNode = {
                        id: relNodeId,
                        semanticKey: relNodeId,
                        kind: NodeKinds.Relationship,
                        version: 1,
                        qualifiedName: `relationship:${fromParsed.tableName}.${fromParsed.columnName}-${toParsed.tableName}.${toParsed.columnName}`,
                        name: rel.name,
                        source: { filePath: rel.filePath, line: rel.lineNum },
                        fromColumnId: fromColumnId,
                        toColumnId: toColumnId,
                        crossFilteringBehavior: rel.behavior,
                    };

                    graph.beginTransaction();
                    graph.upsertNode(relNode);
                    graph.commit();

                    // Cierre de Grafo: Add bidirectional RELATIONSHIP edges between the two columns
                    graph.beginTransaction();
                    graph.addEdge({
                        sourceId: fromColumnId,
                        targetId: toColumnId,
                        type: EdgeTypes.Relationship,
                        confidence: 'high',
                    });
                    graph.addEdge({
                        sourceId: toColumnId,
                        targetId: fromColumnId,
                        type: EdgeTypes.Relationship,
                        confidence: 'high',
                    });
                    graph.commit();
                }
            }
        }
    }

    private async findTmdlFiles(folderPath: string): Promise<string[]> {
        if (!(await this.fs.pathExists(folderPath))) {
            return [];
        }

        let targetDir = folderPath;
        if (!(folderPath.endsWith('.SemanticModel') && (await this.fs.isDirectory(folderPath)))) {
            const entries = await this.fs.readDirectory(folderPath);
            for (const entry of entries) {
                if (entry.endsWith('.SemanticModel')) {
                    const fullPath = this.fs.joinPaths(folderPath, entry);
                    if (await this.fs.isDirectory(fullPath)) {
                        targetDir = fullPath;
                        break;
                    }
                }
            }
        }

        const definitionDir = this.fs.joinPaths(targetDir, 'definition');
        if (await this.fs.pathExists(definitionDir)) {
            return this.getAllTmdlFiles(definitionDir);
        }
        return this.getAllTmdlFiles(targetDir);
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

    private parseFileContent(filePath: string, content: string): RawRelationship[] {
        const relationships: RawRelationship[] = [];
        const lines = content.split(/\r?\n/);
        let inBlock = false;
        let blockIndent = 0;
        let currentFrom: string | null = null;
        let currentTo: string | null = null;
        let currentBehavior: 'Both' | 'Single' | 'Automatic' = 'Single';
        let relName = '';
        let startLine = 1;

        const finalizeRelationship = (lineIdx: number) => {
            if (currentFrom && currentTo) {
                relationships.push({
                    name: relName || `rel_${startLine}`,
                    from: currentFrom,
                    to: currentTo,
                    behavior: currentBehavior,
                    filePath,
                    lineNum: startLine,
                });
            }
            currentFrom = null;
            currentTo = null;
            currentBehavior = 'Single';
            relName = '';
            inBlock = false;
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                continue;
            }

            const relationshipMatch = line.match(/^(\s*)relationship\s+(\S+)/i);
            if (relationshipMatch) {
                if (inBlock) {
                    finalizeRelationship(i);
                }
                inBlock = true;
                blockIndent = relationshipMatch[1].length;
                relName = relationshipMatch[2];
                startLine = i + 1;
                continue;
            }

            if (inBlock) {
                const currentIndent = line.match(/^(\s*)/)?.[1].length || 0;
                if (currentIndent <= blockIndent) {
                    finalizeRelationship(i);
                    i--; // Backtrack
                    continue;
                }

                const fromMatch = trimmed.match(/^fromColumn\s*:\s*(.*)$/i);
                if (fromMatch) {
                    currentFrom = fromMatch[1].trim();
                    continue;
                }

                const toMatch = trimmed.match(/^toColumn\s*:\s*(.*)$/i);
                if (toMatch) {
                    currentTo = toMatch[1].trim();
                    continue;
                }

                const behaviorMatch = trimmed.match(/^crossFilteringBehavior\s*:\s*(.*)$/i);
                if (behaviorMatch) {
                    const val = behaviorMatch[1].trim().toLowerCase();
                    if (val === 'bothdirections' || val === 'both') {
                        currentBehavior = 'Both';
                    } else if (val === 'automatic') {
                        currentBehavior = 'Automatic';
                    } else {
                        currentBehavior = 'Single';
                    }
                    continue;
                }
            }
        }

        if (inBlock) {
            finalizeRelationship(lines.length);
        }

        return relationships;
    }

    private parseTableAndColumn(raw: string): { tableName: string; columnName: string } | null {
        raw = raw.trim();
        let tableName = '';
        let columnName = '';

        if (raw.startsWith("'")) {
            const nextQuote = raw.indexOf("'", 1);
            if (nextQuote !== -1) {
                tableName = raw.substring(1, nextQuote);
                let rest = raw.substring(nextQuote + 1).trim();
                if (rest.startsWith('.')) {
                    rest = rest.substring(1).trim();
                    columnName = this.cleanPart(rest);
                }
            }
        } else if (raw.startsWith('"')) {
            const nextQuote = raw.indexOf('"', 1);
            if (nextQuote !== -1) {
                tableName = raw.substring(1, nextQuote);
                let rest = raw.substring(nextQuote + 1).trim();
                if (rest.startsWith('.')) {
                    rest = rest.substring(1).trim();
                    columnName = this.cleanPart(rest);
                }
            }
        } else if (raw.startsWith('[')) {
            const nextBracket = raw.indexOf(']', 1);
            if (nextBracket !== -1) {
                tableName = raw.substring(1, nextBracket);
                let rest = raw.substring(nextBracket + 1).trim();
                if (rest.startsWith('.')) {
                    rest = rest.substring(1).trim();
                    columnName = this.cleanPart(rest);
                }
            }
        } else {
            const dotIdx = raw.indexOf('.');
            if (dotIdx !== -1) {
                tableName = raw.substring(0, dotIdx).trim();
                columnName = this.cleanPart(raw.substring(dotIdx + 1).trim());
            }
        }

        if (tableName && columnName) {
            return { tableName, columnName };
        }
        return null;
    }

    private cleanPart(part: string): string {
        part = part.trim();
        if (part.startsWith('[') && part.endsWith(']')) {
            return part.substring(1, part.length - 1).trim();
        }
        if (part.startsWith("'") && part.endsWith("'")) {
            return part.substring(1, part.length - 1).trim();
        }
        if (part.startsWith('"') && part.endsWith('"')) {
            return part.substring(1, part.length - 1).trim();
        }
        return part;
    }
}
