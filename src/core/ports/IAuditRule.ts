import { CanonicalNode } from '../models/CanonicalModel';
import { SemanticGraph } from '../graph/SemanticGraph';

export type RuleSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface RuleViolation {
    ruleId: string;
    message: string;
    severity: RuleSeverity;
}

/**
 * Represents a pure contract for the definition of audit rules in the semantic model.
 * Using this contract decouples the audit engine (AuditEngine) from individual rules,
 * enabling an extensible architecture based on the Strategy Pattern.
 */
export interface IAuditRule {
    /**
     * Unique identifier of the rule.
     */
    readonly id: string;

    /**
     * Descriptive name of the rule to display in user interfaces and reports.
     */
    readonly name: string;

    /**
     * Default severity level for violations of this rule.
     */
    readonly defaultSeverity: RuleSeverity;

    /**
     * Evaluates a specific node in relation to the current state of the semantic graph.
     * 
     * This method is designed to be a pure, stateless function, allowing any rule
     * to be evaluated in isolation on a node.
     * 
     * @param node The canonical model node to be examined.
     * @param graph The complete semantic graph, allowing queries on relationships, dependencies,
     *              and other connected nodes to make contextual decisions.
     * @returns A RuleViolation object if the node does not comply with the quality rule, or null
     *          if the node is valid and presents no violation.
     */
    evaluate(node: CanonicalNode, graph: SemanticGraph): RuleViolation | null;
}
