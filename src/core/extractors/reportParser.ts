import { IFileSystem } from '../ports/IFileSystem';
import { NodeKinds, PageNode, SemanticNode, VisualNode } from '../models/CanonicalModel';
import { DaxLexer } from '../analyzer/Lexer';
import { ExternalReference, StructuralParser } from '../analyzer/StructuralParser';
import { Logger } from '../utils/Logger';

export class ReportParser {
    private lexer = new DaxLexer();
    private parser = new StructuralParser();

    constructor(private fs: IFileSystem) {}

    public async parseReport(
        basePath: string,
    ): Promise<{ nodes: SemanticNode[]; references: Map<string, ExternalReference[]> }> {
        let reportFolderPath = basePath;

        if (await this.fs.isDirectory(basePath)) {
            const dirs = await this.fs.readDirectory(basePath);
            const reportDirName = dirs.find((d) => d.endsWith('.Report'));
            if (reportDirName) {
                reportFolderPath = this.fs.joinPaths(basePath, reportDirName);
            }
        }

        const definitionPath = this.fs.joinPaths(reportFolderPath, 'definition');
        const pagesPath = this.fs.joinPaths(definitionPath, 'pages');
        const reportJsonPath = this.fs.joinPaths(definitionPath, 'report.json');

        const nodes: SemanticNode[] = [];
        const referencesMap = new Map<string, ExternalReference[]>();

        const hasPagesDir = await this.fs.pathExists(pagesPath);

        if (hasPagesDir) {
            await this.parsePbirFormat(pagesPath, nodes, referencesMap);
        } else {
            const hasReportJson = await this.fs.pathExists(reportJsonPath);
            if (hasReportJson) {
                const content = await this.fs.readFile(reportJsonPath);
                const reportData = this.tryParse(content);
                if (reportData && reportData.sections) {
                    let pageIndex = 0;
                    for (const section of reportData.sections) {
                        this.processLegacyPageData(
                            section,
                            section.name || `page_${pageIndex}`,
                            pageIndex,
                            reportJsonPath,
                            nodes,
                            referencesMap,
                        );
                        pageIndex++;
                    }
                }
            }
        }

        return { nodes, references: referencesMap };
    }

    // =========================================================================
    // Modern PBIR (Power BI Report) folder structure parser.
    // =========================================================================

