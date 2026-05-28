import { IFileSystem } from '../ports/IFileSystem';
import { ILogger } from '../ports/ILogger';
import { SemanticEngine } from '../engine/SemanticEngine';
import { SemanticGraph } from '../graph/SemanticGraph';
import { PendingReferenceRegistry } from '../graph/PendingReferenceRegistry';
import { PbipProjectReader } from '../extractors/PbipProjectReader';
import { TmdlNodeExtractor } from '../extractors/TmdlNodeExtractor';
import { DaxLexer } from '../analyzer/Lexer';
import { StructuralParser } from '../analyzer/StructuralParser';
import { ResolutionBinder } from '../analyzer/ResolutionBinder';
import { ReportParser } from '../extractors/reportParser';
import { SecurityParser } from '../extractors/securityParser';
import { ExtractionPhase } from '../pipeline/ExtractionPhase';
import { AnalysisPhase } from '../pipeline/AnalysisPhase';
import { ResolutionPhase } from '../pipeline/ResolutionPhase';

export class EngineFactory {
    public static createSemanticEngine(fs: IFileSystem, logger: ILogger): SemanticEngine {
        const projectReader = new PbipProjectReader(fs);
        const nodeExtractor = new TmdlNodeExtractor();
        const lexer = new DaxLexer();
        const parser = new StructuralParser();
        const graph = new SemanticGraph();
        const registry = new PendingReferenceRegistry();
        const reportParser = new ReportParser(fs);
        const securityParser = new SecurityParser(fs);

        const extractionPhase = new ExtractionPhase(
            projectReader,
            nodeExtractor,
            reportParser,
            securityParser,
            logger
        );

        const analysisPhase = new AnalysisPhase(
            lexer,
            parser,
            logger
        );

        const binder = new ResolutionBinder(graph, registry);
        const resolutionPhase = new ResolutionPhase(
            binder,
            logger
        );

        const phases = [extractionPhase, analysisPhase, resolutionPhase];

        return new SemanticEngine(
            phases,
            logger,
            graph,
            registry,
            fs
        );
    }
}
