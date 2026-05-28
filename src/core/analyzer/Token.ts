export const TokenTypes = {
    Keyword: 'Keyword',
    Identifier: 'Identifier',
    BracketIdentifier: 'BracketIdentifier',
    StringLiteral: 'StringLiteral',
    NumberLiteral: 'NumberLiteral',
    Operator: 'Operator',
    Punctuation: 'Punctuation',
    Whitespace: 'Whitespace',
    Comment: 'Comment',
    Unknown: 'Unknown',
} as const;

export type TokenType = (typeof TokenTypes)[keyof typeof TokenTypes];

export interface Token {
    readonly type: TokenType;
    readonly value: string;
    readonly line: number;
    readonly column: number;
    readonly start: number;
    readonly end: number;
}
