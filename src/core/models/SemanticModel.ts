export interface MeasureDefinition {
    name: string;
    tableName: string;
    filePath: string;
    displayFolder?: string;
    dependencies: string[]; // Usa a estas medidas
    usedBy: string[]; // Medidas que usan a esta medida
    content: string; // The raw DAX
}

export interface ColumnDefinition {
    name: string;
    tableName: string;
    dataType?: string;
    sourceColumn?: string;
    filePath?: string;
    displayFolder?: string;
    isCalculated: boolean;
    dependencies: string[]; // Si es calculada, qué otras columnas usa
    usedBy: string[]; // Medidas que dependen de esta columna
    content: string; // The raw DAX if calculated

    // Los 4 pilares invisibles de Power BI
    usedInVisuals: boolean;
    isUsedInMeasures: boolean;
    isSortByTarget: boolean;
    isRelationshipKey: boolean;
    isUsedInRLS: boolean;
    isUsedInCalculatedColumns: boolean;
}

export interface TableDefinition {
    name: string;
    measures: string[];
    columns: string[];
}

export interface RelationshipDefinition {
    name: string;
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    crossFilteringBehavior: string;
}

export interface QueryDefinition {
    name: string;
    group?: string;
    content: string; // Script en M (Power Query)
}

export interface SemanticModel {
    measures: { [name: string]: MeasureDefinition };
    columns: { [name: string]: ColumnDefinition };
    tables: { [name: string]: TableDefinition };
    relationships: RelationshipDefinition[];
    queries: QueryDefinition[];
}
