import { IPipelinePhase } from './IPipelinePhase';
import { ProcessingContext } from './ProcessingContext';
import { PbipProjectReader } from '../extractors/PbipProjectReader';
import { TmdlNodeExtractor } from '../extractors/TmdlNodeExtractor';
import { ReportParser } from '../extractors/reportParser';
import { SecurityParser } from '../extractors/securityParser';
import { EdgeTypes, NodeKinds, SemanticNode } from '../models/CanonicalModel';
import { ILogger } from '../ports/ILogger';
import { RelationshipParser } from '../extractors/RelationshipParser';

export class ExtractionPhase implements IPipelinePhase {
    constructor(
        private projectReader: PbipProjectReader,
        private nodeExtractor: TmdlNodeExtractor,
        private reportParser: ReportParser,
        private securityParser: SecurityParser,
        private logger: ILogger
    ) {}

    public async execute(context: ProcessingContext): Promise<void> {
        this.logger.info(`Starting ExtractionPhase for project: ${context.rootPath}`);

        // 1. Ingest raw project definitions (TMDL/BIM) from physical filesystem
        const files = await this.projectReader.loadSemanticModel(context.rootPath);
        context.files = files;

        // 2. Extract canonical semantic nodes and isolate raw DAX expressions
        let allNodes: SemanticNode[] = [];
        for (const [filePath, content] of files.entries()) {
            const extracted = this.nodeExtractor.extractNodes(filePath, content);
            allNodes = allNodes.concat(extracted);
        }

        // 3. Ingest nodes into the semantic graph (O(1) indexing)
        context.graph.beginTransaction();
        for (const node of allNodes) {
            context.graph.upsertNode(node);
        }
        context.graph.commit();

        // Ingest structural sortByColumn edges
        context.graph.beginTransaction();
        for (const node of allNodes) {
            if (node.kind === NodeKinds.Column && (node as any).sortByColumn) {
                const targetColumnName = (node as any).sortByColumn;
                const parentTableId = (node as any).parentTableId;
                if (parentTableId) {
                    const tableName = parentTableId.replace('table:', '');
                    const targetId = `column:${tableName}.${targetColumnName.toLowerCase()}`;
                    const targetNode = context.graph.getNode(targetId);
                    if (targetNode) {
                        context.graph.addEdge({
                            sourceId: node.id,
                            targetId: targetNode.id,
                            type: EdgeTypes.SortByColumn,
                            confidence: 'high',
                        });
                    }
                }
            }
        }
        context.graph.commit();

        // Collect TMDL expressions for analysis phase
        for (const node of allNodes) {
            if ((node.kind === NodeKinds.Measure || node.kind === NodeKinds.Column) && (node as any).expression) {
                context.tmdlExpressions.push({
                    nodeId: node.id,
                    expression: (node as any).expression,
                });
            }
        }

        // 4. Ingest Visual lineage definitions from report files
        const visualData = await this.reportParser.parseReport(context.rootPath);
        if (visualData.nodes.length > 0) {
            context.graph.beginTransaction();
            for (const node of visualData.nodes) {
                context.graph.upsertNode(node);
            }
            context.graph.commit();

            // Store visual references in context
            context.visualReferences = visualData.references;
        }

        // 5. Ingest Row-Level Security (RLS) definitions
        let semanticModelDir: string | undefined = undefined;
        for (const filePath of files.keys()) {
            const normalized = filePath.replace(/\\/g, '/');
            const idx = normalized.indexOf('/definition/');
            if (idx !== -1) {
                semanticModelDir = filePath.substring(0, idx);
                break;
            }
        }

        if (!semanticModelDir) {
            this.logger.error(`[FATAL RLS] semanticModelDir is undefined. Aborting security parsing.`);
            return;
        }

        const roles = await this.securityParser.parseSecurityRoles(context.rootPath, semanticModelDir);
        if (roles.length > 0) {
            context.graph.beginTransaction();
            for (const role of roles) {
                const roleNode: SemanticNode = {
                    id: `role:${role.roleName.toLowerCase()}`,
                    semanticKey: `role:${role.roleName.toLowerCase()}`,
                    kind: NodeKinds.Role,
                    version: 1,
                    name: role.roleName,
                    qualifiedName: role.roleName,
                    source: { filePath: role.filePath, line: role.line },
                };
                context.graph.upsertNode(roleNode);
            }
            context.graph.commit();

            for (const role of roles) {
                const roleId = `role:${role.roleName.toLowerCase()}`;
                for (const perm of role.tablePermissions) {
                    const tableId = `table:${perm.tableName.toLowerCase()}`;
                    const tableNode = context.graph.getNode(tableId);
                    if (tableNode) {
                        context.graph.beginTransaction();
                        context.graph.addEdge({
                            sourceId: roleId,
                            targetId: tableId,
                            type: EdgeTypes.SecurityFilter,
                            confidence: 'high',
                        });
                        context.graph.commit();
                    }

                    if (perm.daxExpression) {
                        context.securityPermissions.push({
                            roleId,
                            tableName: perm.tableName,
                            daxExpression: perm.daxExpression,
                            filePath: role.filePath,
                            line: role.line,
                        });
                    }
                }
            }
        }

        // 6. Ingest relationships if filesystem is available
        if (context.fs) {
            const relationshipParser = new RelationshipParser(context.fs);
            await relationshipParser.parse(context.rootPath, context.graph);
        }
    }
}
