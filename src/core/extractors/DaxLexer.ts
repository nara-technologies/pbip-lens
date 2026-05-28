export interface Token {
    type:
        | 'identifier'
        | 'string'
        | 'variable'
        | 'keyword'
        | 'operator'
        | 'function'
        | 'table_column'
        | 'comment'
        | 'unknown';
    value: string;
    position: number;
}

export class DaxLexer {

    public static extractReferences(daxExpression: string, ignoreName?: string): string[] {
        if (!daxExpression) {
            return [];
        }

        const deps = new Set<string>();

        // Remove comments
        // Block comments /* ... */
        let code = daxExpression.replace(/\/\*[\s\S]*?\*\//g, ' ');
        // Line comments // or --
        code = code.replace(/(\/\/|--).*$/gm, ' ');

        // Remove strings "..."
        code = code.replace(/"(?:[^"\\]|\\.)*"/g, ' ');

        // Extract variables VAR name = ...
        const varRegex = /\bVAR\s+([a-zA-Z0-9_]+)\b/gi;
        const variables = new Set<string>();
        let varMatch;
        while ((varMatch = varRegex.exec(code)) !== null) {
            variables.add(varMatch[1].toLowerCase());
        }

        // Now find references
        // Power BI DAX references are usually in brackets: [MeasureName] or 'TableName'[ColumnName] or TableName[ColumnName]
        // The previous simple logic was just capturing anything in brackets.
        // We will do the same but now we're safe from comments and strings.

        const refRegex = /\[([^\]]+)\]/g;
        let refMatch;
        while ((refMatch = refRegex.exec(code)) !== null) {
            const refName = refMatch[1].trim();

            // Ignore if it's a known variable (although VARs usually don't have brackets, but sometimes people might do weird things?)
            // Actually, in DAX variables are referenced without brackets, e.g., RETURN __var

            if (ignoreName && refName.toLowerCase() === ignoreName.toLowerCase()) {
                continue;
            }

            deps.add(refName);
        }

        return Array.from(deps);
    }
}
