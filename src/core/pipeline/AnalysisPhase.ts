import { IPipelinePhase } from './IPipelinePhase';
import { ProcessingContext } from './ProcessingContext';
import { DaxLexer } from '../analyzer/Lexer';
import { StructuralParser } from '../analyzer/StructuralParser';
import { EdgeTypes } from '../models/CanonicalModel';
import { ILogger } from '../ports/ILogger';

declare function setTimeout(callback: Function, ms?: number): any;

export class AnalysisPhase implements IPipelinePhase {
    constructor(
        private lexer: DaxLexer,
        private parser: StructuralParser,
        private logger: ILogger
    ) {}

    public async execute(context: ProcessingContext): Promise<void> {
        this.logger.info('Starting AnalysisPhase: tokenizing and parsing expressions...');

        // 1. Analyze TMDL expressions
        const CPU_CHUNK_SIZE = 100;
        for (let i = 0; i < context.tmdlExpressions.length; i += CPU_CHUNK_SIZE) {
            const chunk = context.tmdlExpressions.slice(i, i + CPU_CHUNK_SIZE);
            await new Promise<void>((resolve) => {
                setTimeout(() => {
                    for (const expr of chunk) {
                        const tokens = this.lexer.tokenize(expr.expression);
                        const externalReferences = this.parser.parse(tokens);
                        for (const ref of externalReferences) {
                            context.registry.register({
                                sourceNodeId: expr.nodeId,
                                unresolvedSemanticKey: ref.value,
                                location: { filePath: '', line: ref.line, column: ref.column },
                            });
                        }
                    }
                    resolve();
                }, 0);
            });
        }

        // 2. Register visual layout dependencies
        for (const [visualId, refs] of context.visualReferences.entries()) {
            for (const ref of refs) {
                context.registry.register({
                    sourceNodeId: visualId,
                    unresolvedSemanticKey: ref.value,
                    location: { filePath: '', line: ref.line, column: ref.column },
                    edgeType: ref.edgeType || EdgeTypes.VisualConsumes,
                } as any);
            }
        }

        // 3. Analyze security permission expressions (RLS)
        for (const perm of context.securityPermissions) {
            const tokens = this.lexer.tokenize(perm.daxExpression);
            const externalReferences = this.parser.parse(tokens);

            for (const ref of externalReferences) {
                const isBracketOnly =
                    ref.value.startsWith('[') &&
                    ref.value.endsWith(']') &&
                    ref.value.indexOf('[') === ref.value.lastIndexOf('[');

                if (isBracketOnly) {
                    const rawName = ref.value.substring(1, ref.value.length - 1).trim();

                    // Resolve against table-local column identifiers first
                    const localQualified = `'${perm.tableName}'[${rawName}]`;
                    const normLocalQualified = localQualified
                        .replace(/'/g, '')
                        .toLowerCase();

                    if (context.graph.getNodeByQualifiedName(normLocalQualified)) {
                        (ref as any).value = localQualified;
                    } else {
                        // Fallback to global measure namespace
                        const measureNode = context.graph.getMeasureByName(
                            rawName.toLowerCase(),
                        );
                        if (measureNode) {
                            (ref as any).value = measureNode.qualifiedName;
                        } else {
                            // Fallback to global column namespace
                            const columnNode = context.graph.getColumnByName(
                                rawName.toLowerCase(),
                            );
                            if (columnNode) {
                                (ref as any).value = columnNode.qualifiedName;
                            }
                        }
                    }
                }

                (ref as any).edgeType = EdgeTypes.SecurityFilter;
            }

            // Register RLS references in registry
            for (const ref of externalReferences) {
                context.registry.register({
                    sourceNodeId: perm.roleId,
                    unresolvedSemanticKey: ref.value,
                    location: { filePath: perm.filePath, line: ref.line, column: ref.column },
                    edgeType: EdgeTypes.SecurityFilter,
                } as any);
            }
        }
    }
}
