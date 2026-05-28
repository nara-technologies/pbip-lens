import { SemanticNode, NodeKinds } from '../models/CanonicalModel';

export class TmdlNodeExtractor {
     /**
      * Extracts raw semantic nodes (Tables, Measures, Columns) from a TMDL file representation.
      * Uses indentation heuristics to segment metadata properties from raw DAX blocks
      * without requiring a full TMDL parse tree.
      */
    public extractNodes(fileName: string, tmdlContent: string): SemanticNode[] {
        const nodes: SemanticNode[] = [];
        const lines = tmdlContent.split(/\r?\n/);

        let currentTableId: string | null = null;
        let currentTableName: string | null = null;
        let currentNode: SemanticNode | null = null;
        let capturingExpression = false;
        let expressionLines: string[] = [];
        let inBackticks = false;
        let docCommentLines: string[] = [];

        const cleanName = (name: string) => name.replace(/^['"]|['"]$/g, '');

        const finalizeNode = () => {
            if (currentNode) {
                if (expressionLines.length > 0) {
                    // Standardize code block indentation.
                    // Find the minimum indentation prefix to strip.
                    let minIndent = Infinity;
                    for (const l of expressionLines) {
                        if (l.trim() === '') continue;
                        const match = l.match(/^(\s*)/);
                        if (match) {
                            minIndent = Math.min(minIndent, match[1].length);
                        }
                    }
                    if (minIndent === Infinity) minIndent = 0;

                    // Strip the base indentation prefix and join lines into a single expression string.
                    const cleanedLines = expressionLines.map((l) =>
                        l.substring(Math.min(minIndent, l.length)),
                    );
                    (currentNode as any).expression = cleanedLines.join('\n').trim();
                }
                nodes.push(currentNode);
                currentNode = null;
                expressionLines = [];
            }
            capturingExpression = false;
            inBackticks = false;
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') {
                if (capturingExpression) expressionLines.push(line);
                continue;
            }

            // Check for documentation comments (/// comment)
            const docCommentMatch = line.match(/^\s*\/\/\/\s*(.*)$/);
            if (docCommentMatch) {
                if (capturingExpression) {
                    finalizeNode();
                }
                const commentText = docCommentMatch[1].trim();
                docCommentLines.push(commentText);
                continue;
            }

            // Clear accumulated doc comments on other object declarations outside expressions
            if (!capturingExpression) {
                const otherObjectMatch = line.match(/^\s*(partition|hierarchy|role|relationship|model|expression|culture|perspective)\b/i);
                if (otherObjectMatch) {
                    docCommentLines = [];
                }
            }

            // 1. Parse top-level table definition.
            const tableMatch = line.match(/^table\s+(.+)$/);
            if (tableMatch) {
                finalizeNode();
                const rawName = tableMatch[1];
                currentTableName = cleanName(rawName);
                currentTableId = `table:${currentTableName.toLowerCase()}`;

                const tableNode: SemanticNode = {
                    id: currentTableId,
                    semanticKey: currentTableId,
                    kind: NodeKinds.Table,
                    version: 1,
                    name: currentTableName,
                    qualifiedName: currentTableName,
                    source: { filePath: fileName, line: i + 1 },
                };
                
                if (docCommentLines.length > 0) {
                    (tableNode as any).description = docCommentLines.join('\n').trim();
                    docCommentLines = [];
                }

                nodes.push(tableNode);
                continue;
            }

            // 2. Parse measure or column definition inside a table.
            const itemMatch = line.match(/^\s+(measure|column)\s+([^=]+)(?:\s*=(.*))?$/);
            if (itemMatch) {
                finalizeNode();
                const kindStr = itemMatch[1];
                const rawName = itemMatch[2].trim();
                const restOfLine = itemMatch[3];

                const name = cleanName(rawName);
                const kind = kindStr === 'measure' ? NodeKinds.Measure : NodeKinds.Column;
                const id = `${kind}:${(currentTableName || 'unknown').toLowerCase()}.${name.toLowerCase()}`;
                const qualifiedName = currentTableName
                    ? `'${currentTableName}'[${name}]`
                    : `[${name}]`;

                currentNode = {
                    id: id,
                    semanticKey: id,
                    kind: kind as any,
                    version: 1,
                    name: name,
                    qualifiedName: qualifiedName,
                    source: { filePath: fileName, line: i + 1 },
                    parentTableId: currentTableId || '',
                };

                if (docCommentLines.length > 0) {
                    (currentNode as any).description = docCommentLines.join('\n').trim();
                    docCommentLines = [];
                }

                if (restOfLine !== undefined) {
                    capturingExpression = true;
                    const exprStart = restOfLine.trim();
                    if (exprStart.startsWith('```')) {
                        inBackticks = true;
                        const content = exprStart.substring(3).trim();
                        if (content) expressionLines.push(content);
                    } else if (exprStart !== '') {
                        expressionLines.push(exprStart);
                    }
                }
                continue;
            }
            // 3. Accumulate metadata properties or parse multi-line DAX expression.
            if (capturingExpression) {
                if (inBackticks) {
                    if (trimmed.endsWith('```')) {
                        const content = line.replace(/```\s*$/, '');
                        if (content.trim() !== '') expressionLines.push(content);
                        inBackticks = false;
                        capturingExpression = false;
                    } else {
                        expressionLines.push(line);
                    }
                    continue;
                }

                // Check for TMDL structural keywords that mark the end of the current expression.
                const metadataMatch = line.match(
                    /^\s+(formatString|displayFolder|lineageTag|summarizeBy|isHidden|sortByColumn|description)\s*:\s*(.*)$/i,
                );
                const isNewObject = line.match(/^\s*(measure|column|table|partition|hierarchy)\b/i);

                if (metadataMatch) {
                    capturingExpression = false;
                    if (currentNode) {
                        const prop = metadataMatch[1];
                        const val = metadataMatch[2].replace(/^['"](.*)['"]$/, '$1').trim();
                        if (prop.toLowerCase() === 'formatstring')
                            (currentNode as any).formatString = val;
                        if (prop.toLowerCase() === 'displayfolder')
                            (currentNode as any).displayFolder = val;
                        if (prop.toLowerCase() === 'sortbycolumn')
                            (currentNode as any).sortByColumn = val;
                        if (prop.toLowerCase() === 'description') {
                            if (!(currentNode as any).description) {
                                (currentNode as any).description = val;
                            }
                        }
                    }
                    continue;
                }

                if (isNewObject) {
                    capturingExpression = false;
                    i--; // Backtrack to let the main loop parse the next object declaration.
                    continue;
                }

                // Accumulate DAX expression lines, retaining vertical formatting.
                expressionLines.push(line);
            } else if (currentNode) {
                // Parse other non-expression properties (e.g. sortByColumn, displayFolder, description).
                const metadataMatch = line.match(
                    /^\s+(formatString|displayFolder|lineageTag|summarizeBy|isHidden|sortByColumn|description)\s*:\s*(.*)$/i,
                );
                if (metadataMatch) {
                    const prop = metadataMatch[1];
                    const val = metadataMatch[2].replace(/^['"](.*)['"]$/, '$1').trim();
                    if (prop.toLowerCase() === 'formatstring')
                        (currentNode as any).formatString = val;
                    if (prop.toLowerCase() === 'displayfolder')
                        (currentNode as any).displayFolder = val;
                    if (prop.toLowerCase() === 'sortbycolumn')
                        (currentNode as any).sortByColumn = val;
                    if (prop.toLowerCase() === 'description') {
                        if (!(currentNode as any).description) {
                            (currentNode as any).description = val;
                        }
                    }
                }
            }
        }

        finalizeNode();
        return nodes;
    }
}