    private async parsePbirFormat(
        pagesPath: string,
        nodes: SemanticNode[],
        referencesMap: Map<string, ExternalReference[]>,
    ): Promise<void> {
        const pageDirs = await this.fs.readDirectory(pagesPath);

        // Ingest page metadata files concurrently using batch processing.
        const pageTasks: { dirName: string; pageDirPath: string; pageJsonPath: string }[] = [];
        for (const dirName of pageDirs) {
            const pageDirPath = this.fs.joinPaths(pagesPath, dirName);
            if (await this.fs.isDirectory(pageDirPath)) {
                const pageJsonPath = this.fs.joinPaths(pageDirPath, 'page.json');
                if (await this.fs.pathExists(pageJsonPath)) {
                    pageTasks.push({ dirName, pageDirPath, pageJsonPath });
                }
            }
        }

        const CHUNK_SIZE = 50;
        const pageDataMap = new Map<
            string,
            { pageData: any; pageJsonPath: string; pageDirPath: string }
        >();

        for (let i = 0; i < pageTasks.length; i += CHUNK_SIZE) {
            const chunk = pageTasks.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(async (task) => {
                try {
                    const pageContent = await this.fs.readFile(task.pageJsonPath);
                    const pageData = this.tryParse(pageContent);
                    if (pageData) {
                        return {
                            dirName: task.dirName,
                            pageData,
                            pageJsonPath: task.pageJsonPath,
                            pageDirPath: task.pageDirPath,
                        };
                    }
                } catch (error) {
                    Logger.error(`Error leyendo page.json en ${task.pageJsonPath}: ${error}`);
                }
                return null;
            });

            const chunkResults = await Promise.all(chunkPromises);
            for (const res of chunkResults) {
                if (res) {
                    pageDataMap.set(res.dirName, {
                        pageData: res.pageData,
                        pageJsonPath: res.pageJsonPath,
                        pageDirPath: res.pageDirPath,
                    });
                }
            }
        }

        // Upsert PageNodes for each successfully parsed page definition.
        for (const [dirName, data] of pageDataMap.entries()) {
            const pageData = data.pageData;
            const pageId = `page:${pageData.name || dirName}`;
            const pageName = pageData.displayName || pageData.name || dirName;

            const pageNode: PageNode = {
                id: pageId,
                semanticKey: pageId,
                kind: NodeKinds.Page,
                version: 1,
                name: pageName,
                qualifiedName: `Page[${pageName}]`,
                title: pageName,
                source: { filePath: data.pageJsonPath, line: 0 },
            };
            nodes.push(pageNode);
        }

        // Ingest visual definition files concurrently.
        const visualTasks: {
            dirName: string;
            pageId: string;
            pageData: any;
            visualDirName: string;
            visualJsonPath: string;
        }[] = [];

        for (const [dirName, data] of pageDataMap.entries()) {
            const pageDirPath = data.pageDirPath;
            const pageData = data.pageData;
            const pageId = `page:${pageData.name || dirName}`;

            const visualsPath = this.fs.joinPaths(pageDirPath, 'visuals');
            if (await this.fs.pathExists(visualsPath)) {
                const visualDirs = await this.fs.readDirectory(visualsPath);
                for (const visualDirName of visualDirs) {
                    const visualDirPath = this.fs.joinPaths(visualsPath, visualDirName);
                    if (await this.fs.isDirectory(visualDirPath)) {
                        const visualJsonPath = this.fs.joinPaths(visualDirPath, 'visual.json');
                        if (await this.fs.pathExists(visualJsonPath)) {
                            visualTasks.push({
                                dirName,
                                pageId,
                                pageData,
                                visualDirName,
                                visualJsonPath,
                            });
                        }
                    }
                }
            }
        }

        for (let i = 0; i < visualTasks.length; i += CHUNK_SIZE) {
            const chunk = visualTasks.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(async (task) => {
                try {
                    const visualContent = await this.fs.readFile(task.visualJsonPath);
                    const visualData = this.tryParse(visualContent);
                    if (visualData && !visualData.visualGroup) {
                        return { task, visualData };
                    }
                } catch (error) {
                    Logger.error(`Error leyendo visual.json en ${task.visualJsonPath}: ${error}`);
                }
                return null;
            });

            const chunkResults = await Promise.all(chunkPromises);
            for (const res of chunkResults) {
                if (res) {
                    const { task, visualData } = res;
                    const visualId = `visual:${task.pageData.name || task.dirName}.${visualData.name || task.visualDirName || ''}`;

                    let visualName = `${visualData.visual?.visualType ?? 'visual'}-${visualData.name?.slice(-4) ?? '0000'}`;
                    let hasExplicitName = false;

                    const containerObjects =
                        visualData.visual?.visualContainerObjects ||
                        visualData.visualContainerObjects;

                    if (containerObjects && containerObjects.title) {
                        try {
                            const titleNode = Array.isArray(containerObjects.title)
                                ? containerObjects.title[0]
                                : containerObjects.title;
                            const strictValue =
                                titleNode?.properties?.text?.expr?.Literal?.Value ||
                                containerObjects.title?.properties?.text?.expr?.Literal?.Value;

                            if (strictValue && typeof strictValue === 'string') {
                                visualName = strictValue.replace(/^'|'$/g, '');
                                hasExplicitName = true;
                            } else {
                                const titleStr = JSON.stringify(containerObjects.title);
                                const match = titleStr.match(/"Value"\s*:\s*"'([^']+)'"/);

                                if (match && match[1]) {
                                    visualName = match[1];
                                    hasExplicitName = true;
                                }
                            }
                        } catch (e) {
                            // Gracefully ignore parsing errors for malformed or corrupt visual definition payloads.
                        }
                    }

                    const pageDisplayName =
                        task.pageData.displayName || task.pageData.name || task.dirName;
                    const finalNodeName = `${pageDisplayName} / ${visualName}`;

                    const visualType = visualData.visual?.visualType || 'visual';

                    const visualNode: VisualNode = {
                        id: visualId,
                        semanticKey: visualId,
                        kind: NodeKinds.Visual,
                        version: 1,
                        name: finalNodeName,
                        qualifiedName: `Visual[${visualId}]`,
                        parentPageId: task.pageId,
                        visualType: visualType,
                        title: visualName,
                        hasExplicitName: hasExplicitName,
                        source: { filePath: task.visualJsonPath, line: 0 },
                    };
                    nodes.push(visualNode);

                     // Extract DAX expression dependencies from visual schema.
                    const refs = this.extractPbirReferences(visualData);
                    if (refs.length > 0) {
                        referencesMap.set(visualId, refs);
                    }
                }
            }
        }
    }

