import { SemanticModel, MeasureDefinition, ColumnDefinition } from './SemanticModel';

export interface PageAudit {
    id: string; // The "name" property from page.json
    displayName: string; // The "displayName" property from page.json
    usedMeasures: MeasureDefinition[];
    usedColumns: ColumnDefinition[];
}

export interface AuditResult {
    semanticModel: SemanticModel;
    pages: PageAudit[];
    globalUsedMeasures: MeasureDefinition[];
    globalOrphanedMeasures: MeasureDefinition[];
}
