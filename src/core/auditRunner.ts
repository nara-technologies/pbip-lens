import { AuditResult, PageAudit } from './models/AuditResult';
import { SemanticModel, MeasureDefinition, ColumnDefinition } from './models/SemanticModel';
import { WorkspaceScanner } from './io/workspaceScanner';
import { TMDLParser } from './parsers/tmdlParser';
import { ReportParser } from './parsers/reportParser';
import { DependencyGraph } from './graph/dependencyGraph';
import * as path from 'path';
import * as fs from 'fs';

export class PBIPAuditRunner {
    public static async run(): Promise<AuditResult | null> {
        const basePath = await WorkspaceScanner.getPBIPBasePath();
        if (!basePath) {
            return null;
        }

        const tmdlFiles = await WorkspaceScanner.getTMDLFiles(basePath);
        const semanticModel = TMDLParser.parse(tmdlFiles);
        DependencyGraph.linkDAXDependencies(semanticModel);

        const pagesFiles = await WorkspaceScanner.getReportPages(basePath);

        const projectMeasures = Object.values(semanticModel.measures);
        if (projectMeasures.length === 0) {
            return {
                semanticModel,
                pages: [],
                globalUsedMeasures: [],
                globalOrphanedMeasures: []
            };
        }

        const pages: PageAudit[] = [];
        const globalUsedMeasuresSet = new Set<string>();
        const globalUsedColumnsSet = new Set<string>();

        for (const pageFolder of pagesFiles) {
            // Read display name
            const pageIdStr = path.basename(path.dirname(pageFolder.pageJsonPath));
            let displayName = pageIdStr;
            try {
                const pjContent = fs.readFileSync(pageFolder.pageJsonPath, 'utf8');
                const pjData = JSON.parse(pjContent);
                if (pjData.displayName) { displayName = pjData.displayName; }
            } catch (e) {
                // Ignore
            }

            const pageRequiredMeasures = new Set<string>();
            const pageRequiredColumns = new Set<string>();

            for (const visualFile of pageFolder.visualJsonPaths) {
                const struct = ReportParser.parseVisualJSON(visualFile);
                struct.measures.forEach(m => pageRequiredMeasures.add(m));
                struct.columns.forEach(c => {
                    pageRequiredColumns.add(c);
                    const cKey = c.toLowerCase();
                    if (semanticModel.columns[cKey]) {
                        semanticModel.columns[cKey].usedInVisuals = true;
                    }
                });
            }

            const deps = DependencyGraph.computeVisualDependencies(
                semanticModel, 
                Array.from(pageRequiredMeasures), 
                Array.from(pageRequiredColumns)
            );

            const pageUsedMeasures: MeasureDefinition[] = [];
            const pageUsedColumns: ColumnDefinition[] = [];

            for (const m of deps.measures) {
                const dev = semanticModel.measures[m.toLowerCase()];
                if (dev) {
                    pageUsedMeasures.push(dev);
                    globalUsedMeasuresSet.add(dev.name);
                }
            }
            
            for (const c of deps.columns) {
                const dev = semanticModel.columns[c.toLowerCase()];
                if (dev) {
                    pageUsedColumns.push(dev);
                    globalUsedColumnsSet.add(dev.name);
                }
            }

            pages.push({
                id: pageIdStr,
                displayName: displayName,
                usedMeasures: pageUsedMeasures,
                usedColumns: pageUsedColumns
            });
        }

        const globalUsedMeasures: MeasureDefinition[] = [];
        const globalOrphanedMeasures: MeasureDefinition[] = [];

        for (const measure of projectMeasures) {
            if (globalUsedMeasuresSet.has(measure.name)) {
                globalUsedMeasures.push(measure);
            } else {
                globalOrphanedMeasures.push(measure);
            }
        }

        return {
            semanticModel,
            pages,
            globalUsedMeasures,
            globalOrphanedMeasures
        };
    }
}
