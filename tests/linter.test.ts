import { ConfigManager } from '../src/core/config/ConfigManager';
import { AuditEngine } from '../src/core/engine/AuditEngine';
import { SemanticGraph } from '../src/core/graph/SemanticGraph';
import { IFileSystem } from '../src/core/ports/IFileSystem';
import { ILogger } from '../src/core/ports/ILogger';
import { IAuditRule, RuleViolation } from '../src/core/ports/IAuditRule';
import { CanonicalNode, NodeKinds, SemanticNode } from '../src/core/models/CanonicalModel';

// Mock File System
class MockFileSystem implements IFileSystem {
    public files = new Map<string, string>();

    public async pathExists(path: string): Promise<boolean> {
        return this.files.has(path);
    }
    public async readFile(path: string): Promise<string> {
        const content = this.files.get(path);
        if (content === undefined) {
            throw new Error(`File not found: ${path}`);
        }
        return content;
    }
    public async readDirectory(): Promise<string[]> {
        return [];
    }
    public joinPaths(...paths: string[]): string {
        return paths.join('/').replace(/\/+/g, '/');
    }
    public getDirname(path: string): string {
        return path;
    }
    public getBasename(path: string): string {
        return path.split('/').pop() || '';
    }
    public async isDirectory(): Promise<boolean> {
        return false;
    }
    public async writeFile(path: string, content: string): Promise<void> {
        this.files.set(path, content);
    }
}

// Mock Logger
class MockLogger implements ILogger {
    public info(): void {}
    public warn(): void {}
    public error(): void {}
    public perf(): void {}
}

// Dummy Rule for testing
class DummyRule implements IAuditRule {
    public readonly id = 'dummy-rule';
    public readonly name = 'Dummy Rule';
    public readonly defaultSeverity = 'High';

    public evaluate(node: CanonicalNode): RuleViolation | null {
        return {
            ruleId: this.id,
            message: `Violation on ${node.name}`,
            severity: this.defaultSeverity,
        };
    }
}

describe('Linter Configuration and Audit Engine Integration', () => {
    let fs: MockFileSystem;
    let logger: MockLogger;

    beforeEach(() => {
        fs = new MockFileSystem();
        logger = new MockLogger();
    });

    describe('ConfigManager', () => {
        test('loads default config when file does not exist', async () => {
            const manager = new ConfigManager(fs);
            const config = await manager.loadConfig('/project');

            expect(config).toBeDefined();
            expect(config.rules['orphan-node']).toBe('error');
            expect(config.rules['missing-description']).toBe('error');
            expect(config.ignore).toEqual([]);
        });

        test('loads custom config when .pbiplensrc.json exists', async () => {
            fs.files.set('/project/.pbiplensrc.json', JSON.stringify({
                rules: {
                    'orphan-node': 'warn',
                    'missing-description': 'off'
                },
                ignore: ['*Temp*']
            }));

            const manager = new ConfigManager(fs);
            const config = await manager.loadConfig('/project');

            expect(config.rules['orphan-node']).toBe('warn');
            expect(config.rules['missing-description']).toBe('off');
            expect(config.ignore).toEqual(['*Temp*']);
        });

        test('falls back gracefully on invalid JSON', async () => {
            fs.files.set('/project/.pbiplensrc.json', '{ invalid json');

            const manager = new ConfigManager(fs);
            const config = await manager.loadConfig('/project');

            expect(config.rules['orphan-node']).toBe('error');
        });
    });

    describe('AuditEngine with Config', () => {
        let graph: SemanticGraph;
        const dummyNode = (id: string, name: string, filePath: string): SemanticNode => ({
            id,
            name,
            qualifiedName: `Table[${name}]`,
            kind: NodeKinds.Measure,
            version: 1,
            source: { filePath, line: 1 },
            semanticKey: `measure:${id}`,
            parentTableId: 'table1',
            expression: '1'
        });

        beforeEach(() => {
            graph = new SemanticGraph();
            graph.beginTransaction();
            graph.upsertNode(dummyNode('node1', 'SalesRevenue', 'src/Sales.tmdl'));
            graph.upsertNode(dummyNode('node2', 'TempMeasure', 'src/Temp.tmdl'));
            graph.upsertNode(dummyNode('node3', 'IgnoredByPath', 'src/ignored/file.tmdl'));
            graph.commit();
        });

        test('respects rule severity "off"', () => {
            const config = {
                rules: { 'dummy-rule': 'off' as const },
                ignore: []
            };
            const engine = new AuditEngine([new DummyRule()], logger, config);
            const report = engine.analyze(graph);

            expect(report.size).toBe(0);
        });

        test('maps rule violation level based on config', () => {
            const config = {
                rules: { 'dummy-rule': 'warn' as const },
                ignore: []
            };
            const engine = new AuditEngine([new DummyRule()], logger, config);
            const report = engine.analyze(graph);

            expect(report.size).toBe(3);
            const violations = report.get('node1')!;
            expect(violations).toBeDefined();
            expect(violations[0].level).toBe('warn');
            expect(violations[0].ruleId).toBe('dummy-rule');
        });

        test('ignores nodes matching name patterns', () => {
            const config = {
                rules: { 'dummy-rule': 'error' as const },
                ignore: ['TempMeasure']
            };
            const engine = new AuditEngine([new DummyRule()], logger, config);
            const report = engine.analyze(graph);

            expect(report.has('node2')).toBe(false); // Ignored by exact name
            expect(report.has('node1')).toBe(true);
        });

        test('ignores nodes matching wildcard glob patterns', () => {
            const config = {
                rules: { 'dummy-rule': 'error' as const },
                ignore: ['*Temp*']
            };
            const engine = new AuditEngine([new DummyRule()], logger, config);
            const report = engine.analyze(graph);

            expect(report.has('node2')).toBe(false); // Ignored by wildcard
            expect(report.has('node1')).toBe(true);
        });

        test('ignores nodes matching file path patterns', () => {
            const config = {
                rules: { 'dummy-rule': 'error' as const },
                ignore: ['*/ignored/*']
            };
            const engine = new AuditEngine([new DummyRule()], logger, config);
            const report = engine.analyze(graph);

            expect(report.has('node3')).toBe(false); // Ignored by path pattern
            expect(report.has('node1')).toBe(true);
            expect(report.has('node2')).toBe(true);
        });
    });
});
