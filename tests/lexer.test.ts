import { DaxLexer } from '../src/core/analyzer/Lexer';
import { TokenTypes } from '../src/core/analyzer/Token';

describe('DaxLexer Golden Models', () => {
    let lexer: DaxLexer;

    beforeEach(() => {
        lexer = new DaxLexer();
    });

    /**
     * Utility to retrieve tokens while discarding whitespace,
     * simplifying semantic assertions.
     */
    const getSignificantTokens = (input: string) => {
        return lexer.tokenize(input).filter((t) => t.type !== TokenTypes.Whitespace);
    };

    test('String Bypass: ignores brackets and keywords inside literals', () => {
        const input = 'VAR x = "Text with [Fake Bracket] and word CALCULATE"';
        const tokens = getSignificantTokens(input);

        // Expect 4 significant tokens: VAR, x, =, "..."
        expect(tokens.length).toBe(4);

        expect(tokens[0].type).toBe(TokenTypes.Keyword);
        expect(tokens[0].value).toBe('VAR');

        expect(tokens[1].type).toBe(TokenTypes.Identifier);
        expect(tokens[1].value).toBe('x');

        expect(tokens[2].type).toBe(TokenTypes.Operator);
        expect(tokens[2].value).toBe('=');

        expect(tokens[3].type).toBe(TokenTypes.StringLiteral);
        expect(tokens[3].value).toBe('"Text with [Fake Bracket] and word CALCULATE"');
    });

    test('Bracket Identifiers with spaces', () => {
        const input = '[Total Sales YTD]';
        const tokens = getSignificantTokens(input);

        expect(tokens.length).toBe(1);
        expect(tokens[0].type).toBe(TokenTypes.BracketIdentifier);
        expect(tokens[0].value).toBe('[Total Sales YTD]');
    });

    test('Whitespace management: preserves line and column', () => {
        const input = 'VAR\n\n    x';
        const tokens = lexer.tokenize(input); // Analyze ALL tokens including whitespace

        // Expected tokens: VAR, Whitespace(\n\n    ), x
        expect(tokens.length).toBe(3);

        const varToken = tokens[0];
        expect(varToken.type).toBe(TokenTypes.Keyword);
        expect(varToken.value).toBe('VAR');
        expect(varToken.line).toBe(1);
        expect(varToken.column).toBe(1);

        const wsToken = tokens[1];
        expect(wsToken.type).toBe(TokenTypes.Whitespace);

        const xToken = tokens[2];
        expect(xToken.type).toBe(TokenTypes.Identifier);
        expect(xToken.value).toBe('x');
        // 'x' is located on line 3, after 4 spaces (column 5)
        expect(xToken.line).toBe(3);
        expect(xToken.column).toBe(5);
    });

    test('Comments: correctly consumes line and block comments', () => {
        const input = `
            // Comment 1
            -- Comment 2
            /* 
               Block comment
               [Fake]
            */
            MEASURE
        `;

        const tokens = getSignificantTokens(input);

        // Filtering out whitespace leaves exactly 4 significant tokens
        expect(tokens.length).toBe(4);

        expect(tokens[0].type).toBe(TokenTypes.Comment);
        expect(tokens[0].value.startsWith('//')).toBe(true);

        expect(tokens[1].type).toBe(TokenTypes.Comment);
        expect(tokens[1].value.startsWith('--')).toBe(true);

        expect(tokens[2].type).toBe(TokenTypes.Comment);
        expect(tokens[2].value.startsWith('/*')).toBe(true);
        expect(tokens[2].value.includes('[Fake]')).toBe(true); // The fake bracket was captured within the comment

        expect(tokens[3].type).toBe(TokenTypes.Keyword);
        expect(tokens[3].value).toBe('MEASURE');
    });
});
