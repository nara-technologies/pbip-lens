import { Token, TokenTypes } from './Token';
import { ScopeManager } from './ScopeManager';

export interface ExternalReference {
    readonly value: string;
    readonly line: number;
    readonly column: number;
    readonly edgeType?: string;
}

/**
 * Structural Parser performing token stream scanning.
 * Extracts potential external identifiers (measures, columns, tables)
 * without parsing full execution AST nodes.
 */
export class StructuralParser {
    private scopeManager: ScopeManager;

    constructor() {
        this.scopeManager = new ScopeManager();
    }

    public parse(tokens: Token[]): ExternalReference[] {
        const externalReferences: ExternalReference[] = [];
        this.scopeManager = new ScopeManager(); // Reset scope state for each independent expression parse.

        let i = 0;

        // Helper utility to inspect subsequent non-trivia tokens.
        const peekNextSignificantToken = (
            startIndex: number,
        ): { index: number; token: Token | null } => {
            let j = startIndex;
            while (j < tokens.length) {
                if (
                    tokens[j].type !== TokenTypes.Whitespace &&
                    tokens[j].type !== TokenTypes.Comment
                ) {
                    return { index: j, token: tokens[j] };
                }
                j++;
            }
            return { index: j, token: null };
        };

        while (i < tokens.length) {
            const token = tokens[i];

            // 1. Filter out irrelevant tokens (e.g., whitespace, literal values, standard operators).
            if (
                token.type === TokenTypes.Whitespace ||
                token.type === TokenTypes.Comment ||
                token.type === TokenTypes.StringLiteral ||
                token.type === TokenTypes.NumberLiteral ||
                token.type === TokenTypes.Operator ||
                token.type === TokenTypes.Punctuation ||
                token.type === TokenTypes.Unknown
            ) {
                i++;
                continue;
            }

            // 2. Variable Scope Resolution (Shadowing checks for VAR declarations).
            if (token.type === TokenTypes.Keyword && token.value.toUpperCase() === 'VAR') {
                const next = peekNextSignificantToken(i + 1);
                if (next.token && next.token.type === TokenTypes.Identifier) {
                    this.scopeManager.declareVariable(next.token.value);
                    i = next.index + 1; // Skip identifier sequence.
                } else {
                    i++;
                }
                continue;
            }

            // 3. Extract semantic references and filter out built-in functions.
            if (token.type === TokenTypes.Identifier) {
                const next = peekNextSignificantToken(i + 1);

                // Look-ahead heuristic to identify function calls (e.g. SUM(...))
                if (
                    next.token &&
                    next.token.type === TokenTypes.Punctuation &&
                    next.token.value === '('
                ) {
                    // Standard DAX built-in function invocation: discard.
                    i++;
                    continue;
                }

                // Look-ahead heuristic for qualified table references (e.g. 'Table'[Column])
                if (next.token && next.token.type === TokenTypes.BracketIdentifier) {
                    if (!this.scopeManager.isLocalVariable(token.value)) {
                        externalReferences.push({
                            value: token.value + next.token.value,
                            line: token.line,
                            column: token.column,
                        });
                    }
                    i = next.index + 1; // Consume both table and column parts of the qualified reference.
                    continue;
                }

                // Handle naked identifiers (e.g., standalone table name reference).
                if (!this.scopeManager.isLocalVariable(token.value)) {
                    externalReferences.push({
                        value: token.value,
                        line: token.line,
                        column: token.column,
                    });
                }

                i++;
                continue;
            }

            // 4. Standalone bracket identifiers (e.g., [Measure] or local column reference).
            if (token.type === TokenTypes.BracketIdentifier) {
                if (!this.scopeManager.isLocalVariable(token.value)) {
                    externalReferences.push({
                        value: token.value,
                        line: token.line,
                        column: token.column,
                    });
                }
            }

            i++;
        }

        return externalReferences;
    }
}
