import * as fs from 'fs';
import { SemanticModel } from '../models/SemanticModel';

export class TMDLParser {
    static parse(tmdlFiles: string[]): SemanticModel {
        const semanticModel: SemanticModel = {
            measures: {},
            columns: {},
            tables: {}
        };

        const objectRegex = /^\s*(measure|column|partition|hierarchy|table|relationship|role)\s+(?:'([^']+)'|"([^"]+)"|([^=\s]+))/i;
        const sortByRegex = /^\s*sortByColumn\s*:\s*(?:'([^']+)'|"([^"]+)"|([^\s\n]+))/i;
        const relColumnRegex = /^\s*(fromColumn|toColumn)\s*:\s*(.*)$/i;
        // El RLS puede tener filtros explícitos sobre columnas: filterExpression: 'Table'[Col] = ... 
        // Aunque una evaluación precisa del DAX RLS usaría el AST, algo simple para detectar columnas en el DAX del RLS es buscar: 'Tabla'[Columna] o [Columna]
        // Para más robustez, si el role tiene permisos, lo extraemos.

        let currentTable = '';
        let currentObjectType = '';
        let currentObjectName = '';
        let currentObjectLines: string[] = [];
        
        let pendingSortByTargets: { sourceCol: string, targetCol: string }[] = [];
        let relationshipKeys: string[] = []; // Array of specific column names used as keys
        let rlsExpressions: string[] = [];

        const flushObject = () => {
            if (!currentObjectType || !currentObjectName) {
                return;
            }
            const body = currentObjectLines.join('\n');
            
            if (currentObjectType === 'measure' && currentTable) {
                const measureKey = currentObjectName.toLowerCase();
                semanticModel.measures[measureKey] = {
                    name: currentObjectName,
                    tableName: currentTable,
                    filePath: '', 
                    dependencies: [],
                    usedBy: [],
                    content: body
                };
                if (semanticModel.tables[currentTable.toLowerCase()]) {
                    semanticModel.tables[currentTable.toLowerCase()].measures.push(currentObjectName);
                }
            } else if (currentObjectType === 'column' && currentTable) {
                let isCalc = false;
                let srcCol = currentObjectName;

                const colHeaderRegex = /^\s*column\s+(?:'([^']+)'|"([^"]+)"|([^=\s]+))\s*=/i;
                if (colHeaderRegex.test(currentObjectLines[0])) {
                    isCalc = true;
                }

                const srcColMatch = currentObjectLines.find(l => l.trim().startsWith('sourceColumn:'));
                if (srcColMatch) {
                    const m = /sourceColumn:\s*(?:'([^']+)'|"([^"]+)"|([^=\s]+))/.exec(srcColMatch);
                    if (m && (m[1] || m[2] || m[3])) {
                        srcCol = (m[1] || m[2] || m[3]).trim();
                    }
                }

                const dataTypeMatch = currentObjectLines.find(l => l.trim().startsWith('dataType:'));
                let dtype = 'string';
                if (dataTypeMatch) {
                    dtype = dataTypeMatch.split(':')[1].trim();
                }

                const columnKey = currentObjectName.toLowerCase();
                semanticModel.columns[columnKey] = {
                    name: currentObjectName,
                    tableName: currentTable,
                    dataType: dtype,
                    sourceColumn: srcCol,
                    isCalculated: isCalc,
                    dependencies: [],
                    usedBy: [],
                    content: body,
                    usedInVisuals: false,
                    isUsedInMeasures: false,
                    isSortByTarget: false,
                    isRelationshipKey: false,
                    isUsedInRLS: false,
                    isUsedInCalculatedColumns: false
                };
                if (semanticModel.tables[currentTable.toLowerCase()]) {
                    semanticModel.tables[currentTable.toLowerCase()].columns.push(currentObjectName);
                }

                // Detect SortBy
                for (const line of currentObjectLines) {
                    const smatch = sortByRegex.exec(line);
                    if (smatch) {
                        const target = (smatch[1] || smatch[2] || smatch[3]).trim();
                        pendingSortByTargets.push({ sourceCol: currentObjectName, targetCol: target });
                    }
                }

            } else if (currentObjectType === 'relationship') {
                for (const line of currentObjectLines) {
                    const relMatch = relColumnRegex.exec(line);
                    if (relMatch && relMatch[2]) {
                        const rightSide = relMatch[2].trim();
                        // Support Table[Column], [Column] or Table.Column
                        let colName = rightSide;
                        
                        // Try to find content in brackets first
                        const bracketMatch = /\[(.*?)\]/.exec(rightSide);
                        if (bracketMatch) {
                            colName = bracketMatch[1];
                        } else if (rightSide.includes('.')) {
                            // Fallback to dot notation (User reported case)
                            const parts = rightSide.split('.');
                            colName = parts[parts.length - 1];
                        }
                        
                        relationshipKeys.push(colName.trim());
                    }
                }
            } else if (currentObjectType === 'role') {
                for (const line of currentObjectLines) {
                    // Simple logic to extract DAX filters
                    if (line.trim().startsWith('filterExpression:')) {
                        rlsExpressions.push(line);
                    } else if (line.includes('[') && line.includes(']')) {
                        // Si es multilínea la expresión del role
                        rlsExpressions.push(line);
                    }
                }
            }
            currentObjectLines = [];
            currentObjectType = '';
            currentObjectName = '';
        };

        for (const file of tmdlFiles) {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split(/\r?\n/);

            for (const line of lines) {
                const match = objectRegex.exec(line);
                if (match) {
                    const objType = match[1].toLowerCase();
                    const objName = (match[2] || match[3] || match[4]).trim();
                    
                    if (objType === 'table') {
                        flushObject(); // Flush child of previous table if any, but a new table resets currentTable
                        currentTable = objName;
                        if (!semanticModel.tables[currentTable.toLowerCase()]) {
                            semanticModel.tables[currentTable.toLowerCase()] = {
                                name: currentTable,
                                measures: [],
                                columns: []
                            };
                        }
                        currentObjectType = objType;
                        currentObjectName = objName;
                        currentObjectLines.push(line);
                    } else {
                        flushObject();
                        currentObjectType = objType;
                        currentObjectName = objName;
                        currentObjectLines.push(line);
                        
                        // Set file path for measure
                        if (objType === 'measure') {
                            // Assigning temporarily via the variable, will be placed in flushObject
                        }
                    }
                } else if (currentObjectType) {
                    currentObjectLines.push(line);
                }
            }
            flushObject(); // End of file
        }

        // Post-Processing Phase (The Invisible Pillars)
        
        // 1. SortBy Column Targets
        for (const { targetCol } of pendingSortByTargets) {
            if (semanticModel.columns[targetCol.toLowerCase()]) {
                semanticModel.columns[targetCol.toLowerCase()].isSortByTarget = true;
            }
        }

        // 2. Relationship Keys
        for (const relCol of relationshipKeys) {
            // Relationship keys could be plain column names
            // Since column names are unique per table usually, but we have a flat columns dictionary for now
            // Or we check all columns with that name
            for (const colName of Object.keys(semanticModel.columns)) {
                if (colName.toLowerCase() === relCol.toLowerCase()) {
                    semanticModel.columns[colName].isRelationshipKey = true;
                }
            }
        }

        // 3. RLS Usage
        const rlsTextBody = rlsExpressions.join('\n').toLowerCase();
        for (const colName of Object.keys(semanticModel.columns)) {
            // Very naive DAX check for column name in RLS expressions
            // To avoid substring matches like ID catching ID_GRUPO, check with brackets
            if (rlsTextBody.includes(`[${colName.toLowerCase()}]`)) {
                semanticModel.columns[colName].isUsedInRLS = true;
            }
        }

        return semanticModel;
    }
}
