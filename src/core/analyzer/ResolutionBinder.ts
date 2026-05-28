import { SemanticGraph } from '../graph/SemanticGraph';
import { PendingReferenceRegistry } from '../graph/PendingReferenceRegistry';
import { ExternalReference } from './StructuralParser';
import { EdgeTypes } from '../models/CanonicalModel';

export class ResolutionBinder {
    constructor(
        private graph: SemanticGraph,
        private registry: PendingReferenceRegistry,
    ) {}

    public bindReferences(sourceNodeId: string, references: ExternalReference[]): void {
        this.graph.beginTransaction();

        for (const ref of references) {
            const isQualified = ref.value.includes('[');
            const isBracketOnly =
                ref.value.startsWith('[') &&
                ref.value.endsWith(']') &&
                ref.value.indexOf('[') === ref.value.lastIndexOf('[');

            const resolvedEdgeType = (ref.edgeType as any) || EdgeTypes.DependsOn;

            if (!isBracketOnly && isQualified) {
                const normalizedRef = this.normalizeQualified(ref.value);
                const targetNode = this.graph.getNodeByQualifiedName(normalizedRef);

                if (targetNode) {
                    this.graph.addEdge({
                        sourceId: sourceNodeId,
                        targetId: targetNode.id,
                        type: resolvedEdgeType,
                        confidence: 'high',
                    });
                } else {
                    this.registry.register({
                        sourceNodeId,
                        unresolvedSemanticKey: ref.value,
                        location: { filePath: '', line: ref.line, column: ref.column },
                    });
                }
            } else if (isBracketOnly) {
                const rawName = this.stripBrackets(ref.value).toLowerCase();

                // 1. Resolve identifier against Measure namespace (O(1) lookup)
                const measureNode = this.graph.getMeasureByName(rawName);
                if (measureNode) {
                    this.graph.addEdge({
                        sourceId: sourceNodeId,
                        targetId: measureNode.id,
                        type: resolvedEdgeType,
                        confidence: 'high', // Reference to standalone measure is direct and reliable
                    });
                    continue;
                }

                // 2. Resolve identifier against Column namespace (O(1) lookup)
                const columnNode = this.graph.getColumnByName(rawName);
                if (columnNode) {
                    this.graph.addEdge({
                        sourceId: sourceNodeId,
                        targetId: columnNode.id,
                        type: resolvedEdgeType,
                        confidence: 'medium', // High ambiguity risk if another table declares an identical column name
                    });
                    continue;
                }

                // 3. Fallback path for unresolved references
                this.registry.register({
                    sourceNodeId,
                    unresolvedSemanticKey: ref.value,
                    location: { filePath: '', line: ref.line, column: ref.column },
                });
            } else {
                // Handle pure standalone identifiers (e.g. TableName references)
                const normalizedRef = this.normalizeQualified(ref.value);
                const targetNode = this.graph.getNodeByQualifiedName(normalizedRef);

                if (targetNode && targetNode.kind === 'table') {
                    this.graph.addEdge({
                        sourceId: sourceNodeId,
                        targetId: targetNode.id,
                        type: resolvedEdgeType,
                        confidence: 'high',
                    });
                } else {
                    this.registry.register({
                        sourceNodeId,
                        unresolvedSemanticKey: ref.value,
                        location: { filePath: '', line: ref.line, column: ref.column },
                    });
                }
            }
        }

        // Commit edge transaction, triggering static referential integrity checks
        this.graph.commit();
    }

    /**
     * Normalizes qualified names (e.g. 'Table'[Column])
     * by stripping single quotes and converting to lowercase for case-insensitive matches.
     */
    private normalizeQualified(name: string): string {
        return name.replace(/'/g, '').toLowerCase();
    }

    /**
     * Strips square brackets from standalone identifier values (e.g. [Measure] -> Measure).
     */
    private stripBrackets(name: string): string {
        return name.replace(/^\[/, '').replace(/\]$/, '');
    }
}
