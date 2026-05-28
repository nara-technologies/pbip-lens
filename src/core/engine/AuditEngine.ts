import { SemanticGraph } from '../graph/SemanticGraph';
import { NodeKinds } from '../models/CanonicalModel';
import { SemanticNodeDTO } from './GraphQueries';
import { IAuditRule, RuleViolation } from '../ports/IAuditRule';
import { ILogger } from '../ports/ILogger';

export class AuditEngine {
    constructor(
        private rules: IAuditRule[],
        private logger: ILogger
    ) {}

    public analyze(graph: SemanticGraph): Map<string, RuleViolation[]> {
        this.logger.info('Starting audit analysis...');
        const report = new Map<string, RuleViolation[]>();
        const nodes = graph.getAllNodes();

        for (const node of nodes) {
            const violations: RuleViolation[] = [];
            for (const rule of this.rules) {
                try {
                    const violation = rule.evaluate(node, graph);
                    if (violation) {
                        violations.push(violation);
                    }
                } catch (error) {
                    this.logger.error(`Error evaluating rule "${rule.name}" on node "${node.qualifiedName}": ${error}`);
                }
            }
            if (violations.length > 0) {
                report.set(node.id, violations);
            }
        }

        this.logger.info(`Audit analysis completed. Violations found in ${report.size} nodes.`);
        return report;
    }

    public detectOrphans(graph: SemanticGraph): SemanticNodeDTO[] {
        const orphans: SemanticNodeDTO[] = [];
        const report = this.analyze(graph);

        for (const [nodeId, violations] of report.entries()) {
            if (violations.some(v => v.ruleId === 'orphan-node')) {
                const node = graph.getNode(nodeId);
                if (node) {
                    orphans.push({
                        id: node.id,
                        kind: node.kind,
                        name: node.name,
                        qualifiedName: node.qualifiedName,
                    });
                }
            }
        }
        return orphans;
    }

    public getActiveMeasures(graph: SemanticGraph): SemanticNodeDTO[] {
        const active: SemanticNodeDTO[] = [];
        const report = this.analyze(graph);

        const measures = graph.getNodesByKind(NodeKinds.Measure);
        for (const node of measures) {
            const violations = report.get(node.id) || [];
            if (!violations.some(v => v.ruleId === 'orphan-node')) {
                active.push({
                    id: node.id,
                    kind: node.kind,
                    name: node.name,
                    qualifiedName: node.qualifiedName,
                });
            }
        }

        const columns = graph.getNodesByKind(NodeKinds.Column);
        for (const node of columns) {
            const violations = report.get(node.id) || [];
            if (!violations.some(v => v.ruleId === 'orphan-node')) {
                active.push({
                    id: node.id,
                    kind: node.kind,
                    name: node.name,
                    qualifiedName: node.qualifiedName,
                });
            }
        }

        return active;
    }

    public isNodeOrphan(graph: SemanticGraph, nodeId: string): boolean {
        const report = this.analyze(graph);
        const violations = report.get(nodeId) || [];
        return violations.some(v => v.ruleId === 'orphan-node');
    }
}
