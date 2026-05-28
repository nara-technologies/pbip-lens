import { ReportParser } from '../src/core/extractors/reportParser';
import { IFileSystem } from '../src/core/ports/IFileSystem';
import { NodeKinds, PageNode, VisualNode } from '../src/core/models/CanonicalModel';
import * as path from 'path';

// Mock FileSystem to simulate the PBIR structure
class MockFileSystem implements IFileSystem {
    private files = new Map<string, string>();
    private dirs = new Map<string, string[]>();

    public addFile(filePath: string, content: string) {
        this.files.set(filePath.replace(/\\/g, '/'), content);
    }

    public addDirectory(dirPath: string, children: string[]) {
        this.dirs.set(dirPath.replace(/\\/g, '/'), children);
    }

    async readFile(filePath: string): Promise<string> {
        const content = this.files.get(filePath.replace(/\\/g, '/'));
        if (!content) throw new Error(`File not found: ${filePath}`);
        return content;
    }

    async readDirectory(dirPath: string): Promise<string[]> {
        return this.dirs.get(dirPath.replace(/\\/g, '/')) || [];
    }

    async isDirectory(targetPath: string): Promise<boolean> {
        return this.dirs.has(targetPath.replace(/\\/g, '/'));
    }

    async pathExists(targetPath: string): Promise<boolean> {
        const normalized = targetPath.replace(/\\/g, '/');
        return this.files.has(normalized) || this.dirs.has(normalized);
    }

    joinPaths(...paths: string[]): string {
        return paths.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
    }

    getDirname(filePath: string): string {
        return path.dirname(filePath.replace(/\\/g, '/')).replace(/\\/g, '/');
    }

    getBasename(filePath: string): string {
        return path.basename(filePath.replace(/\\/g, '/'));
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        this.files.set(filePath.replace(/\\/g, '/'), content);
    }
}


