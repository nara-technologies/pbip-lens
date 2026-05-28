import { SemanticGraph } from '../graph/SemanticGraph';
import { NodeKinds, EdgeTypes, RelationshipNode, ColumnNode } from '../models/CanonicalModel';
import { AuditEngine } from './AuditEngine';

export interface SemanticNodeDTO {
    id: string;
    kind: string;
    name: string;
    qualifiedName: string;
}

export type ImpactLevel = 'None' | 'Low' | 'Medium' | 'High';

export interface NodeImpactBreakdown {
    measures: number;
    columns: number;
    visuals: number;
    roles: number;
}

export interface NodeImpact {
    level: ImpactLevel;
    breakdown: NodeImpactBreakdown;
}

export interface RelationshipDesc {
    direction: string;
    crossFilteringBehavior: string;
}

export interface UsabilityMetrics {
    coreDaxUsage: number;
    structuralUsage: number;
    presentationUsage: number;
    totalUsage: number;
    isOrphan: boolean;
}

export interface SemanticNodeDetailDTO {
    id: string;
    name: string;
    kind: string;
    qualifiedName: string;
    expression?: string;
    formatString?: string;
    displayFolder?: string;
    parentTableId?: string;
    parentTableName?: string;
    /** Absolute path to the .tmdl file containing this node. Required by PurgeEngine. */
    sourceFilePath?: string;
    isOrphan: boolean;
    usageContexts: string[];
    relationships: RelationshipDesc[];
    directDependencies: { sourceId: string; targetId: string; type: string; targetName?: string }[];
    usedBy: {
        sourceId: string;
        targetId: string;
        type: string;
        sourceName?: string;
        hasExplicitName?: boolean;
    }[];
    incomingEdges: {
        sourceId: string;
        targetId: string;
        edgeType: string;
        sourceName?: string;
        hasExplicitName?: boolean;
    }[];
    usabilityMetrics?: UsabilityMetrics;
    description?: string;
    columnRelationships?: {
        fromTable: string;
        fromCol: string;
        toTable: string;
        toCol: string;
        direction: string;
    }[];
}

export interface SemanticEdgeDTO {
    sourceId: string;
    targetId: string;
    type: string;
}

import { RuleViolation } from '../ports/IAuditRule';

export interface GraphMetricsSummary {
    totalMeasures: number;
    totalColumns: number;
    totalVisuals: number;
    totalTables: number;
    totalOrphans: number;
    totalOrphanMeasures: number;
    totalOrphanColumns: number;
    healthScore: number;
}

export interface NodeLineageDTO {
    node: SemanticNodeDTO | null;
    directDependencies: SemanticEdgeDTO[];
    usedBy: SemanticEdgeDTO[];
    relatedNodes: Record<string, SemanticNodeDTO>;
}

export class GraphQueries {
    /** Cache of the last audit analysis to avoid recalculations in successive requests within the same context. */
    private auditCache: Map<string, RuleViolation[]> | null = null;

    constructor(private graph: SemanticGraph, private auditEngine: AuditEngine) {}

    /** Invalidates the audit cache. Should be called when the semantic graph is modified. */
    public invalidateAuditCache(): void {
        this.auditCache = null;
    }

    /**
     * Calculates the impact level of a node by counting incoming edges grouped by consumer type.
     * A node used in RLS roles or with multiple dependencies is considered high impact.
     *
      * Level scale:
      * - None:   0 incoming dependencies.
      * - Low:    1-2 incoming dependencies.
      * - Medium: 3-5 incoming dependencies.
      * - High:   >5 or any use in a security role (RLS).
      *
      * @param nodeId Identifier of the node to evaluate.
      * @returns NodeImpact object with level and breakdown by category.
      */
    public getNodeImpact(nodeId: string): NodeImpact {
        const reverseEdges = this.graph.getReverseEdges(nodeId);

        const breakdown: NodeImpactBreakdown = { measures: 0, columns: 0, visuals: 0, roles: 0 };
        for (const edge of reverseEdges) {
            const src = this.graph.getNode(edge.sourceId);
            if (!src) continue;
            if (src.kind === NodeKinds.Measure) breakdown.measures++;
            else if (src.kind === NodeKinds.Column) breakdown.columns++;
            else if (src.kind === NodeKinds.Visual) breakdown.visuals++;
            else if (src.kind === NodeKinds.Role || edge.type.toLowerCase() === 'securityfilter') breakdown.roles++;
        }

        const total = breakdown.measures + breakdown.columns + breakdown.visuals + breakdown.roles;
        let level: ImpactLevel;
        if (total === 0) {
            level = 'None';
        } else if (breakdown.roles > 0 || total > 5) {
            level = 'High';
        } else if (total >= 3) {
            level = 'Medium';
        } else {
            level = 'Low';
        }

        return { level, breakdown };
    }

