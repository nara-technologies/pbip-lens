import { IPipelinePhase } from './IPipelinePhase';
import { ProcessingContext } from './ProcessingContext';
import { ResolutionBinder } from '../analyzer/ResolutionBinder';
import { ILogger } from '../ports/ILogger';

export class ResolutionPhase implements IPipelinePhase {
    constructor(
        private binder: ResolutionBinder,
        private logger: ILogger
    ) {}

    public async execute(context: ProcessingContext): Promise<void> {
        this.logger.info('Starting ResolutionPhase: consolidating references and building graph edges...');

        const pending = context.registry.getPendingReferences();
        if (pending.length > 0) {
            context.registry.clear(); // Clear to prevent double processing

            // Group pending symbol references by their originating source node
            const grouped = new Map<string, any[]>();
            for (const ref of pending) {
                const arr = grouped.get(ref.sourceNodeId) || [];
                arr.push({
                    value: ref.unresolvedSemanticKey,
                    line: ref.location.line,
                    column: ref.location.column || 0,
                    edgeType: (ref as any).edgeType, // Preserve the specific edge type
                });
                grouped.set(ref.sourceNodeId, arr);
            }

            // Re-run reference resolution on grouped references
            for (const [sourceId, refs] of grouped.entries()) {
                this.binder.bindReferences(sourceId, refs);
            }
        }

        this.logger.info('ResolutionPhase completed.');
    }
}
