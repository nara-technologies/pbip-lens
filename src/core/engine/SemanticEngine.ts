import { SemanticGraph } from '../graph/SemanticGraph';
import { PendingReferenceRegistry } from '../graph/PendingReferenceRegistry';
import { IPipelinePhase } from '../pipeline/IPipelinePhase';
import { ProcessingContext } from '../pipeline/ProcessingContext';
import { ILogger } from '../ports/ILogger';
import { IFileSystem } from '../ports/IFileSystem';

export class SemanticEngine {
    constructor(
        private phases: IPipelinePhase[],
        private logger: ILogger,
        public readonly graph: SemanticGraph,
        public readonly registry = new PendingReferenceRegistry(),
        private fs?: IFileSystem,
    ) {}

    /**
     * Orchestrates the complete static analysis flow of the semantic model using a pipeline.
     * @param basePath The base path of the PBIP project
     */
    public async processProject(basePath: string): Promise<void> {
        const startTime = performance.now();
        this.logger.info(`Starting project pipeline processing: ${basePath}`);

        const context = new ProcessingContext(basePath, this.graph, this.registry, this.fs);

        for (const phase of this.phases) {
            await phase.execute(context);
        }

        const endTime = performance.now();
        this.logger.perf('Semantic graph constructed', endTime - startTime);
    }
}
