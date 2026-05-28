import { IFileSystem } from '../ports/IFileSystem';
import { Logger } from '../utils/Logger';

export interface TablePermission {
    tableName: string;
    daxExpression: string;
    line: number;
}

export interface RoleData {
    roleName: string;
    filePath: string;
    line: number;
    tablePermissions: TablePermission[];
}

export class SecurityParser {
    constructor(private fs: IFileSystem) {}

    public async parseSecurityRoles(
        basePath: string,
        resolvedSemanticModelDir?: string,
    ): Promise<RoleData[]> {
        let semanticModelDir = resolvedSemanticModelDir || '';

        if (!semanticModelDir) {
            if (basePath.endsWith('.SemanticModel') && (await this.fs.isDirectory(basePath))) {
                semanticModelDir = basePath;
            } else {
                // Find the SemanticModel subdirectory
                try {
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
                } catch (error) {
                    Logger.error(`Error listing base directory for roles: ${error}`);
                    return [];
                }
            }
        }

        if (!semanticModelDir) {
            Logger.warn(
                `No .SemanticModel directory found when searching for roles in: ${basePath}`,
            );
            return [];
        }

        const rolesDir = this.fs.joinPaths(semanticModelDir, 'definition/roles');
        if (!(await this.fs.pathExists(rolesDir))) {
            return [];
        }

        const roles: RoleData[] = [];
        const cleanName = (name: string) => name.replace(/^['"]|['"]$/g, '');

        try {
            const entries = await this.fs.readDirectory(rolesDir);
            const tmdlFiles = entries.filter((entry) => entry.endsWith('.tmdl'));

            for (const file of tmdlFiles) {
                const filePath = this.fs.joinPaths(rolesDir, file);
                try {
                    const content = await this.fs.readFile(filePath);
                    const lines = content.split(/\r?\n/);

                    let currentRoleName: string | null = null;
                    let roleLine = 0;
                    const tablePermissions: TablePermission[] = [];

                    let capturingPermission = false;
                    let currentPermission: TablePermission | null = null;
                    let inBackticks = false;
                    let expressionLines: string[] = [];
                    let parentIndent = 0;

                    const getIndentLevel = (l: string): number => {
                        const match = l.match(/^(\s*)/);
                        return match ? match[1].replace(/\t/g, '    ').length : 0;
                    };

                    const finalizePermission = () => {
                        if (currentPermission) {
                            if (expressionLines.length > 0) {
                                // Clear base indentation
                                let minIndent = Infinity;
                                for (const l of expressionLines) {
                                    if (l.trim() === '') continue;
                                    const match = l.match(/^(\s*)/);
                                    if (match) {
                                        minIndent = Math.min(minIndent, match[1].length);
                                    }
                                }
                                if (minIndent === Infinity) minIndent = 0;

                                const cleanedLines = expressionLines.map((l) =>
                                    l.substring(Math.min(minIndent, l.length)),
                                );
                                currentPermission.daxExpression = cleanedLines.join('\n').trim();
                            }
                            tablePermissions.push(currentPermission);
                            currentPermission = null;
                            expressionLines = [];
                        }
                        capturingPermission = false;
                        inBackticks = false;
                    };

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        const trimmed = line.trim();

                        if (trimmed === '' && !inBackticks) {
                            continue;
                        }

                        // 1. Detect Role
                        const roleMatch = line.match(/^role\s+(.+)$/);
                        if (roleMatch) {
                            finalizePermission();
                            currentRoleName = cleanName(roleMatch[1].trim());
                            roleLine = i + 1;
                            continue;
                        }

                        // 2. Detect tablePermission
                        const permMatch = line.match(/^\s*tablePermission\s+([^=]+)(?:\s*=(.*))?$/);
                        if (permMatch) {
                            finalizePermission();
                            const tableName = cleanName(permMatch[1].trim());
                            const restOfLine = permMatch[2];
                            parentIndent = getIndentLevel(line);

                            currentPermission = {
                                tableName,
                                daxExpression: '',
                                line: i + 1,
                            };

                            if (restOfLine !== undefined) {
                                capturingPermission = true;
                                const exprStart = restOfLine.trim();
                                if (exprStart.startsWith('```')) {
                                    if (exprStart.endsWith('```') && exprStart.length >= 6) {
                                        const content = exprStart.slice(3, -3).trim();
                                        if (content) expressionLines.push(content);
                                        finalizePermission();
                                    } else {
                                        inBackticks = true;
                                        const content = exprStart.substring(3).trim();
                                        if (content) expressionLines.push(content);
                                    }
                                } else if (exprStart !== '') {
                                    expressionLines.push(exprStart);
                                }
                            }
                            continue;
                        }

                        // 3. Capture DAX expression from tablePermission
                        if (capturingPermission) {
                            if (inBackticks) {
                                if (trimmed.endsWith('```')) {
                                    const content = line.replace(/```\s*$/, '');
                                    if (content.trim() !== '') expressionLines.push(content);
                                    finalizePermission();
                                } else {
                                    expressionLines.push(line);
                                }
                                continue;
                            }

                            if (trimmed !== '') {
                                const currentIndent = getIndentLevel(line);
                                if (currentIndent <= parentIndent) {
                                    finalizePermission();
                                    i--; // Re-evaluate this line (could be another property or the next role)
                                    continue;
                                }

                                // Truncation by reserved TMDL keywords in role context (fallback)
                                const isMetadata = line.match(
                                    /^\s*(annotation|member|modelPermission|tablePermission)\b/i,
                                );
                                if (isMetadata) {
                                    finalizePermission();
                                    i--; // Re-evaluate this line
                                    continue;
                                }
                            }

                            expressionLines.push(line);
                        }
                    }

                    finalizePermission();

                    if (currentRoleName) {
                        roles.push({
                            roleName: currentRoleName,
                            filePath,
                            line: roleLine,
                            tablePermissions,
                        });
                    }
                } catch (err) {
                    Logger.error(`Error reading/parsing role file ${filePath}: ${err}`);
                }
            }
        } catch (error) {
            Logger.error(`Error reading roles directory ${rolesDir}: ${error}`);
        }

        return roles;
    }
}
