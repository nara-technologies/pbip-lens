import { Token, TokenType, TokenTypes } from './Token';

export class DaxLexer {
    private input: string = '';
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;

    public tokenize(input: string): Token[] {
        this.input = input;
        this.position = 0;
        this.line = 1;
        this.column = 1;

        const tokens: Token[] = [];

        while (this.position < this.input.length) {
            const char = this.currentChar();

            if (this.isWhitespace(char)) {
                tokens.push(this.readWhitespace());
                continue;
            }

            if (char === '/' && (this.peek() === '/' || this.peek() === '*')) {
                tokens.push(this.readComment());
                continue;
            }

            if (char === '-' && this.peek() === '-') {
                tokens.push(this.readComment());
                continue;
            }

            if (char === '"') {
                tokens.push(this.readStringLiteral());
                continue;
            }

            if (char === '[') {
                tokens.push(this.readBracketIdentifier());
                continue;
            }

            if (char === "'") {
                tokens.push(this.readQuotedIdentifier());
                continue;
            }

            if (this.isDigit(char)) {
                tokens.push(this.readNumberLiteral());
                continue;
            }

            if (this.isLetter(char) || char === '_') {
                tokens.push(this.readIdentifierOrKeyword());
                continue;
            }

            if (this.isOperatorChar(char)) {
                tokens.push(this.readOperator());
                continue;
            }

            if (this.isPunctuation(char)) {
                tokens.push(this.readPunctuation());
                continue;
            }

            // Emit unknown token for syntax safety instead of throwing/terminating parsing.
            tokens.push(this.createToken(TokenTypes.Unknown, char));
            this.advance();
        }

        return tokens;
    }

    private currentChar(): string {
        return this.input[this.position] || '';
    }

    private peek(): string {
        return this.input[this.position + 1] || '';
    }