describe('ReportParser (PBIR & PBIP)', () => {
    test('Parses modern PBIR format from the pages folder', async () => {
        const fs = new MockFileSystem();

        // Simulate base directories
        fs.addDirectory('test-report/definition/pages', ['ReportSection1']);
        fs.addDirectory('test-report/definition/pages/ReportSection1', ['visuals']);
        fs.addDirectory('test-report/definition/pages/ReportSection1/visuals', ['Visual1']);
        fs.addDirectory('test-report/definition/pages/ReportSection1/visuals/Visual1', []);

        // Simulate basic page.json for modern format
        const mockPageJson = {
            name: 'ReportSection1',
            displayName: 'Sales Page',
        };

        // Simulate modern visual.json in the corresponding subfolder
        const mockVisualJson = {
            name: 'Visual1',
            visual: {
                visualType: 'barChart',
                queryState: {
                    projections: {
                        Values: [
                            {
                                queryRef: 'Ventas.Monto',
                            },
                        ],
                    },
                },
            },
        };

        fs.addFile(
            'test-report/definition/pages/ReportSection1/page.json',
            JSON.stringify(mockPageJson),
        );

        fs.addFile(
            'test-report/definition/pages/ReportSection1/visuals/Visual1/visual.json',
            JSON.stringify(mockVisualJson),
        );

        const parser = new ReportParser(fs);
        const result = await parser.parseReport('test-report');

        // Validate extracted nodes
        expect(result.nodes.length).toBe(2);

        const pageNode = result.nodes.find((n) => n.kind === NodeKinds.Page) as PageNode;
        expect(pageNode).toBeDefined();
        expect(pageNode.name).toBe('Sales Page');

        const visualNode = result.nodes.find((n) => n.kind === NodeKinds.Visual) as VisualNode;
        expect(visualNode).toBeDefined();
        expect(visualNode.visualType).toBe('barChart');
        expect(visualNode.parentPageId).toBe(pageNode.id);

        // Validate dependencies (queryRef)
        const refs = result.references.get(visualNode.id);
        expect(refs).toBeDefined();
        expect(refs!.length).toBe(1);
        expect(refs![0].value).toBe("'Ventas'[Monto]");
    });

    test('Parses legacy PBIP format from report.json', async () => {
        const fs = new MockFileSystem();

        const mockReportJson = {
            sections: [
                {
                    name: 'LegacySection',
                    displayName: 'Página Legacy',
                    visualContainers: [
                        {
                            config: JSON.stringify({
                                singleVisual: {
                                    visualType: 'pieChart',
                                    projections: {
                                        Values: [{ queryRef: 'Costos' }],
                                    },
                                },
                            }),
                        },
                    ],
                },
            ],
        };

        fs.addFile('test-report/definition/report.json', JSON.stringify(mockReportJson));

        const parser = new ReportParser(fs);
        const result = await parser.parseReport('test-report');

        expect(result.nodes.length).toBe(2);
        const visualNode = result.nodes.find((n) => n.kind === NodeKinds.Visual) as VisualNode;

        const refs = result.references.get(visualNode.id);
        expect(refs!.length).toBe(1);
        expect(refs![0].value).toBe('[Costos]');
    });

    test('Parsea Cálculos Visuales, Filtros y Ordenación en visual.json moderno', async () => {
        const fs = new MockFileSystem();

        fs.addDirectory('test-report/definition/pages', ['ReportSection1']);
        fs.addDirectory('test-report/definition/pages/ReportSection1', ['visuals']);
        fs.addDirectory('test-report/definition/pages/ReportSection1/visuals', ['Visual1']);
        fs.addDirectory('test-report/definition/pages/ReportSection1/visuals/Visual1', []);

        const mockPageJson = {
            name: 'ReportSection1',
            displayName: 'Página de Ventas',
        };

        const mockVisualJson = {
            name: 'Visual1',
            visual: {
                visualType: 'barChart',
                query: {
                    queryState: {
                        Values: {
                            projections: [
                                {
                                    field: {
                                        NativeVisualCalculation: {
                                            Expression: '[Costos Real v2] * 0.5',
                                        },
                                    },
                                },
                            ],
                        },
                    },
                    sortDefinition: {
                        sort: [
                            {
                                field: {
                                    Column: {
                                        Expression: {
                                            SourceRef: {
                                                Entity: 'SalesTable',
                                            },
                                        },
                                        Property: 'SaleDate',
                                    },
                                },
                            },
                        ],
                    },
                },
            },
            filterConfig: {
                filters: [
                    {
                        field: {
                            Measure: {
                                Expression: {
                                    SourceRef: {
                                        Entity: 'KpiTable',
                                    },
                                },
                                Property: 'KpiValue',
                            },
                        },
                    },
                ],
            },
        };

        fs.addFile(
            'test-report/definition/pages/ReportSection1/page.json',
            JSON.stringify(mockPageJson),
        );

        fs.addFile(
            'test-report/definition/pages/ReportSection1/visuals/Visual1/visual.json',
            JSON.stringify(mockVisualJson),
        );

        const parser = new ReportParser(fs);
        const result = await parser.parseReport('test-report');

        const visualNode = result.nodes.find((n) => n.kind === NodeKinds.Visual) as VisualNode;
        expect(visualNode).toBeDefined();

        const refs = result.references.get(visualNode.id);
        expect(refs).toBeDefined();

        const refValues = refs!.map((r) => r.value);
        expect(refValues).toContain('[Costos Real v2]');
        expect(refValues).toContain("'SalesTable'[SaleDate]");
        expect(refValues).toContain("'KpiTable'[KpiValue]");
    });

    test('Parsea Cálculos Visuales con Alias Mapping en reportParser', async () => {
        const fs = new MockFileSystem();

        fs.addDirectory('test-report/definition/pages', ['ReportSection1']);
        fs.addDirectory('test-report/definition/pages/ReportSection1', ['visuals']);
        fs.addDirectory('test-report/definition/pages/ReportSection1/visuals', ['Visual1']);
        fs.addDirectory('test-report/definition/pages/ReportSection1/visuals/Visual1', []);

        const mockPageJson = {
            name: 'ReportSection1',
            displayName: 'Página de Ventas',
        };

        const mockVisualJson = {
            name: 'Visual1',
            visual: {
                visualType: 'barChart',
                query: {
                    queryState: {
                        Values: {
                            projections: [
                                {
                                    field: {
                                        Measure: {
                                            Expression: {
                                                SourceRef: {
                                                    Entity: 'SalesTable',
                                                },
                                            },
                                            Property: 'Rank Valor Actividad',
                                        },
                                    },
                                    displayName: 'Costo US$',
                                },
                                {
                                    field: {
                                        NativeVisualCalculation: {
                                            Expression: '[Costo US$] * 0.5',
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        };

        fs.addFile(
            'test-report/definition/pages/ReportSection1/page.json',
            JSON.stringify(mockPageJson),
        );

        fs.addFile(
            'test-report/definition/pages/ReportSection1/visuals/Visual1/visual.json',
            JSON.stringify(mockVisualJson),
        );

        const parser = new ReportParser(fs);
        const result = await parser.parseReport('test-report');

        const visualNode = result.nodes.find((n) => n.kind === NodeKinds.Visual) as VisualNode;
        expect(visualNode).toBeDefined();

        const refs = result.references.get(visualNode.id);
        expect(refs).toBeDefined();

        const refValues = refs!.map((r) => r.value);
        // Must resolve to 'Rank Valor Actividad' instead of the alias 'Costo US$'
        expect(refValues).toContain('[Rank Valor Actividad]');
    });

    test('Extracts sortByColumn in TmdlNodeExtractor and creates the structural edge in SemanticEngine', async () => {
        const { TmdlNodeExtractor } = require('../src/core/extractors/TmdlNodeExtractor');
        const { SemanticGraph } = require('../src/core/graph/SemanticGraph');
        const { SemanticEngine } = require('../src/core/engine/SemanticEngine');
        const { DaxLexer } = require('../src/core/analyzer/Lexer');
        const { StructuralParser } = require('../src/core/analyzer/StructuralParser');
        const { ResolutionBinder } = require('../src/core/analyzer/ResolutionBinder');
        const { PendingReferenceRegistry } = require('../src/core/graph/PendingReferenceRegistry');
        const { ExtractionPhase } = require('../src/core/pipeline/ExtractionPhase');
        const { AnalysisPhase } = require('../src/core/pipeline/AnalysisPhase');
        const { ResolutionPhase } = require('../src/core/pipeline/ResolutionPhase');

        const extractor = new TmdlNodeExtractor();
        const tmdlContent = [
            'table MonthTable',
            '    column MonthName',
            '        dataType: string',
            '        sortByColumn: MonthNumber',
            '    column MonthNumber',
            '        dataType: int',
        ].join('\n');

        const nodes = extractor.extractNodes('MonthTable.tmdl', tmdlContent);

        // MonthName must have sortByColumn
        const monthNameNode = nodes.find((n: any) => n.name === 'MonthName');
        expect(monthNameNode).toBeDefined();
        expect((monthNameNode as any).sortByColumn).toBe('MonthNumber');

        // Test injection in Graph via SemanticEngine
        const graph = new SemanticGraph();
        const registry = new PendingReferenceRegistry();
        const binder = new ResolutionBinder(graph, registry);
        const lexer = new DaxLexer();
        const parser = new StructuralParser();

        // Mock ProjectReader
        const mockProjectReader = {
            loadSemanticModel: async () => new Map([['MonthTable.tmdl', tmdlContent]]),
        };
        // Mock ReportParser
        const mockReportParser = {
            parseReport: async () => ({ nodes: [], references: new Map() }),
        };
        // Mock SecurityParser
        const mockSecurityParser = {
            parseSecurityRoles: async () => [],
        };
        // Mock Logger
        const mockLogger = {
            info: () => {},
            error: () => {},
            warn: () => {},
            perf: () => {},
        };

        const extractionPhase = new ExtractionPhase(
            mockProjectReader as any,
            extractor,
            mockReportParser as any,
            mockSecurityParser as any,
            mockLogger as any
        );

        const analysisPhase = new AnalysisPhase(
            lexer,
            parser,
            mockLogger as any
        );

        const resolutionPhase = new ResolutionPhase(
            binder,
            mockLogger as any
        );

        const engine = new SemanticEngine(
            [extractionPhase, analysisPhase, resolutionPhase],
            mockLogger as any,
            graph,
            registry,
        );

        await engine.processProject('dummy-path');

        // The sortByColumn edge should exist in the Graph
        const sourceId = monthNameNode!.id;
        const targetId = `column:monthtable.monthnumber`;

        const edges = graph.getForwardEdges(sourceId);
        expect(edges.length).toBe(1);
        expect(edges[0].targetId).toBe(targetId);
        expect(edges[0].type).toBe('sortByColumn');
    });
});
