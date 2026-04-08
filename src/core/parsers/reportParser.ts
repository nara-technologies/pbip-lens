import * as fs from 'fs';

export interface ReportStructure {
    measures: string[];
    columns: string[];
}

export class ReportParser {
    public static parseVisualJSON(filePath: string): ReportStructure {
        const results: ReportStructure = { measures: [], columns: [] };
        
        const extractFieldsFromObject = (obj: any) => {
            if (!obj || typeof obj !== 'object') {
                return;
            }
            
            if (obj.Measure && typeof obj.Measure.Property === 'string') {
                if (!results.measures.includes(obj.Measure.Property)) {
                    results.measures.push(obj.Measure.Property);
                }
            }
            if (obj.Column && typeof obj.Column.Property === 'string') {
                if (!results.columns.includes(obj.Column.Property)) {
                    results.columns.push(obj.Column.Property);
                }
            }

            for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'object') {
                    extractFieldsFromObject(obj[key]);
                } else if (typeof obj[key] === 'string') {
                    const str = obj[key].trim();
                    // Some configs are packed inside escaped JSON strings
                    if ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) {
                        try {
                            const parsed = JSON.parse(str);
                            extractFieldsFromObject(parsed);
                        } catch (e) {
                            // Non JSON string inside the config
                        }
                    }
                }
            }
        };

        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const jsonData = JSON.parse(content);
                extractFieldsFromObject(jsonData);
            } catch (e) {
                console.error(`PBIP Lens: Error parsing visual.json in ${filePath}`, e);
            }
        }
        
        return results;
    }
}