    private advance(): void {
        if (this.currentChar() === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
    }

    private createToken(
        type: TokenType,
        value: string,
        startPos?: number,
        startLine?: number,
        startCol?: number,
    ): Token {
        return {
            type,
            value,
            line: startLine ?? this.line,
            column: startCol ?? this.column,
            start: startPos ?? this.position,
            end: (startPos ?? this.position) + value.length,
        };
    }

    private isWhitespace(char: string): boolean {
        return char === ' ' || char === '\t' || char === '\r' || char === '\n';
    }

    private isDigit(char: string): boolean {
        return char >= '0' && char <= '9';
    }

    private isLetter(char: string): boolean {
        return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
    }

    private isOperatorChar(char: string): boolean {
        return (
            char === '=' ||
            char === '+' ||
            char === '-' ||
            char === '*' ||
            char === '/' ||
            char === '<' ||
            char === '>' ||
            char === '^' ||
            char === '&' ||
            char === '|' ||
            char === '!'
        );
    }

    private isPunctuation(char: string): boolean {
        return (
            char === ',' ||
            char === '(' ||
            char === ')' ||
            char === ';' ||
            char === '{' ||
            char === '}'
        );
    }

    private readWhitespace(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        let value = '';

        while (this.position < this.input.length && this.isWhitespace(this.currentChar())) {
            value += this.currentChar();
            this.advance();
        }

        return this.createToken(TokenTypes.Whitespace, value, start, startLine, startCol);
    }

    private readComment(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        let value = '';

        if (this.currentChar() === '/' && this.peek() === '/') {
            // Skip single-line double-slash comment block.
            while (this.position < this.input.length && this.currentChar() !== '\n') {
                value += this.currentChar();
                this.advance();
            }
        } else if (this.currentChar() === '-' && this.peek() === '-') {
            // Skip SQL-style single-line comment block.
            while (this.position < this.input.length && this.currentChar() !== '\n') {
                value += this.currentChar();
                this.advance();
            }
        } else if (this.currentChar() === '/' && this.peek() === '*') {
            // Skip multi-line comment block.
            value += '/*';
            this.advance();
            this.advance();
            while (this.position < this.input.length) {
                if (this.currentChar() === '*' && this.peek() === '/') {
                    value += '*/';
                    this.advance();
                    this.advance();
                    break;
                }
                value += this.currentChar();
                this.advance();
            }
        }

        return this.createToken(TokenTypes.Comment, value, start, startLine, startCol);
    }

    private readStringLiteral(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        let value = '"';
        this.advance(); // Consume opening double quote.

        while (this.position < this.input.length) {
            const char = this.currentChar();
            if (char === '"' && this.peek() === '"') {
                // Double quotes inside a literal are escaped via duplication in DAX.
                value += '""';
                this.advance();
                this.advance();
            } else if (char === '"') {
                value += '"';
                this.advance();
                break;
            } else {
                value += char;
                this.advance();
            }
        }

        return this.createToken(TokenTypes.StringLiteral, value, start, startLine, startCol);
    }

    private readBracketIdentifier(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        let value = '[';
        this.advance(); // Consume opening square bracket.

        while (this.position < this.input.length) {
            const char = this.currentChar();
            if (char === ']' && this.peek() === ']') {
                // Handle bracket escaping via closing bracket doubling.
                value += ']]';
                this.advance();
                this.advance();
            } else if (char === ']') {
                value += ']';
                this.advance();
                break;
            } else {
                value += char;
                this.advance();
            }
        }

        return this.createToken(TokenTypes.BracketIdentifier, value, start, startLine, startCol);
    }

    private readQuotedIdentifier(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        let value = "'";
        this.advance(); // Consume opening single quote.

        while (this.position < this.input.length) {
            const char = this.currentChar();
            if (char === "'" && this.peek() === "'") {
                // Single quotes inside table name literals are escaped via duplication.
                value += "''";
                this.advance();
                this.advance();
            } else if (char === "'") {
                value += "'";
                this.advance();
                break;
            } else {
                value += char;
                this.advance();
            }
        }

        return this.createToken(TokenTypes.Identifier, value, start, startLine, startCol);
    }

    private readNumberLiteral(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        let value = '';

        while (
            this.position < this.input.length &&
            (this.isDigit(this.currentChar()) || this.currentChar() === '.')
        ) {
            value += this.currentChar();
            this.advance();
        }

        // Parse optional scientific notation exponent.
        if (this.currentChar().toLowerCase() === 'e') {
            value += this.currentChar();
            this.advance();
            if (this.currentChar() === '+' || this.currentChar() === '-') {
                value += this.currentChar();
                this.advance();
            }
            while (this.position < this.input.length && this.isDigit(this.currentChar())) {
                value += this.currentChar();
                this.advance();
            }
        }

        return this.createToken(TokenTypes.NumberLiteral, value, start, startLine, startCol);
    }

    private readIdentifierOrKeyword(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        let value = '';

        while (
            this.position < this.input.length &&
            (this.isLetter(this.currentChar()) ||
                this.isDigit(this.currentChar()) ||
                this.currentChar() === '_')
        ) {
            value += this.currentChar();
            this.advance();
        }

        // Set of reserved DAX keywords.
        const keywords = [
            'CALCULATE',
            'CALCULATETABLE',
            'VAR',
            'RETURN',
            'EVALUATE',
            'DEFINE',
            'MEASURE',
            'COLUMN',
            'TABLE',
            'IF',
            'SWITCH',
            'BLANK',
            'NOT',
            'AND',
            'OR',
        ];
        const isKeyword = keywords.includes(value.toUpperCase());

        return this.createToken(
            isKeyword ? TokenTypes.Keyword : TokenTypes.Identifier,
            value,
            start,
            startLine,
            startCol,
        );
    }

    private readOperator(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        let value = this.currentChar();
        this.advance();

        // Tokenize multi-character logical and comparison operators.
        if (value === '>' && (this.currentChar() === '=' || this.currentChar() === '>')) {
            value += this.currentChar();
            this.advance();
        } else if (
            value === '<' &&
            (this.currentChar() === '=' || this.currentChar() === '>' || this.currentChar() === '<')
        ) {
            value += this.currentChar();
            this.advance();
        } else if (value === '=' && this.currentChar() === '=') {
            value += this.currentChar();
            this.advance();
        } else if (value === '&' && this.currentChar() === '&') {
            value += this.currentChar();
            this.advance();
        } else if (value === '|' && this.currentChar() === '|') {
            value += this.currentChar();
            this.advance();
        }

        return this.createToken(TokenTypes.Operator, value, start, startLine, startCol);
    }

    private readPunctuation(): Token {
        const start = this.position;
        const startLine = this.line;
        const startCol = this.column;
        const value = this.currentChar();
        this.advance();
        return this.createToken(TokenTypes.Punctuation, value, start, startLine, startCol);
    }
}