    /**
     * Executes the AuditEngine on the graph and returns the specific violations of a node.
     * Uses an internal cache per instance lifecycle to avoid redundant analysis.
     *
     * @param nodeId Identifier of the node to audit.
     * @returns Array of RuleViolation for that node, or an empty array if there are no violations.
     */
    public getNodeViolations(nodeId: string): RuleViolation[] {
        if (!this.auditCache) {
            this.auditCache = this.auditEngine.analyze(this.graph);
        }
        return this.auditCache.get(nodeId) ?? [];
    }

    /**
     * Returns summary metrics of the graph in constant time.
     */
    public getMetricsSummary(): GraphMetricsSummary {
        const totalMeasures = this.graph.getNodesByKind(NodeKinds.Measure).length;
        const totalColumns = this.graph.getNodesByKind(NodeKinds.Column).length;
        const totalVisuals = this.graph.getNodesByKind(NodeKinds.Visual).length;
        const totalTables = this.graph.getNodesByKind(NodeKinds.Table).length;
        
        const orphans = this.auditEngine.detectOrphans(this.graph);
        const totalOrphanMeasures = orphans.filter(o => o.kind === NodeKinds.Measure).length;
        const totalOrphanColumns = orphans.filter(o => o.kind === NodeKinds.Column).length;
        const totalOrphans = orphans.length;

        // Health score computes the structural integrity ratio: 100 - % of orphan measures.
        let healthScore = 100;
        if (totalMeasures > 0) {
            healthScore = 100 - Math.round((totalOrphanMeasures / totalMeasures) * 100);
            if (healthScore < 0) healthScore = 0; // Clamp value to prevent negative score under pathological datasets.
        }

        return {
            totalMeasures,
            totalColumns,
            totalVisuals,
            totalTables,
            totalOrphans,
            totalOrphanMeasures,
            totalOrphanColumns,
            healthScore,
        };
    }

    public getNodeDetails(nodeId: string): SemanticNodeDetailDTO | null {
        const node = this.graph.getNode(nodeId);
        if (!node) return null;

        const forwardEdges = this.graph.getForwardEdges(nodeId).map((e) => {
            const targetNode = this.graph.getNode(e.targetId);
            return {
                sourceId: e.sourceId,
                targetId: e.targetId,
                type: e.type,
                targetName: targetNode ? targetNode.name : e.targetId,
            };
        });

        const reverseEdgesRaw = this.graph.getReverseEdges(nodeId);
        const reverseEdges = reverseEdgesRaw.map((e) => {
            const sourceNode = this.graph.getNode(e.sourceId);
            return {
                sourceId: e.sourceId,
                targetId: e.targetId,
                type: e.type,
                sourceName: sourceNode ? sourceNode.name : e.sourceId,
                hasExplicitName:
                    sourceNode && sourceNode.kind === 'visual'
                        ? (sourceNode as any).hasExplicitName
                        : undefined,
            };
        });

        const incomingEdges = reverseEdgesRaw.map((e) => {
            const sourceNode = this.graph.getNode(e.sourceId);
            let edgeType: string = e.type;
            if (edgeType === 'visualValue') edgeType = 'VisualValue';
            else if (edgeType === 'visualCalculation') edgeType = 'VisualCalculation';
            else if (edgeType === 'visualFilter') edgeType = 'VisualFilter';

            return {
                sourceId: e.sourceId,
                targetId: e.targetId,
                edgeType: edgeType,
                sourceName: sourceNode ? sourceNode.name : e.sourceId,
                hasExplicitName:
                    sourceNode && sourceNode.kind === 'visual'
                        ? (sourceNode as any).hasExplicitName
                        : undefined,
            };
        });

        const usageContextsSet = new Set<string>();
        for (const edge of reverseEdgesRaw) {
            const srcNode = this.graph.getNode(edge.sourceId);
            if (srcNode) {
                usageContextsSet.add(srcNode.kind);
            }
        }

        let parentTableName: string | undefined = undefined;
        let parentTableId: string | undefined = undefined;
        let displayFolder: string | undefined = undefined;
        let expression: string | undefined = undefined;
        let formatString: string | undefined = undefined;

        if ('parentTableId' in node && typeof (node as any).parentTableId === 'string') {
            const tableId = (node as any).parentTableId;
            parentTableId = tableId;
            const tableNode = this.graph.getNode(tableId);
            if (tableNode) {
                parentTableName = tableNode.name;
            }
        }

        if ('displayFolder' in node) displayFolder = (node as any).displayFolder as string;
        if ('expression' in node) expression = (node as any).expression as string;
        else if ('sourceExpression' in node) expression = (node as any).sourceExpression as string;
        if ('formatString' in node) formatString = (node as any).formatString as string;

        const relationships: RelationshipDesc[] = [];
        if (node.kind === NodeKinds.Column) {
            const relNodes = this.graph.getNodesByKind(NodeKinds.Relationship) as any[];
            for (const rel of relNodes) {
                if (rel.fromColumnId === nodeId) {
                    relationships.push({
                        direction: 'from',
                        crossFilteringBehavior: rel.crossFilteringBehavior,
                    });
                } else if (rel.toColumnId === nodeId) {
                    relationships.push({
                        direction: 'to',
                        crossFilteringBehavior: rel.crossFilteringBehavior,
                    });
                }
            }
        }

        let coreDaxUsage = 0;
        let structuralUsage = 0;
        let presentationUsage = 0;

        for (const edge of reverseEdgesRaw) {
            const srcNode = this.graph.getNode(edge.sourceId);
            if (srcNode) {
                if (edge.type === 'sortByColumn') {
                    structuralUsage++;
                } else if (edge.type.toLowerCase() === 'securityfilter') {
                    structuralUsage++;
                } else if (
                    srcNode.kind === NodeKinds.Measure ||
                    srcNode.kind === NodeKinds.Column
                ) {
                    coreDaxUsage++;
                } else if (srcNode.kind === NodeKinds.Visual) {
                    presentationUsage++;
                } else {
                    structuralUsage++;
                }
            }
        }

        const hasSecurityFilter = reverseEdgesRaw.some(
            (e) => e.type.toLowerCase() === 'securityfilter',
        );
        const isOrphan =
            !hasSecurityFilter &&
            this.auditEngine.isNodeOrphan(this.graph, nodeId) &&
            !(structuralUsage > 0 || presentationUsage > 0);

        const usabilityMetrics: UsabilityMetrics = {
            coreDaxUsage,
            structuralUsage,
            presentationUsage,
            totalUsage: coreDaxUsage + structuralUsage + presentationUsage,
            isOrphan,
        };

        let columnRelationships: { fromTable: string; fromCol: string; toTable: string; toCol: string; direction: string }[] | undefined = undefined;
        if (node.kind === NodeKinds.Column) {
            columnRelationships = this.getColumnRelationships(node.id);
        }

        return {
            id: node.id,
            name: node.name,
            kind: node.kind,
            qualifiedName: node.qualifiedName,
            expression,
            formatString,
            displayFolder,
            parentTableId,
            parentTableName,
            sourceFilePath: node.source?.filePath,
            isOrphan,
            usageContexts: Array.from(usageContextsSet),
            relationships,
            directDependencies: forwardEdges,
            usedBy: reverseEdges,
            incomingEdges: incomingEdges,
            usabilityMetrics,
            description: node.description,
            columnRelationships,
        };
    }

