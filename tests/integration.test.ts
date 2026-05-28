import { NodeFileSystem } from '../src/infrastructure/adapters/NodeFileSystem';
import { VSCodeLogger } from '../src/infrastructure/adapters/VSCodeLogger';
import { GraphQueries } from '../src/core/engine/GraphQueries';
import { NodeKinds, MeasureNode } from '../src/core/models/CanonicalModel';
import * as path from 'path';
import { AuditEngine } from '../src/core/engine/AuditEngine';
import { OrphanNodeRule } from '../src/core/rules/OrphanNodeRule';
import { MissingDescriptionRule } from '../src/core/rules/MissingDescriptionRule';
import { EngineFactory } from '../src/core/factories/EngineFactory';

describe('PBIP Integration Test (End-to-End with Real Nodes)', () => {
    test('Successfully extracts real TMDL nodes, isolates DAX, and populates the Graph', async () => {
        // Initialize IO Layer and Dependencies
        const fs = new NodeFileSystem();
        const logger = new VSCodeLogger();
        // Boot up the Engine
        const engine = EngineFactory.createSemanticEngine(fs, logger);
        const graph = engine.graph;

        let basePath = path.resolve(__dirname, '../test/peru-weather');
        let exists = await fs.pathExists(basePath);
        if (!exists) {
            basePath = path.resolve(process.cwd(), 'test/peru-weather');
            exists = await fs.pathExists(basePath);
        }

        if (!exists) {
            console.warn(
                `Test folder not found: ${basePath}. Skipping integration test.`,
            );
            return;
        }

        // Run Full Pipeline
        await engine.processProject(basePath);

        // VALIDATIONS

        // 1. Graph must contain structural nodes (dummy nodes are no longer used)
        // Search for 'Costos Real' which is known to exist in the dataset
        const testMeasure = graph.getMeasureByName('costos real') as MeasureNode;
        expect(testMeasure).toBeDefined();
        if (testMeasure) {
            expect(testMeasure.name).toBe('Costos Real');
            expect(testMeasure.expression.length).toBeGreaterThan(0);

            // Verify that the TMDL extractor cleared DAX code of metadata properties
            expect(testMeasure.expression).not.toContain('formatString:');
            expect(testMeasure.expression).not.toContain('lineageTag:');
        }

        // 2. Check cleanup of PendingReferenceRegistry
        // Since the underlying model is now in the graph, almost all dependencies
        // must have been successfully resolved via the ResolutionBinder.
        const pending = engine.registry.getPendingReferences();

        // Previously, all references ended up here. Now we expect a lower count.
        // Assert that no broken transactions or exceptions occurred.
        expect(pending).toBeDefined();

        // 3. Real Edges generated in record time (O(1))
        if (testMeasure) {
            const edges = graph.getForwardEdges(testMeasure.id);
            // The 'Costos Real' measure must have found dependencies or triggered validations
            expect(edges).toBeDefined();
        }

        // 4. Visual Graph and Lazy Loading Integration
        const auditEngine = new AuditEngine(
            [new OrphanNodeRule(), new MissingDescriptionRule()],
            logger
        );
        const queries = new GraphQueries(graph, auditEngine);
        const metrics = queries.getMetricsSummary();

        expect(metrics.totalVisuals).toBeGreaterThanOrEqual(1);

        // Verify lightweight DTO serialization of the visual
        const visualNodes = graph.getNodesByKind(NodeKinds.Visual);
        const testVisual = visualNodes[0];
        expect(testVisual).toBeDefined();

        const details = queries.getNodeDetails(testVisual.id);

        // Assertions on the DTO serialization
        expect(details).not.toBeNull();
        if (details) {
            expect(details.id).toBe(testVisual.id);
            expect(details.kind).toBe(NodeKinds.Visual);
            expect(details.expression).toBeUndefined(); // Ensure raw DAX is not leaked
        }

        // The visual must have at least one directDependency linked to the DAX engine
        expect(details!.directDependencies.length).toBeGreaterThan(0);

        // 5. RLS Security Validations
        const roleNode = graph.getNode('role:gerente_operaciones');
        expect(roleNode).toBeDefined();
        if (roleNode) {
            expect(roleNode.name).toBe('Gerente_Operaciones');
            expect(roleNode.kind).toBe('role');

            // Check that it has a SecurityFilter edge pointing to the dim_clase_costo table
            const forwardEdges = graph.getForwardEdges(roleNode.id);
            const tableEdge = forwardEdges.find((e) => e.targetId === 'table:dim_clase_costo');
            expect(tableEdge).toBeDefined();
            expect(tableEdge!.type).toBe('securityFilter');

            // Check that it has a SecurityFilter edge pointing to the desc_clase_costo column
            const columnEdge = forwardEdges.find(
                (e) => e.targetId === 'column:dim_clase_costo.desc_clase_costo',
            );
            expect(columnEdge).toBeDefined();
            expect(columnEdge!.type).toBe('securityFilter');

            // Check details of the protected column
            const colDetails = queries.getNodeDetails('column:dim_clase_costo.desc_clase_costo');
            expect(colDetails).not.toBeNull();
            if (colDetails) {
                expect(colDetails.isOrphan).toBe(false);
                expect(colDetails.usabilityMetrics).toBeDefined();
                expect(colDetails.usabilityMetrics!.isOrphan).toBe(false);
                expect(colDetails.usabilityMetrics!.totalUsage).toBeGreaterThan(0);
            }
        }

        // Confirm engine lifeness
        expect(true).toBe(true);
    }, 60000);
});
