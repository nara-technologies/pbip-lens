import { SemanticGraph } from '../graph/SemanticGraph';
import { NodeKinds, CanonicalNode } from '../models/CanonicalModel';
import { SemanticNodeDTO } from './GraphQueries';
import { IAuditRule, RuleViolation } from '../ports/IAuditRule';
import { ILogger } from '../ports/ILogger';
import { LinterConfig } from '../config/ConfigManager';

export interface LinterViolation extends RuleViolation {
    level: 'error' | 'warn';
}

export type LinterResult = Map<string, LinterViolation[]>;

export class AuditEngine {
    private config?: LinterConfig;

    constructor(
        private rules: IAuditRule[],
        private logger: ILogger,
        config?: LinterConfig
    ) {
        if (config) {
            this.config = config;
        }
    }

    /**
     * Sets or updates the configuration dynamically.
     */
    public setConfig(config: LinterConfig): void {
        this.config = config;
    }

    public analyze(graph: SemanticGraph): LinterResult {
        this.logger.info('Starting audit analysis...');
        const report = new Map<string, LinterViolation[]>();
        const nodes = graph.getAllNodes();

        for (const node of nodes) {
            if (this.shouldIgnoreNode(node)) {
                continue;
            }

            const violations: LinterViolation[] = [];
            for (const rule of this.rules) {
                const severitySetting = this.getRuleSeveritySetting(rule.id);
                if (severitySetting === 'off') {
                    continue;
                }

                try {
                    const violation = rule.evaluate(node, graph);
                    if (violation) {
                        violations.push({
                            ...violation,
                            level: severitySetting,
                        });
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

    private getRuleSeveritySetting(ruleId: string): 'error' | 'warn' | 'off' {
        if (this.config && this.config.rules && ruleId in this.config.rules) {
            return this.config.rules[ruleId];
        }
        return 'error'; // Default is strict
    }

    private shouldIgnoreNode(node: CanonicalNode): boolean {
        if (!this.config || !this.config.ignore || this.config.ignore.length === 0) {
            return false;
        }

        const nodeName = node.name;
        const qualifiedName = node.qualifiedName;
        const filePath = node.source?.filePath ? node.source.filePath.replace(/\\/g, '/') : '';

        for (const pattern of this.config.ignore) {
            const normalizedPattern = pattern.replace(/\\/g, '/');

            if (normalizedPattern.includes('*') || normalizedPattern.includes('?')) {
                const escaped = normalizedPattern
                    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                    .replace(/\*/g, '.*')
                    .replace(/\?/g, '.');
                const regex = new RegExp(`^${escaped}$`, 'i');

                if (regex.test(nodeName) || regex.test(qualifiedName) || (filePath && regex.test(filePath))) {
                    return true;
                }
            } else {
                const lowerPattern = normalizedPattern.toLowerCase();
                if (
                    nodeName.toLowerCase() === lowerPattern ||
                    qualifiedName.toLowerCase() === lowerPattern ||
                    (filePath && filePath.toLowerCase().includes(lowerPattern))
                ) {
                    return true;
                }
            }
        }

        return false;
    }
}

