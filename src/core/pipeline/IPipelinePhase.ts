import { ProcessingContext } from './ProcessingContext';

/**
 * Represents an isolated and independent phase within the static analysis pipeline of the semantic engine.
 * 
 * This contract enables the Pipeline Pattern, dividing monolithic processing into sequential and decoupled
 * stages (Extraction, Analysis, and Resolution). Each phase has a single responsibility and communicates
 * exclusively through the shared state in ProcessingContext.
 */
export interface IPipelinePhase {
    /**
     * Executes the logic corresponding to this pipeline phase.
     * 
     * Modifies the injected ProcessingContext according to the phase's responsibility:
     * - ExtractionPhase: Populates the graph with initial nodes and collects expressions.
     * - AnalysisPhase: Analyzes expressions and populates the pending reference registry.
     * - ResolutionPhase: Resolves pending references and generates final edges in the graph.
     * 
     * @param context The shared processing context that carries the state along the pipeline.
     * @returns A promise that resolves when the phase has completed its execution.
     */
    execute(context: ProcessingContext): Promise<void>;
}
