import { SemanticModel } from '../models/SemanticModel';

export class DependencyGraph {
    public static computeVisualDependencies(
        semanticModel: SemanticModel,
        baseMeasures: string[], 
        baseColumns: string[]
    ): { measures: string[], columns: string[] } {
        const usedMeasures = new Set<string>();
        const usedColumns = new Set<string>();
        const queueMeasures = [...baseMeasures];
        const queueColumns = [...baseColumns];
        
        while (queueMeasures.length > 0 || queueColumns.length > 0) {
            if (queueMeasures.length > 0) {
                const current = queueMeasures.shift()!;
                if (!usedMeasures.has(current)) {
                    usedMeasures.add(current);
                    const def = semanticModel.measures[current];
                    if (def && def.dependencies) {
                        for (const dep of def.dependencies) {
                            if (semanticModel.measures[dep] && !usedMeasures.has(dep)) {
                                queueMeasures.push(dep);
                            } else if (semanticModel.columns[dep] && !usedColumns.has(dep)) {
                                queueColumns.push(dep);
                            }
                        }
                    }
                }
            }
            if (queueColumns.length > 0) {
                const current = queueColumns.shift()!;
                if (!usedColumns.has(current)) {
                    usedColumns.add(current);
                    const def = semanticModel.columns[current];
                    if (def && def.dependencies) {
                        for (const dep of def.dependencies) {
                            if (semanticModel.measures[dep] && !usedMeasures.has(dep)) {
                                queueMeasures.push(dep);
                            } else if (semanticModel.columns[dep] && !usedColumns.has(dep)) {
                                queueColumns.push(dep);
                            }
                        }
                    }
                }
            }
        }
        return { measures: Array.from(usedMeasures), columns: Array.from(usedColumns) };
    }

    public static linkDAXDependencies(semanticModel: SemanticModel) {
        const depRegex = /\[([^\]]+)\]/g;
        const extractDependencies = (body: string, ignoreName: string) => {
            const deps: string[] = [];
            const cleanBody = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(\/\/|--).*$/gm, '');
            let depMatch;
            while ((depMatch = depRegex.exec(cleanBody)) !== null) {
                const depName = depMatch[1].trim();
                if (depName !== ignoreName && !deps.includes(depName)) {
                    deps.push(depName);
                }
            }
            return deps;
        };

        for (const measure of Object.values(semanticModel.measures)) {
            if (measure.content) {
                const deps = extractDependencies(measure.content, measure.name);
                for (const dep of deps) {
                    if (semanticModel.measures[dep] || semanticModel.columns[dep]) {
                        measure.dependencies.push(dep);
                    }
                }
            }
        }

        for (const column of Object.values(semanticModel.columns)) {
            if (column.content && column.isCalculated) {
                const deps = extractDependencies(column.content, column.name);
                for (const dep of deps) {
                    if (semanticModel.measures[dep] || semanticModel.columns[dep]) {
                        column.dependencies.push(dep);
                    }
                }
            }
        }

        for (const measure of Object.values(semanticModel.measures)) {
            for (const dep of measure.dependencies) {
                if (semanticModel.measures[dep]) {
                    if (!semanticModel.measures[dep].usedBy.includes(measure.name)) {
                       semanticModel.measures[dep].usedBy.push(measure.name);
                    }
                } else if (semanticModel.columns[dep]) {
                    if (!semanticModel.columns[dep].usedBy.includes(measure.name)) {
                       semanticModel.columns[dep].usedBy.push(measure.name);
                    }
                }
            }
        }
        
        for (const column of Object.values(semanticModel.columns)) {
            for (const dep of column.dependencies) {
                if (semanticModel.measures[dep]) {
                    if (!semanticModel.measures[dep].usedBy.includes(column.name)) {
                       semanticModel.measures[dep].usedBy.push(column.name);
                    }
                } else if (semanticModel.columns[dep]) {
                    if (!semanticModel.columns[dep].usedBy.includes(column.name)) {
                       semanticModel.columns[dep].usedBy.push(column.name);
                    }
                }
            }
        }

        for (const column of Object.values(semanticModel.columns)) {
            if (column.usedBy.length > 0) {
                let usedByMeas = false;
                for (const parent of column.usedBy) {
                    if (semanticModel.measures[parent]) {
                        usedByMeas = true; break;
                    }
                }
                column.isUsedInMeasures = usedByMeas;
            }
        }
    }
}