    // =========================================================================
    // PBIR schema dependency extractor helpers.
    // =========================================================================

    private extractPbirReferences(visualData: any): ExternalReference[] {
        const refs: ExternalReference[] = [];
        const seen = new Set<string>();

        const addRef = (value: string, edgeType: string) => {
            const key = `${value}:${edgeType}`;
            if (!seen.has(key)) {
                seen.add(key);
                refs.push({ value, line: 0, column: 0, edgeType });
            }
        };

        // Extract active visual fields and projection bindings via regex scanning.
        const queryRefRegex = /queryRef=([^;}\s]+)/gi;

        const walkForQueryRefs = (obj: any): void => {
            if (!obj || typeof obj !== 'object') {
                return;
            }

            if (Array.isArray(obj)) {
                for (const item of obj) {
                    walkForQueryRefs(item);
                }
                return;
            }

            for (const [key, value] of Object.entries(obj)) {
                if (key === 'projections' && Array.isArray(value)) {
                    for (const projection of value) {
                        if (typeof projection === 'string') {
                            let match: RegExpExecArray | null;
                            queryRefRegex.lastIndex = 0;
                            while ((match = queryRefRegex.exec(projection)) !== null) {
                                const raw = match[1].trim();
                                if (!raw) {
                                    continue;
                                }
                                const formatted = this.formatQueryRef(raw);
                                addRef(formatted, 'visualValue');
                            }
                        } else if (typeof projection === 'object' && projection !== null) {
                            walkForQueryRefs(projection);
                        }
                    }
                } else if (key === 'queryRef' && typeof value === 'string') {
                    const raw = value.trim();
                    if (raw) {
                        addRef(this.formatQueryRef(raw), 'visualValue');
                    }
                } else {
                    walkForQueryRefs(value);
                }
            }
        };

        walkForQueryRefs(visualData);

        // Recursively scan formatting properties for conditional expressions.
        const formattingRefs = new Set<string>();
        this.extractFormattingMeasures(visualData.visual?.objects, formattingRefs);
        this.extractFormattingMeasures(visualData.visual?.visualContainerObjects, formattingRefs);

        for (const ref of formattingRefs) {
            addRef(ref, 'visualValue');
        }

        // Parse native visual-level calculations.
        const aliasMap = new Map<string, string>();
        this.buildAliasMap(visualData, aliasMap);

        const visualCalcExpressions: string[] = [];
        this.findNativeVisualCalculations(visualData, visualCalcExpressions);
        for (const expr of visualCalcExpressions) {
            try {
                const cleanExpr = this.replaceAliases(expr, aliasMap);
                const tokens = this.lexer.tokenize(cleanExpr);
                const parsedRefs = this.parser.parse(tokens);
                for (const parsedRef of parsedRefs) {
                    addRef(parsedRef.value, 'visualCalculation');
                }
            } catch (error) {
                Logger.error(`Error parsing Visual Calculation expression "${expr}": ${error}`);
            }
        }

        // Parse active filters and visual sorting configurations.
        const filterRefs = new Set<string>();
        if (visualData.filterConfig) {
            this.extractFieldProperties(visualData.filterConfig, filterRefs);
        }
        for (const ref of filterRefs) {
            addRef(ref, 'visualFilter');
        }

