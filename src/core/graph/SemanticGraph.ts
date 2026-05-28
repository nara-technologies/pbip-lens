import { SemanticNode, SemanticEdge, NodeKinds } from '../models/CanonicalModel';

interface GraphState {
    nodeIndex: Map<string, SemanticNode>;
    qualifiedNameIndex: Map<string, SemanticNode>;
    measureNameIndex: Map<string, SemanticNode>;
    columnNameIndex: Map<string, SemanticNode>;
    kindIndex: Map<string, Set<SemanticNode>>;
    parentTableIndex: Map<string, Set<SemanticNode>>;
    forwardEdges: Map<string, Set<SemanticEdge>>;
    reverseEdges: Map<string, Set<SemanticEdge>>;
}

/**
 * Dependency Graph with Immutable Nodes and Edges,
 * and a Strict Transaction System.
 */
export class SemanticGraph {
    private state: GraphState;
    private draftState: GraphState | null = null;

    /** Stores detected cycles, allowing tolerance for circular dependencies (e.g., DAX) */
    private cycles: SemanticEdge[][] = [];

    constructor() {
        this.state = this.createEmptyState();
    }

    private createEmptyState(): GraphState {
        return {
            nodeIndex: new Map(),
            qualifiedNameIndex: new Map(),
            measureNameIndex: new Map(),
            columnNameIndex: new Map(),
            kindIndex: new Map(),
            parentTableIndex: new Map(),
            forwardEdges: new Map(),
            reverseEdges: new Map(),
        };
    }

    private cloneState(original: GraphState): GraphState {
        const cloned: GraphState = {
            nodeIndex: new Map(original.nodeIndex),
            qualifiedNameIndex: new Map(original.qualifiedNameIndex),
            measureNameIndex: new Map(original.measureNameIndex),
            columnNameIndex: new Map(original.columnNameIndex),
            kindIndex: new Map(),
            parentTableIndex: new Map(),
            forwardEdges: new Map(),
            reverseEdges: new Map(),
        };
        for (const [k, v] of original.kindIndex.entries()) {
            cloned.kindIndex.set(k, new Set(v));
        }
        for (const [k, v] of original.parentTableIndex.entries()) {
            cloned.parentTableIndex.set(k, new Set(v));
        }
        for (const [k, v] of original.forwardEdges.entries()) {
            cloned.forwardEdges.set(k, new Set(v));
        }
        for (const [k, v] of original.reverseEdges.entries()) {
            cloned.reverseEdges.set(k, new Set(v));
        }
        return cloned;
    }

    // =========================================================================
    // Transactional Subsystem
    // =========================================================================

    public beginTransaction(): void {
        if (this.draftState) {
            throw new Error('A transaction is already in progress.');
        }
        this.draftState = this.cloneState(this.state);
    }

    public commit(): void {
        if (!this.draftState) {
            throw new Error('No transaction in progress to commit.');
        }

        try {
            // Perform static referential integrity checks before committing.
            this.validateIntegrity(this.draftState);
        } catch (error) {
            this.rollback();
            throw error;
        }

        this.state = this.draftState;
        this.draftState = null;
    }

    public rollback(): void {
        if (!this.draftState) {
            throw new Error('No transaction in progress to rollback.');
        }
        this.draftState = null;
    }

    private validateIntegrity(draft: GraphState): void {
        // Assert that all visual/semantic edges only reference registered node IDs.
        for (const edges of draft.forwardEdges.values()) {
            for (const edge of edges) {
                if (!draft.nodeIndex.has(edge.targetId) || !draft.nodeIndex.has(edge.sourceId)) {
                    throw new Error(
                        `Integrity violation: Edge references missing node. Source: ${edge.sourceId}, Target: ${edge.targetId}`,
                    );
                }
            }
        }

        for (const edges of draft.reverseEdges.values()) {
            for (const edge of edges) {
                if (!draft.nodeIndex.has(edge.targetId) || !draft.nodeIndex.has(edge.sourceId)) {
                    throw new Error(
                        `Integrity violation: Edge references missing node. Source: ${edge.sourceId}, Target: ${edge.targetId}`,
                    );
                }
            }
        }
    }

    // =========================================================================
    // Mutation Methods (State modifications should only target draftState)
    // =========================================================================

