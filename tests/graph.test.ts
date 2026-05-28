import { SemanticGraph } from '../src/core/graph/SemanticGraph';
import {
    SemanticNode,
    SemanticEdge,
    NodeKinds,
    EdgeTypes,
} from '../src/core/models/CanonicalModel';

// Test utility functions
const createNode = (id: string): SemanticNode => ({
    id,
    semanticKey: `test:${id}`,
    kind: NodeKinds.Measure,
    version: 1,
    qualifiedName: `Table[${id}]`,
    name: id,
    source: { filePath: 'test.tmdl', line: 1 },
    parentTableId: 'table1',
    expression: '1',
});

const createEdge = (sourceId: string, targetId: string): SemanticEdge => ({
    sourceId,
    targetId,
    type: EdgeTypes.DependsOn,
    confidence: 'high',
});

describe('SemanticGraph Golden Models', () => {
    test('Commit and Rollback transactional isolation', () => {
        const graph = new SemanticGraph();

        // Rollback isolation test
        graph.beginTransaction();
        graph.upsertNode(createNode('A'));
        graph.upsertNode(createNode('B'));
        graph.rollback();

        expect(graph.getNode('A')).toBeUndefined();
        expect(graph.getNode('B')).toBeUndefined();

        // Commit isolation test
        graph.beginTransaction();
        graph.upsertNode(createNode('A'));
        graph.upsertNode(createNode('B'));
        graph.commit();

        expect(graph.getNode('A')).toBeDefined();
        expect(graph.getNode('B')).toBeDefined();
    });

    test('Integrity check blocks commit on dangling edges', () => {
        const graph = new SemanticGraph();

        graph.beginTransaction();
        graph.upsertNode(createNode('A'));

        // Target node B doesn't exist
        graph.addEdge(createEdge('A', 'B'));

        // Commit should fail throwing Integrity violation
        expect(() => graph.commit()).toThrow(/Integrity violation/);

        // Ensure original state is strictly intact (no Node A in state)
        expect(graph.getNode('A')).toBeUndefined();

        // Transaction should be automatically rolled back, allowing a new one immediately
        expect(() => graph.beginTransaction()).not.toThrow();
    });

    test('Cycle detection tolerates circular dependencies', () => {
        const graph = new SemanticGraph();

        graph.beginTransaction();
        graph.upsertNode(createNode('A'));
        graph.upsertNode(createNode('B'));
        graph.upsertNode(createNode('C'));

        graph.addEdge(createEdge('A', 'B'));
        graph.addEdge(createEdge('B', 'C'));

        // This creates a cycle: C -> A -> B -> C
        graph.addEdge(createEdge('C', 'A'));

        // Should commit successfully without collapsing
        expect(() => graph.commit()).not.toThrow();

        // Validation of cycle existence and path
        const cycles = graph.getCycles();
        expect(cycles.length).toBe(1);
        expect(cycles[0].length).toBe(3);

        const path = cycles[0].map((e) => `${e.sourceId}->${e.targetId}`).join(', ');
        expect(path).toContain('C->A');
        expect(path).toContain('A->B');
        expect(path).toContain('B->C');
    });

    test('Cascading purge on removeNode', () => {
        const graph = new SemanticGraph();

        // Setup robust initial state
        graph.beginTransaction();
        graph.upsertNode(createNode('A'));
        graph.upsertNode(createNode('B'));
        graph.upsertNode(createNode('C'));
        graph.addEdge(createEdge('A', 'B'));
        graph.addEdge(createEdge('B', 'C'));
        graph.commit();

        // New transaction to aggressively purge node B
        graph.beginTransaction();
        graph.removeNode('B');
        graph.commit();

        // Assert existence
        expect(graph.getNode('A')).toBeDefined();
        expect(graph.getNode('C')).toBeDefined();
        expect(graph.getNode('B')).toBeUndefined();

        // Assert cascading edge purges
        expect(graph.getForwardEdges('A').length).toBe(0); // A no longer points to B
        expect(graph.getReverseEdges('C').length).toBe(0); // C is no longer pointed by B
        expect(graph.getForwardEdges('B').length).toBe(0); // B doesn't exist
        expect(graph.getReverseEdges('B').length).toBe(0); // B doesn't exist
    });
});
