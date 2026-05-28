export const NodeKinds = {
    Measure: 'measure',
    Column: 'column',
    Table: 'table',
    Relationship: 'relationship',
    Query: 'query',
    Role: 'role',
    CalculationGroup: 'calculationGroup',
    Page: 'page',
    Visual: 'visual',
} as const;

export type NodeKind = (typeof NodeKinds)[keyof typeof NodeKinds];

export const EdgeTypes = {
    DependsOn: 'dependsOn',
    VisualConsumes: 'visualConsumes',
    Lineage: 'lineage',
    SortByColumn: 'sortByColumn',
    VisualValue: 'visualValue',
    VisualCalculation: 'visualCalculation',
    VisualFilter: 'visualFilter',
    SecurityFilter: 'securityFilter',
    Relationship: 'RELATIONSHIP',
} as const;

export type EdgeType = (typeof EdgeTypes)[keyof typeof EdgeTypes];

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface SemanticEdge {
    readonly sourceId: string;
    readonly targetId: string;
    readonly type: EdgeType;
    readonly confidence: ConfidenceLevel;
}

export interface SourceLocation {
    readonly filePath: string;
    readonly line: number;
    readonly column?: number;
    readonly length?: number;
}

export interface CanonicalNode {
    readonly id: string;
    readonly semanticKey: string;
    readonly kind: NodeKind;
    readonly version: number;
    readonly qualifiedName: string;
    readonly name: string;
    readonly source: SourceLocation;
    readonly tags?: ReadonlyArray<string>;
    readonly description?: string;
    searchKey?: string;
}

// =========================================================================
// Specialized Node Subtypes
// =========================================================================

export interface TableNode extends CanonicalNode {
    readonly kind: typeof NodeKinds.Table;
}

export interface ColumnNode extends CanonicalNode {
    readonly kind: typeof NodeKinds.Column;
    readonly parentTableId: string;
    readonly isCalculated: boolean;
    readonly dataType: string;
    readonly sourceExpression?: string;
}

export interface MeasureNode extends CanonicalNode {
    readonly kind: typeof NodeKinds.Measure;
    readonly parentTableId: string;
    readonly expression: string;
    readonly displayFolder?: string;
}

export interface RelationshipNode extends CanonicalNode {
    readonly kind: typeof NodeKinds.Relationship;
    readonly fromColumnId: string;
    readonly toColumnId: string;
    readonly crossFilteringBehavior: 'Both' | 'Single' | 'Automatic';
}

export interface PageNode extends CanonicalNode {
    readonly kind: typeof NodeKinds.Page;
    readonly title: string;
}

export interface VisualNode extends CanonicalNode {
    readonly kind: typeof NodeKinds.Visual;
    readonly parentPageId: string;
    readonly visualType: string;
    readonly title: string;
    readonly hasExplicitName?: boolean;
}

export interface RoleNode extends CanonicalNode {
    readonly kind: typeof NodeKinds.Role;
}

// Union type representing any valid semantic entity in the model.
export type SemanticNode =
    | TableNode
    | ColumnNode
    | MeasureNode
    | RelationshipNode
    | PageNode
    | VisualNode
    | RoleNode;

    
export interface CanonicalSemanticModel {
    readonly nodes: ReadonlyArray<SemanticNode>;
    readonly edges: ReadonlyArray<SemanticEdge>;
}