    private normalizeName(name: string): string {
        return name.replace(/'/g, '').toLowerCase();
    }

    private addIndices(node: SemanticNode, draft: GraphState): void {
        // Pre-compute search values to optimize case-insensitive lookups under dense query loops.
        node.searchKey = (node.name + ' ' + node.qualifiedName).toLowerCase();

        const normQualified = this.normalizeName(node.qualifiedName);
        draft.qualifiedNameIndex.set(normQualified, node);

        const normBase = this.normalizeName(node.name);
        if (node.kind === NodeKinds.Measure) {
            draft.measureNameIndex.set(normBase, node);
        } else if (node.kind === NodeKinds.Column) {
            draft.columnNameIndex.set(normBase, node);
        }

        if (!draft.kindIndex.has(node.kind)) {
            draft.kindIndex.set(node.kind, new Set());
        }
        draft.kindIndex.get(node.kind)!.add(node);

        if ('parentTableId' in node && typeof (node as any).parentTableId === 'string') {
            const tableId = (node as any).parentTableId;
            if (!draft.parentTableIndex.has(tableId)) {
                draft.parentTableIndex.set(tableId, new Set());
            }
            draft.parentTableIndex.get(tableId)!.add(node);
        }
    }

    private removeIndices(node: SemanticNode, draft: GraphState): void {
        const normQualified = this.normalizeName(node.qualifiedName);
        draft.qualifiedNameIndex.delete(normQualified);

        const normBase = this.normalizeName(node.name);
        if (node.kind === NodeKinds.Measure) {
            draft.measureNameIndex.delete(normBase);
        } else if (node.kind === NodeKinds.Column) {
            draft.columnNameIndex.delete(normBase);
        }

        const kindSet = draft.kindIndex.get(node.kind);
        if (kindSet) {
            kindSet.delete(node);
            if (kindSet.size === 0) {
                draft.kindIndex.delete(node.kind);
            }
        }

        if ('parentTableId' in node && typeof (node as any).parentTableId === 'string') {
            const tableId = (node as any).parentTableId;
            const childSet = draft.parentTableIndex.get(tableId);
            if (childSet) {
                childSet.delete(node);
                if (childSet.size === 0) {
                    draft.parentTableIndex.delete(tableId);
                }
            }
        }
    }

    public upsertNode(node: SemanticNode): void {
        if (!this.draftState) {
            throw new Error('upsertNode must be called within a transaction.');
        }

        const existingNode = this.draftState.nodeIndex.get(node.id);
        if (existingNode) {
            this.removeIndices(existingNode, this.draftState);
        }

        this.draftState.nodeIndex.set(node.id, node);
        this.addIndices(node, this.draftState);

        if (!this.draftState.forwardEdges.has(node.id)) {
            this.draftState.forwardEdges.set(node.id, new Set());
        }
        if (!this.draftState.reverseEdges.has(node.id)) {
            this.draftState.reverseEdges.set(node.id, new Set());
        }
    }

    public removeNode(nodeId: string): void {
        if (!this.draftState) {
            throw new Error('removeNode must be called within a transaction.');
        }

        const node = this.draftState.nodeIndex.get(nodeId);
        if (node) {
            this.removeIndices(node, this.draftState);
        }
        this.draftState.nodeIndex.delete(nodeId);

        // Cascade delete associated reverse edges.
        const deps = this.draftState.forwardEdges.get(nodeId) || new Set();
        for (const edge of deps) {
            const revEdges = this.draftState.reverseEdges.get(edge.targetId);
            if (revEdges) {
                for (const rEdge of revEdges) {
                    if (rEdge.sourceId === nodeId) revEdges.delete(rEdge);
                }
            }
        }
        this.draftState.forwardEdges.delete(nodeId);

        // Cascade delete associated forward edges.
        const usedBy = this.draftState.reverseEdges.get(nodeId) || new Set();
        for (const edge of usedBy) {
            const fwdEdges = this.draftState.forwardEdges.get(edge.sourceId);
            if (fwdEdges) {
                for (const fEdge of fwdEdges) {
                    if (fEdge.targetId === nodeId) fwdEdges.delete(fEdge);
                }
            }
        }
        this.draftState.reverseEdges.delete(nodeId);
    }

    public addEdge(edge: SemanticEdge): void {
        if (!this.draftState) {
            throw new Error('addEdge must be called within a transaction.');
        }

        const fwdEdges = this.draftState.forwardEdges.get(edge.sourceId);
        if (fwdEdges) {
            fwdEdges.add(edge);
        }

        const revEdges = this.draftState.reverseEdges.get(edge.targetId);
        if (revEdges) {
            revEdges.add(edge);
        }

        this.detectAndStoreCycles(edge, this.draftState);
    }

    // =========================================================================
    // Cycle Detection Routine (Permissive cycle ingestion for DAX dependency tolerance)
    // =========================================================================

    private detectAndStoreCycles(newEdge: SemanticEdge, draft: GraphState): void {
        const visited = new Set<string>();
        const path: SemanticEdge[] = [];

        const dfs = (currentNodeId: string): boolean => {
            if (currentNodeId === newEdge.sourceId) {
                // Cycle path confirmed.
                this.cycles.push([newEdge, ...path]);
                return true;
            }

            if (visited.has(currentNodeId)) {
                return false;
            }

            visited.add(currentNodeId);

            const edges = draft.forwardEdges.get(currentNodeId);
            if (edges) {
                for (const edge of edges) {
                    path.push(edge);
                    if (dfs(edge.targetId)) {
                        return true;
                    }
                    path.pop();
                }
            }
            return false;
        };

        dfs(newEdge.targetId);
    }

    // =========================================================================
    // Read-only Queries
    // =========================================================================

    public getNode(nodeId: string): SemanticNode | undefined {
        return this.state.nodeIndex.get(nodeId);
    }

    public getNodeByQualifiedName(normalizedName: string): SemanticNode | undefined {
        return this.state.qualifiedNameIndex.get(normalizedName);
    }

    public getNodesByKind(kind: string): SemanticNode[] {
        return Array.from(this.state.kindIndex.get(kind) || []);
    }

    public getChildrenByTable(tableId: string): SemanticNode[] {
        return Array.from(this.state.parentTableIndex.get(tableId) || []);
    }

    public getMeasureByName(normalizedName: string): SemanticNode | undefined {
        return this.state.measureNameIndex.get(normalizedName);
    }

    public getColumnByName(normalizedName: string): SemanticNode | undefined {
        return this.state.columnNameIndex.get(normalizedName);
    }

    public getForwardEdges(nodeId: string): SemanticEdge[] {
        return Array.from(this.state.forwardEdges.get(nodeId) || []);
    }

    public getReverseEdges(nodeId: string): SemanticEdge[] {
        return Array.from(this.state.reverseEdges.get(nodeId) || []);
    }

    public getCycles(): SemanticEdge[][] {
        return this.cycles;
    }

    public getAllNodes(): SemanticNode[] {
        return Array.from(this.state.nodeIndex.values());
    }
}
