import { TmdlNodeExtractor } from '../src/core/extractors/TmdlNodeExtractor';
import { RelationshipParser } from '../src/core/extractors/RelationshipParser';
import { SemanticGraph } from '../src/core/graph/SemanticGraph';
import { NodeKinds, EdgeTypes } from '../src/core/models/CanonicalModel';
import { IFileSystem } from '../src/core/ports/IFileSystem';
import { PurgeEngine } from '../src/core/engine/PurgeEngine';
import { ILogger } from '../src/core/ports/ILogger';

describe('TMDL Extraction Improvements', () => {
    test('TmdlNodeExtractor parses triple-slash documentation comments and falls back to description property', () => {
        const extractor = new TmdlNodeExtractor();
        const tmdlContent = `
/// Este es un comentario de la tabla
table Ventas

    /// Comentario de la medida Costos
    measure 'Costos Filtro Ranking Desconectado' = SUM(Ventas[Monto])
        formatString: "$#,##0"
        description: "Propiedad description obsoleta"

    measure 'Sin Comentario Pero Con Propiedad' = 10
        description: "Esta es la descripcion de propiedad"
`;

        const nodes = extractor.extractNodes('Ventas.tmdl', tmdlContent);

        // 1. Table node description
        const tableNode = nodes.find(n => n.kind === NodeKinds.Table);
        expect(tableNode).toBeDefined();
        expect(tableNode!.description).toBe('Este es un comentario de la tabla');

        // 2. Measure with triple-slash comment AND property: comment should take precedence (or property is ignored as fallback)
        const measure1 = nodes.find(n => n.name === 'Costos Filtro Ranking Desconectado');
        expect(measure1).toBeDefined();
        expect(measure1!.description).toBe('Comentario de la medida Costos');

        // 3. Measure without comment but with property: property should be used as fallback
        const measure2 = nodes.find(n => n.name === 'Sin Comentario Pero Con Propiedad');
        expect(measure2).toBeDefined();
        expect(measure2!.description).toBe('Esta es la descripcion de propiedad');
    });

    test('RelationshipParser parses relationship.tmdl files and resolves edges in the SemanticGraph', async () => {
        // Setup a mock filesystem
        const mockFiles = new Map<string, string>();
        mockFiles.set('definition/relationships.tmdl', `
relationship AutoDetected_123
	crossFilteringBehavior: bothDirections
	fromColumn: fact_costos.ID_LABOR
	toColumn: dim_actividad.ID_LABOR
`);

        const mockFs: Partial<IFileSystem> = {
            pathExists: async (p) => true,
            isDirectory: async (p) => {
                // Return false for files ending with .tmdl
                return !p.endsWith('.tmdl');
            },
            readDirectory: async (p) => {
                if (p.endsWith('definition')) {
                    return ['relationships.tmdl'];
                }
                return ['definition'];
            },
            joinPaths: (...paths) => paths.join('/'),
            readFile: async (p) => {
                if (p.endsWith('relationships.tmdl')) {
                    return mockFiles.get('definition/relationships.tmdl') || '';
                }
                throw new Error('File not found');
            }
        };

        const graph = new SemanticGraph();

        // Register table/column nodes first so they can be resolved
        graph.beginTransaction();
        graph.upsertNode({
            id: 'table:fact_costos',
            semanticKey: 'table:fact_costos',
            kind: NodeKinds.Table,
            version: 1,
            qualifiedName: 'fact_costos',
            name: 'fact_costos',
            source: { filePath: 'fact_costos.tmdl', line: 1 }
        });
        graph.upsertNode({
            id: 'table:dim_actividad',
            semanticKey: 'table:dim_actividad',
            kind: NodeKinds.Table,
            version: 1,
            qualifiedName: 'dim_actividad',
            name: 'dim_actividad',
            source: { filePath: 'dim_actividad.tmdl', line: 1 }
        });
        graph.upsertNode({
            id: 'column:fact_costos.id_labor',
            semanticKey: 'column:fact_costos.id_labor',
            kind: NodeKinds.Column,
            version: 1,
            qualifiedName: 'fact_costos[ID_LABOR]',
            name: 'ID_LABOR',
            source: { filePath: 'fact_costos.tmdl', line: 2 },
            parentTableId: 'table:fact_costos'
        } as any);
        graph.upsertNode({
            id: 'column:dim_actividad.id_labor',
            semanticKey: 'column:dim_actividad.id_labor',
            kind: NodeKinds.Column,
            version: 1,
            qualifiedName: 'dim_actividad[ID_LABOR]',
            name: 'ID_LABOR',
            source: { filePath: 'dim_actividad.tmdl', line: 2 },
            parentTableId: 'table:dim_actividad'
        } as any);
        graph.commit();

        const parser = new RelationshipParser(mockFs as IFileSystem);
        await parser.parse('workspace-root', graph);

        // Verify that relationship nodes and edges exist
        const relationships = graph.getNodesByKind(NodeKinds.Relationship);
        expect(relationships.length).toBe(1);
        expect(relationships[0].id).toBe('relationship:column:fact_costos.id_labor-column:dim_actividad.id_labor');

        const fromEdges = graph.getForwardEdges('column:fact_costos.id_labor');
        expect(fromEdges.length).toBe(1);
        expect(fromEdges[0].targetId).toBe('column:dim_actividad.id_labor');
        expect(fromEdges[0].type).toBe(EdgeTypes.Relationship);

        const toEdges = graph.getForwardEdges('column:dim_actividad.id_labor');
        expect(toEdges.length).toBe(1);
        expect(toEdges[0].targetId).toBe('column:fact_costos.id_labor');
        expect(toEdges[0].type).toBe(EdgeTypes.Relationship);
    });

    test('PurgeEngine.deleteMeasure deletes measure along with its preceding triple-slash comments and trims blank lines correctly', async () => {
        let fileContent = `table _Measures
	lineageTag: 5ea4eefd-8d8f-4a3c-bace-838f8f7033f0

	/// Comentario de medida A
	/// en varias líneas
	measure 'Medida A' = SUM(Ventas[Monto])
		formatString: "$#,##0"

	/// Comentario de medida B
	measure 'Medida B' = 10
		description: "Propiedad obsoleta"

	measure 'Medida C' = 20
`;

        const mockFs: Partial<IFileSystem> = {
            readFile: async (p) => fileContent,
            writeFile: async (p, content) => {
                fileContent = content;
            }
        };

        const mockLogger: ILogger = {
            info: (msg: string) => {},
            warn: (msg: string) => {},
            error: (msg: string, err?: any) => {},
            perf: (msg: string, dur: number) => {}
        };

        const purgeEngine = new PurgeEngine(mockFs as IFileSystem, mockLogger);

        // 1. Purge 'Medida B'
        // Since B is in the middle, it has a trailing blank line (after the measure) that should be consumed.
        // It also has a preceding '///' comment.
        const nodeB = {
            name: 'Medida B',
            kind: 'measure',
            sourceFilePath: 'dummy.tmdl',
        } as any;

        const successB = await purgeEngine.deleteMeasure(nodeB);
        expect(successB).toBe(true);

        // The purged content should not contain Medida B or its comment, and should have exactly one blank line between Medida A and Medida C.
        expect(fileContent).not.toContain("measure 'Medida B'");
        expect(fileContent).not.toContain("Comentario de medida B");
        
        // Let's verify the exact structure remains clean:
        const expectedAfterB = `table _Measures
	lineageTag: 5ea4eefd-8d8f-4a3c-bace-838f8f7033f0

	/// Comentario de medida A
	/// en varias líneas
	measure 'Medida A' = SUM(Ventas[Monto])
		formatString: "$#,##0"

	measure 'Medida C' = 20
`;
        expect(fileContent.replace(/\r\n/g, '\n')).toBe(expectedAfterB.replace(/\r\n/g, '\n'));

        // 2. Purge 'Medida C' (at the end of the file, no trailing blank line but has leading blank line)
        const nodeC = {
            name: 'Medida C',
            kind: 'measure',
            sourceFilePath: 'dummy.tmdl',
        } as any;

        const successC = await purgeEngine.deleteMeasure(nodeC);
        expect(successC).toBe(true);
        expect(fileContent).not.toContain("measure 'Medida C'");

        const expectedAfterC = `table _Measures
	lineageTag: 5ea4eefd-8d8f-4a3c-bace-838f8f7033f0

	/// Comentario de medida A
	/// en varias líneas
	measure 'Medida A' = SUM(Ventas[Monto])
		formatString: "$#,##0"
`;
        expect(fileContent.replace(/\r\n/g, '\n')).toBe(expectedAfterC.replace(/\r\n/g, '\n'));
    });
});
