import { SemanticGraph } from '../graph/SemanticGraph';
import { PendingReferenceRegistry } from '../graph/PendingReferenceRegistry';
import { IFileSystem } from '../ports/IFileSystem';

export class ProcessingContext {
    public tmdlExpressions: { nodeId: string; expression: string }[] = [];
    public visualReferences: Map<string, any[]> = new Map();
    public securityPermissions: { roleId: string; tableName: string; daxExpression: string; filePath: string; line: number }[] = [];
    public files: Map<string, string> = new Map();

    constructor(
        public readonly rootPath: string,
        public readonly graph: SemanticGraph,
        public readonly registry: PendingReferenceRegistry,
        public readonly fs?: IFileSystem
    ) {}
}
