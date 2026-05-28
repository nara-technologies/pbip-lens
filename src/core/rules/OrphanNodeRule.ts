import { IAuditRule, RuleViolation } from '../ports/IAuditRule';
import { CanonicalNode, NodeKinds } from '../models/CanonicalModel';
import { SemanticGraph } from '../graph/SemanticGraph';

export class OrphanNodeRule implements IAuditRule {
    public readonly id = 'orphan-node';
    public readonly name = 'Orphan Node';
    public readonly defaultSeverity = 'High';

    public evaluate(node: CanonicalNode, graph: SemanticGraph): RuleViolation | null {
        if (node.kind !== NodeKinds.Measure && node.kind !== NodeKinds.Column) {
            return null;
        }

        const incoming = graph.getReverseEdges(node.id);
        const nonSelfIncoming = incoming.filter(edge => edge.sourceId !== node.id);

        if (nonSelfIncoming.length === 0) {
            return {
                ruleId: this.id,
                message: `Node ${node.qualifiedName} is orphan (no incoming dependencies).`,
                severity: this.defaultSeverity,
            };
        }

        return null;
    }
}
