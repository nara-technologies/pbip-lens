import { IAuditRule, RuleViolation } from '../ports/IAuditRule';
import { CanonicalNode, NodeKinds } from '../models/CanonicalModel';
import { SemanticGraph } from '../graph/SemanticGraph';

export class MissingDescriptionRule implements IAuditRule {
    public readonly id = 'missing-description';
    public readonly name = 'Missing Description';
    public readonly defaultSeverity = 'Low';

    public evaluate(node: CanonicalNode, graph: SemanticGraph): RuleViolation | null {
        if (node.kind !== NodeKinds.Measure && node.kind !== NodeKinds.Table) {
            return null;
        }

        const desc = (node as any).description;
        if (!desc || desc.trim() === '') {
            return {
                ruleId: this.id,
                message: `Node ${node.qualifiedName} is missing a description.`,
                severity: this.defaultSeverity,
            };
        }

        return null;
    }
}