        const sortRefs = new Set<string>();
        if (visualData.visual?.query?.sortDefinition) {
            this.extractFieldProperties(visualData.visual.query.sortDefinition, sortRefs);
        }
        if (visualData.query?.sortDefinition) {
            this.extractFieldProperties(visualData.query.sortDefinition, sortRefs);
        }
        for (const ref of sortRefs) {
            addRef(ref, 'visualValue');
        }

        return refs;
    }

    private findNativeVisualCalculations(obj: any, expressions: string[]): void {
        if (!obj || typeof obj !== 'object') {
            return;
        }

        if (Array.isArray(obj)) {
            for (const item of obj) {
                this.findNativeVisualCalculations(item, expressions);
            }
            return;
        }

        if (obj.field && typeof obj.field === 'object' && obj.field.NativeVisualCalculation) {
            const nvc = obj.field.NativeVisualCalculation;
            if (typeof nvc.Expression === 'string') {
                expressions.push(nvc.Expression);
            }
        }

        for (const value of Object.values(obj)) {
            this.findNativeVisualCalculations(value, expressions);
        }
    }

    private extractFieldProperties(obj: any, refs: Set<string>): void {
        if (!obj || typeof obj !== 'object') {
            return;
        }

        if (Array.isArray(obj)) {
            for (const item of obj) {
                this.extractFieldProperties(item, refs);
            }
            return;
        }

        if (obj.field && typeof obj.field === 'object') {
            const field = obj.field;
            if (field.Measure && typeof field.Measure.Property === 'string') {
                const entity: string | undefined = field.Measure.Expression?.SourceRef?.Entity;
                const prop = field.Measure.Property;
                refs.add(entity ? `'${entity}'[${prop}]` : `[${prop}]`);
            }
            if (field.Column && typeof field.Column.Property === 'string') {
                const entity: string | undefined = field.Column.Expression?.SourceRef?.Entity;
                const prop = field.Column.Property;
                refs.add(entity ? `'${entity}'[${prop}]` : `[${prop}]`);
            }
        }

        for (const value of Object.values(obj)) {
            this.extractFieldProperties(value, refs);
        }
    }

    private extractFormattingMeasures(obj: any, refs: Set<string>): void {
        if (!obj || typeof obj !== 'object') {
            return;
        }

        if (Array.isArray(obj)) {
            for (const item of obj) {
                this.extractFormattingMeasures(item, refs);
            }
            return;
        }

        // Match measure reference patterns.
        if ('Measure' in obj && obj.Measure && typeof obj.Measure.Property === 'string') {
            const entity: string | undefined = obj.Measure?.Expression?.SourceRef?.Entity;
            refs.add(entity ? `'${entity}'[${obj.Measure.Property}]` : `[${obj.Measure.Property}]`);
        }

        // Match column reference patterns.
        if ('Column' in obj && obj.Column && typeof obj.Column.Property === 'string') {
            const entity: string | undefined = obj.Column?.Expression?.SourceRef?.Entity;
            refs.add(entity ? `'${entity}'[${obj.Column.Property}]` : `[${obj.Column.Property}]`);
        }

        // Recursively inspect nested layout nodes.
        for (const value of Object.values(obj)) {
            this.extractFormattingMeasures(value, refs);
        }
    }

    private formatQueryRef(raw: string): string {
        const dotIndex = raw.indexOf('.');
        if (dotIndex > 0) {
            const table = raw.substring(0, dotIndex);
            const field = raw.substring(dotIndex + 1);
            return `'${table}'[${field}]`;
        }
        return `[${raw}]`;
    }

    // =========================================================================
    // Legacy report.json monolithic layout format parser.
    // =========================================================================

    private processLegacyPageData(
        pageData: any,
        folderName: string,
        pageIndex: number,
        sourceFilePath: string,
        nodes: SemanticNode[],
        referencesMap: Map<string, ExternalReference[]>,
    ): void {
        const pageId = `page:${pageData.name || folderName}`;
        const pageName = pageData.displayName || pageData.name || `Page ${pageIndex}`;

        const pageNode: PageNode = {
            id: pageId,
            semanticKey: pageId,
            kind: NodeKinds.Page,
            version: 1,
            name: pageName,
            qualifiedName: `Page[${pageName}]`,
            title: pageName,
            source: { filePath: sourceFilePath, line: 0 },
        };
        nodes.push(pageNode);

        if (pageData.visualContainers) {
            let visualIndex = 0;
            for (const vc of pageData.visualContainers) {
                const config = vc.config ? this.tryParse(vc.config) : null;
                const visualType = config?.singleVisual?.visualType || 'unknown';
                const visualId = `visual:${pageData.name || folderName}_${visualIndex}`;

                const visualNode: VisualNode = {
                    id: visualId,
                    semanticKey: visualId,
                    kind: NodeKinds.Visual,
                    version: 1,
                    name: `Visual ${visualType}`,
                    qualifiedName: `Visual[${visualId}]`,
                    parentPageId: pageId,
                    visualType: visualType,
                    title: visualType,
                    source: { filePath: sourceFilePath, line: 0 },
                };
                nodes.push(visualNode);

                const refs = this.extractLegacyReferences(config);
                if (refs.length > 0) {
                    referencesMap.set(visualId, refs);
                }
                visualIndex++;
            }
        }
    }

    private extractLegacyReferences(config: any): ExternalReference[] {
        const refs: ExternalReference[] = [];
        if (!config?.singleVisual?.projections) {
            return refs;
        }

        const projections = config.singleVisual.projections;
        for (const key of Object.keys(projections)) {
            const arr = projections[key];
            if (Array.isArray(arr)) {
                for (const item of arr) {
                    if (item.queryRef) {
                        const parts = item.queryRef.split('.');
                        if (parts.length === 2) {
                            refs.push({ value: `'${parts[0]}'[${parts[1]}]`, line: 0, column: 0 });
                        } else {
                            refs.push({ value: `[${item.queryRef}]`, line: 0, column: 0 });
                        }
                    }
                }
            }
        }
        return refs;
    }

    private buildAliasMap(obj: any, aliasMap: Map<string, string>): void {
        if (!obj || typeof obj !== 'object') {
            return;
        }

        if (Array.isArray(obj)) {
            for (const item of obj) {
                this.buildAliasMap(item, aliasMap);
            }
            return;
        }

        for (const [key, value] of Object.entries(obj)) {
            if (key === 'projections' && Array.isArray(value)) {
                for (const proj of value) {
                    if (proj && typeof proj === 'object') {
                        let realName: string | undefined = undefined;
                        if (proj.field && typeof proj.field === 'object') {
                            if (
                                proj.field.Measure &&
                                typeof proj.field.Measure.Property === 'string'
                            ) {
                                realName = proj.field.Measure.Property;
                            } else if (
                                proj.field.Column &&
                                typeof proj.field.Column.Property === 'string'
                            ) {
                                realName = proj.field.Column.Property;
                            }
                        }

                        if (realName) {
                            if (
                                typeof proj.displayName === 'string' &&
                                proj.displayName !== realName
                            ) {
                                aliasMap.set(proj.displayName, realName);
                            }
                            if (
                                typeof proj.nativeQueryRef === 'string' &&
                                proj.nativeQueryRef !== realName
                            ) {
                                aliasMap.set(proj.nativeQueryRef, realName);
                            }
                        }
                    }
                }
            } else {
                this.buildAliasMap(value, aliasMap);
            }
        }
    }

    private replaceAliases(expr: string, aliasMap: Map<string, string>): string {
        let cleanExpr = expr;
        for (const [alias, realName] of aliasMap.entries()) {
            const escapedAlias = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp('\\[' + escapedAlias + '\\]', 'g');
            cleanExpr = cleanExpr.replace(regex, `[${realName}]`);
        }
        return cleanExpr;
    }

    private tryParse(jsonStr: string): any {
        try {
            return JSON.parse(jsonStr);
        } catch {
            return null;
        }
    }
}
