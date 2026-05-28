import { SourceLocation } from '../models/CanonicalModel';

/**
 * Deferred reference representation for symbols referenced in expressions
 * before their target declarations have been parsed or ingested into the graph.
 */
export interface PendingReference {
    readonly sourceNodeId: string;
    readonly unresolvedSemanticKey: string;
    readonly location: SourceLocation;
}

/**
 * Registry for deferred symbolic references.
 * Resolves order-of-definition constraints during file ingestion.
 * Collects dangling identifiers (e.g. forward references in DAX expressions)
 * to resolve them into semantic graph edges after all model files have been fully indexed.
 */
export class PendingReferenceRegistry {
    private pending: PendingReference[] = [];

    public register(reference: PendingReference): void {
        this.pending.push(reference);
    }

    public getPendingReferences(): ReadonlyArray<PendingReference> {
        return this.pending;
    }

    public clear(): void {
        this.pending = [];
    }

    /**
     * Resolves pending symbol references against the compiled semantic key map.
     * Produces concrete dependency connections and retains unresolved references.
     */
    public resolvePendingReferences(semanticKeyToIdMap: Map<string, string>): {
        resolved: { source: string; target: string }[];
        unresolved: PendingReference[];
    } {
        const resolved: { source: string; target: string }[] = [];
        const unresolved: PendingReference[] = [];

        for (const ref of this.pending) {
            const targetId = semanticKeyToIdMap.get(ref.unresolvedSemanticKey.toLowerCase());
            if (targetId) {
                resolved.push({
                    source: ref.sourceNodeId,
                    target: targetId,
                });
            } else {
                unresolved.push(ref);
            }
        }

        // Retain unresolved reference paths for subsequent resolution passes or warning generation.
        this.pending = unresolved;

        return { resolved, unresolved };
    }
}