    public getColumnRelationships(columnId: string): {
        fromTable: string;
        fromCol: string;
        toTable: string;
        toCol: string;
        direction: string;
    }[] {
        const edges = this.graph.getForwardEdges(columnId).filter(
            (e) => e.type === EdgeTypes.Relationship
        );

        const results: {
            fromTable: string;
            fromCol: string;
            toTable: string;
            toCol: string;
            direction: string;
        }[] = [];

        const relNodes = this.graph.getNodesByKind(NodeKinds.Relationship) as RelationshipNode[];

        for (const edge of edges) {
            const rel = relNodes.find(
                (r) =>
                    (r.fromColumnId === edge.sourceId && r.toColumnId === edge.targetId) ||
                    (r.fromColumnId === edge.targetId && r.toColumnId === edge.sourceId)
            );

            if (rel) {
                const fromColNode = this.graph.getNode(rel.fromColumnId) as ColumnNode | undefined;
                const toColNode = this.graph.getNode(rel.toColumnId) as ColumnNode | undefined;

                if (fromColNode && toColNode) {
                    const fromTableNode = this.graph.getNode(fromColNode.parentTableId);
                    const toTableNode = this.graph.getNode(toColNode.parentTableId);

                    results.push({
                        fromTable: fromTableNode ? fromTableNode.name : '',
                        fromCol: fromColNode.name,
                        toTable: toTableNode ? toTableNode.name : '',
                        toCol: toColNode.name,
                        direction: rel.crossFilteringBehavior,
                    });
                }
            }
        }
        return results;
    }

    public searchNodes(query: string, limit: number = 20): SemanticNodeDTO[] {
        const lowerQuery = query.toLowerCase();
        const results: SemanticNodeDTO[] = [];
        const searchKinds = [
            NodeKinds.Measure,
            NodeKinds.Column,
            NodeKinds.Table,
            NodeKinds.Visual,
            NodeKinds.Page,
        ];

        for (const kind of searchKinds) {
            if (results.length >= limit) {
                break;
            }

            const nodes = this.graph.getNodesByKind(kind);
            for (const node of nodes) {
                if (results.length >= limit) {
                    break;
                }

                if (node.searchKey && node.searchKey.includes(lowerQuery)) {
                    results.push({
                        id: node.id,
                        kind: node.kind,
                        name: node.name,
                        qualifiedName: node.qualifiedName,
                    });
                }
            }
        }

        return results;
    }

    public getOrphans(): SemanticNodeDTO[] {
        return this.auditEngine.detectOrphans(this.graph);
    }

    public getActiveMeasures(): SemanticNodeDTO[] {
        return this.auditEngine.getActiveMeasures(this.graph);
    }
}
