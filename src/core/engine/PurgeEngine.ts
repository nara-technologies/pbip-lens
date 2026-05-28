import { SemanticNodeDetailDTO } from './GraphQueries';
import { IFileSystem } from '../ports/IFileSystem';
import { ILogger } from '../ports/ILogger';

export class PurgeEngine {
    constructor(private fs: IFileSystem, private logger: ILogger) {}

    public async deleteMeasure(node: SemanticNodeDetailDTO): Promise<boolean> {
        this.logger.info(`Starting measure purge (Native I/O): ${node.name}`);
        const filePath: string = (node as any).sourceFilePath;
        if (!filePath) {
            this.logger.error('Could not determine the TMDL file path for this measure.');
            return false;
        }

        try {
            const text = await this.fs.readFile(filePath);
            const rangeData = this.findMeasureRangeFromText(text, node.name);

            if (!rangeData) {
                this.logger.error(
                    `Measure declaration "${node.name}" was not found in the TMDL file.`,
                );
                return false;
            }

            const lines = text.split(/\r?\n/);

            // Prepend preceding triple-slash documentation lines
            let finalStartLine = rangeData.startLine;
            while (finalStartLine > 0 && /^\s*\/\/\/.*$/.test(lines[finalStartLine - 1])) {
                finalStartLine--;
            }

            // Consume a blank line gap (prefer trailing, fallback to leading if at EOF)
            let finalEndLine = rangeData.endLine;
            if (finalEndLine + 1 < lines.length && lines[finalEndLine + 1].trim() === '') {
                finalEndLine++;
            } else if (finalStartLine > 0 && lines[finalStartLine - 1].trim() === '') {
                finalStartLine--;
            }

            lines.splice(finalStartLine, finalEndLine - finalStartLine + 1);

            await this.fs.writeFile(filePath, lines.join('\n'));
            this.logger.info(`Physical mutation on disk completed for: ${node.name}`);
            return true;
        } catch (error) {
            this.logger.error(`Error purging: ${error}`);
            return false;
        }
    }

    private findMeasureRangeFromText(
        text: string,
        measureName: string,
    ): { startLine: number; startChar: number; endLine: number } | null {
        const lines = text.split(/\r?\n/);
        const lineCount = lines.length;
        const escapedName = this.escapeRegex(measureName);

        const declarationRegex = new RegExp(
            `^\\s+measure\\s+(?:'${escapedName}'|${escapedName})\\s*=`,
            'i',
        );
        const newObjectRegex = /^\s+(measure|column|partition|hierarchy|annotation)\s+/i;
        const topLevelRegex = /^(table|relationship|perspective|role|expression)\s+/i;

        let startLine = -1;
        let startChar = 0;

        for (let i = 0; i < lineCount; i++) {
            if (declarationRegex.test(lines[i])) {
                startLine = i;
                startChar = lines[i].search(/\S/);
                break;
            }
        }

        if (startLine === -1) {
            return null;
        }

        let endLine = startLine;

        for (let i = startLine + 1; i < lineCount; i++) {
            const trimmed = lines[i].trim();

            if (topLevelRegex.test(trimmed)) {
                endLine = this.trimBlankLinesFromText(lines, startLine, i - 1);
                break;
            }
            if (newObjectRegex.test(lines[i])) {
                endLine = this.trimBlankLinesFromText(lines, startLine, i - 1);
                break;
            }
            if (i === lineCount - 1) {
                endLine = this.trimBlankLinesFromText(lines, startLine, i);
                break;
            }
            endLine = i;
        }

        return { startLine, startChar, endLine };
    }

    private trimBlankLinesFromText(lines: string[], startLine: number, endLine: number): number {
        let trimmed = endLine;
        while (trimmed > startLine && lines[trimmed].trim() === '') {
            trimmed--;
        }
        return trimmed;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
