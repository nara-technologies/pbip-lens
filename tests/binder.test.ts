import { SemanticGraph } from '../src/core/graph/SemanticGraph';
import { PendingReferenceRegistry } from '../src/core/graph/PendingReferenceRegistry';
import { ResolutionBinder } from '../src/core/analyzer/ResolutionBinder';
import { SemanticNode, NodeKinds } from '../src/core/models/CanonicalModel';

describe('ResolutionBinder Golden Models', () => {
    let graph: SemanticGraph;
    let registry: PendingReferenceRegistry;
    let binder: ResolutionBinder;

    beforeEach(() => {
        graph = new SemanticGraph();
        registry = new PendingReferenceRegistry();
        binder = new ResolutionBinder(graph, registry);
    });

    /**
     * Convenience factory to bypass strict generic typing in pure unit tests.
     */
    const createDummyNode = (
        id: string,
        kind: string,
        name: string,
        qualifiedName: string,
    ): SemanticNode =>
        ({
            id,
            semanticKey: `test:${id}`,
            kind: kind as any,
            version: 1,
            qualifiedName,
            name,
            source: { filePath: 'test.tmdl', line: 1 },
            parentTableId: 'table1',
            expression: '1',
        }) as any;

    test('Resolución Directa y Asignación de Confianza (Confidence Model)', () => {
        // Setup base transactional state
        graph.beginTransaction();
        graph.upsertNode(createDummyNode('source_node', NodeKinds.Measure, 'Source', 'Source'));
        graph.upsertNode(createDummyNode('m1', NodeKinds.Measure, 'Ventas', 'Tabla[Ventas]'));
        graph.upsertNode(createDummyNode('c1', NodeKinds.Column, 'Region', 'Store[Region]'));
        graph.commit();

        // 3 references, combining Case A (qualified) and Case B (bracketed)
        const references = [
            { value: "'Store'[Region]", line: 1, column: 1 }, // Qualified (Case A)
            { value: '[Ventas]', line: 2, column: 1 }, // Measure Bracket (Case B)
            { value: '[Region]', line: 3, column: 1 }, // Naked Column Bracket (Case B)
        ];

        binder.bindReferences('source_node', references);

        const edges = graph.getForwardEdges('source_node');

        // We should have 3 outbound edges
        expect(edges.length).toBe(3);

        // 1. Case A: 'Store'[Region] should map to 'c1' with high confidence
        const storeRegionEdge = edges.find((e) => e.targetId === 'c1' && e.confidence === 'high');
        expect(storeRegionEdge).toBeDefined();

        // 2. Case B (Measure): [Ventas] should map to 'm1' with high confidence
        const ventasEdge = edges.find((e) => e.targetId === 'm1' && e.confidence === 'high');
        expect(ventasEdge).toBeDefined();

        // 3. Case B (Naked Column): [Region] should map to 'c1' with medium confidence
        const regionBracketEdge = edges.find(
            (e) => e.targetId === 'c1' && e.confidence === 'medium',
        );
        expect(regionBracketEdge).toBeDefined();

        // No dependencies should remain pending
        expect(registry.getPendingReferences().length).toBe(0);
    });

    test('Resolución Diferida inyecta referencias en el PendingReferenceRegistry', () => {
        // Base setup (Clean graph, only source node)
        graph.beginTransaction();
        graph.upsertNode(createDummyNode('source_node', NodeKinds.Measure, 'Source', 'Source'));
        graph.commit();

        const references = [{ value: '[MedidaFutura]', line: 1, column: 1 }];

        binder.bindReferences('source_node', references);

        // Binder commit should succeed, but edges should be 0
        const edges = graph.getForwardEdges('source_node');
        expect(edges.length).toBe(0);

        // Pending registry should have captured [MedidaFutura]
        const pending = registry.getPendingReferences();
        expect(pending.length).toBe(1);
        expect(pending[0].unresolvedSemanticKey).toBe('[MedidaFutura]');
        expect(pending[0].sourceNodeId).toBe('source_node');
    });
});
