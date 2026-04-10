import * as vscode from 'vscode';
import { AuditResult, PageAudit } from '../core/models/AuditResult';
import { MeasureDefinition, ColumnDefinition, TableDefinition } from '../core/models/SemanticModel';

export abstract class BaseTreeProvider implements vscode.TreeDataProvider<MeasureItem> {
    protected _onDidChangeTreeData: vscode.EventEmitter<MeasureItem | undefined | void> = new vscode.EventEmitter<MeasureItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<MeasureItem | undefined | void> = this._onDidChangeTreeData.event;
    
    protected auditResult: AuditResult | undefined;
    protected forceExpanded: boolean = false;
    protected parentMap = new Map<string, MeasureItem>();

    refresh(result?: AuditResult): void {
        if (result) {
            this.auditResult = result;
        }
        this.parentMap.clear();
        this._onDidChangeTreeData.fire();
    }

    getParent(element: MeasureItem): MeasureItem | undefined {
        if (element.id) {
            return this.parentMap.get(element.id);
        }
        return undefined;
    }

    expandAll(): void {
        this.forceExpanded = true;
        this.refresh();
        setTimeout(() => {
            this.forceExpanded = false;
        }, 1000);
    }

    protected getMeasureDefinition(name: string): MeasureDefinition | undefined {
        if (!this.auditResult) { return undefined; }
        return this.auditResult.semanticModel.measures[name.toLowerCase()];
    }
    
    protected getColumnDefinition(name: string): ColumnDefinition | undefined {
        if (!this.auditResult) { return undefined; }
        return this.auditResult.semanticModel.columns[name.toLowerCase()];
    }

    getTreeItem(element: MeasureItem): vscode.TreeItem {
        return element;
    }

    protected getDependenciesNodes(element: MeasureItem): Thenable<MeasureItem[]> {
        const depsFolder = element.contextValue === 'measure_item' || element.contextValue === 'column_item';
        if (depsFolder) {
            const deps = element.measureData ? element.measureData.dependencies : (element.columnData ? element.columnData.dependencies : []);
            const used = element.measureData ? element.measureData.usedBy : (element.columnData ? element.columnData.usedBy : []);
            
            const items: MeasureItem[] = [];
            
            if (deps && deps.length > 0) {
                items.push(new MeasureItem(`📉 Usa a (${deps.length})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'deps_folder', undefined, undefined, element.measureData, element.columnData, undefined, `${element.id}/deps`));
            }
            if (used && used.length > 0) {
                items.push(new MeasureItem(`📈 Usada por (${used.length})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'usedby_folder', undefined, undefined, element.measureData, element.columnData, undefined, `${element.id}/usedby`));
            }
            return Promise.resolve(items);
        }
        
        if (element.contextValue === 'deps_folder') {
            const deps = element.measureData ? element.measureData.dependencies : (element.columnData ? element.columnData.dependencies : []);
            return Promise.resolve(deps.map(depName => {
                const depMeasure = this.getMeasureDefinition(depName);
                if (depMeasure) {
                    return new MeasureItem(depName, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'measure_item', depMeasure.filePath, undefined, depMeasure, undefined, undefined, `${element.id}/${depName}`);
                }
                const depColumn = this.getColumnDefinition(depName);
                if (depColumn) {
                    return new MeasureItem(depName, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'column_item', undefined, undefined, undefined, depColumn, undefined, `${element.id}/${depName}`);
                }
                return new MeasureItem(depName, vscode.TreeItemCollapsibleState.None, 'child_item', undefined, undefined, undefined, undefined, undefined, `${element.id}/${depName}`);
            }));
        }

        if (element.contextValue === 'usedby_folder') {
            const used = element.measureData ? element.measureData.usedBy : (element.columnData ? element.columnData.usedBy : []);
            return Promise.resolve(used.map(parentName => {
                 const parentMeasure = this.getMeasureDefinition(parentName);
                 if (parentMeasure) {
                     return new MeasureItem(parentName, vscode.TreeItemCollapsibleState.None, 'parent_item', parentMeasure.filePath, undefined, parentMeasure, undefined, undefined, `${element.id}/${parentName}`);
                 }
                 const parentColumn = this.getColumnDefinition(parentName);
                 if (parentColumn) {
                     return new MeasureItem(parentName, vscode.TreeItemCollapsibleState.None, 'parent_item', undefined, undefined, undefined, parentColumn, undefined, `${element.id}/${parentName}`);
                 }
                 return new MeasureItem(parentName, vscode.TreeItemCollapsibleState.None, 'parent_item', undefined, undefined, undefined, undefined, undefined, `${element.id}/${parentName}`);
            }));
        }
        return Promise.resolve([]);
    }

    abstract getChildrenImpl(element?: MeasureItem): Thenable<MeasureItem[]>;

    getChildren(element?: MeasureItem): Thenable<MeasureItem[]> {
        return this.getChildrenImpl(element).then(children => {
            if (element && children) {
                children.forEach(child => {
                    if (child.id) {
                        this.parentMap.set(child.id, element);
                    }
                });
            }
            return children;
        });
    }
}

export class MeasuresTreeProvider extends BaseTreeProvider {
    private groupByPage: boolean = false;

    toggleViewMode(): void {
        this.groupByPage = !this.groupByPage;
        this.refresh();
        vscode.window.showInformationMessage(`Vista cambiada a: ${this.groupByPage ? 'Por Páginas' : 'Global'}`);
    }

    getChildrenImpl(element?: MeasureItem): Thenable<MeasureItem[]> {
        if (!this.auditResult) {
            return Promise.resolve([]);
        }

        if (!element) {
            if (this.groupByPage) {
                const items: MeasureItem[] = [];
                for (const page of this.auditResult.pages) {
                    items.push(new MeasureItem(`📄 ${page.displayName}`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'page', undefined, page, undefined, undefined, undefined, `page_${page.displayName}`));
                }
                const orphanCount = this.auditResult.globalOrphanedMeasures.length;
                items.push(new MeasureItem(`⚠️ Huérfanas (${orphanCount})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'global_orphaned', undefined, undefined, undefined, undefined, undefined, 'global_orphaned'));
                return Promise.resolve(items);
            } else {
                const usedCount = this.auditResult.globalUsedMeasures.length;
                const orphanCount = this.auditResult.globalOrphanedMeasures.length;
                return Promise.resolve([
                    new MeasureItem(`✅ En Uso (${usedCount})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'global_used', undefined, undefined, undefined, undefined, undefined, 'global_used'),
                    new MeasureItem(`⚠️ Huérfanas (${orphanCount})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'global_orphaned', undefined, undefined, undefined, undefined, undefined, 'global_orphaned')
                ]);
            }
        }

        if (element.contextValue === 'page' && element.pageData) {
            const usedCount = element.pageData.usedMeasures.length;
            const colsCount = element.pageData.usedColumns.length;
            return Promise.resolve([
                new MeasureItem(`✅ Medidas en Uso (${usedCount})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'page_used_measures', undefined, element.pageData, undefined, undefined, undefined, `${element.id}/measures`),
                new MeasureItem(`✅ Columnas en Uso (${colsCount})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'page_used_columns', undefined, element.pageData, undefined, undefined, undefined, `${element.id}/columns`)
            ]);
        }
        
        if (element.contextValue === 'page_used_measures' && element.pageData) {
            return Promise.resolve(element.pageData.usedMeasures.map(m =>
                new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? (this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m, undefined, undefined, `${element.id}/${m.name}`)
            ));
        }

        if (element.contextValue === 'page_used_columns' && element.pageData) {
            return Promise.resolve(element.pageData.usedColumns.map(c =>
                new MeasureItem(c.name, (c.dependencies.length > 0 || c.usedBy.length > 0) ? (this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None, 'column_item', undefined, undefined, undefined, c, undefined, `${element.id}/${c.name}`)
            ));
        }

        if (element.contextValue === 'global_used') {
            return Promise.resolve(this.auditResult.globalUsedMeasures.map(m =>
                new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? (this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m, undefined, undefined, `${element.id}/${m.name}`)
            ));
        }

        if (element.contextValue === 'global_orphaned') {
            return Promise.resolve(this.auditResult.globalOrphanedMeasures.map(m =>
                new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? (this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m, undefined, undefined, `${element.id}/${m.name}`)
            ));
        }

        return this.getDependenciesNodes(element);
    }
}

export class TablesTreeProvider extends BaseTreeProvider {
    getChildrenImpl(element?: MeasureItem): Thenable<MeasureItem[]> {
        if (!this.auditResult) {
            return Promise.resolve([]);
        }

        if (!element) {
             const tables = Object.values(this.auditResult.semanticModel.tables).sort((a,b)=>a.name.localeCompare(b.name));
             return Promise.resolve(tables.map(t => new MeasureItem(t.name, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'table_item', undefined, undefined, undefined, undefined, t, `table_${t.name}`)));
        }

        if (element.contextValue === 'table_item' && element.tableData) {
            const t = element.tableData;
            return Promise.resolve([
                new MeasureItem(`Columnas (${t.columns.length})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'table_columns', undefined, undefined, undefined, undefined, t, `${element.id}/columns`),
                new MeasureItem(`Medidas (${t.measures.length})`, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'table_measures', undefined, undefined, undefined, undefined, t, `${element.id}/measures`)
            ]);
        }

        if (element.contextValue === 'table_columns' && element.tableData) {
            return Promise.resolve(element.tableData.columns.map(cName => {
                const c = this.auditResult!.semanticModel.columns[cName.toLowerCase()];
                return new MeasureItem(c.name, (c.dependencies.length > 0 || c.usedBy.length > 0) ? (this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None, 'column_item', undefined, undefined, undefined, c, undefined, `${element.id}/${cName}`);
            }));
        }

        if (element.contextValue === 'table_measures' && element.tableData) {
            const measuresInTable = element.tableData.measures.map(mName => this.auditResult!.semanticModel.measures[mName.toLowerCase()]);
            const rootMeasures: MeasureDefinition[] = [];
            const folders: { [folderName: string]: MeasureDefinition[] } = {};

            for (const m of measuresInTable) {
                if (m.displayFolder) {
                if (!folders[m.displayFolder]) { folders[m.displayFolder] = []; }
                    folders[m.displayFolder].push(m);
                } else {
                    rootMeasures.push(m);
                }
            }

            const children: MeasureItem[] = [];
            for (const folderName of Object.keys(folders).sort()) {
                children.push(new MeasureItem(folderName, this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, 'measure_folder', undefined, undefined, undefined, undefined, element.tableData, `${element.id}/folder_${folderName}`, folderName));
            }
            for (const m of rootMeasures.sort((a,b) => a.name.localeCompare(b.name))) {
                children.push(new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? (this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m, undefined, undefined, `${element.id}/${m.name}`));
            }
            return Promise.resolve(children);
        }

        if (element.contextValue === 'measure_folder' && element.tableData && element.folderName) {
            const folderMeasures = element.tableData.measures
                .map(mName => this.auditResult!.semanticModel.measures[mName.toLowerCase()])
                .filter(m => m.displayFolder === element.folderName)
                .sort((a,b) => a.name.localeCompare(b.name));
            
            return Promise.resolve(folderMeasures.map(m => {
                return new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? (this.forceExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed) : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m, undefined, undefined, `${element.id}/${m.name}`);
            }));
        }

        return this.getDependenciesNodes(element);
    }
}

export class MeasureItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue?: string,
        public readonly filePath?: string,
        public readonly pageData?: PageAudit,
        public readonly measureData?: MeasureDefinition,
        public readonly columnData?: ColumnDefinition,
        public readonly tableData?: TableDefinition,
        public override readonly id?: string,
        public readonly folderName?: string
    ) {
        super(label, collapsibleState);
        this.id = id;
        
        if (contextValue === 'measure_item' || contextValue === 'column_item' || contextValue === 'child_item' || contextValue === 'parent_item') {
            
            if (measureData) {
                this.iconPath = new vscode.ThemeIcon('symbol-variable');
                if (measureData.content) {
                    this.command = { command: 'pbip-lens.showMeasureDax', title: 'Ver DAX', arguments: [measureData.name, measureData.content, filePath || measureData.filePath] };
                }
            } else if (columnData) {
                this.iconPath = new vscode.ThemeIcon('symbol-field');
                // Para luego: abrir el Column Dashboard
                this.command = { command: 'pbip-lens.showColumnDashboard', title: 'Ver Detalles', arguments: [columnData] };
            } else {
                this.iconPath = new vscode.ThemeIcon('question');
            }

            // Opciones especiales UI si fue llamada desde global_used o global_orphaned? En la nueva UI ya lo marcamos sólo en las raíces, aquí ya no es necesario el icon de check o error, dejamos field/variable para diferenciar qué es.
            
        } else if (contextValue === 'root_measures' || contextValue === 'root_tables') {
            this.iconPath = contextValue === 'root_measures' ? new vscode.ThemeIcon('graph-line') : new vscode.ThemeIcon('database');
        } else if (contextValue === 'table_item') {
            this.iconPath = new vscode.ThemeIcon('table');
        } else if (contextValue === 'page') {
            this.iconPath = new vscode.ThemeIcon('layout');
        } else if (contextValue === 'measure_folder') {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else if (contextValue === 'relationship_item') {
            this.iconPath = new vscode.ThemeIcon('arrow-swap');
        } else if (contextValue === 'query_group') {
            this.iconPath = new vscode.ThemeIcon('repo');
        } else if (contextValue === 'query_item') {
            this.iconPath = new vscode.ThemeIcon('code');
        } else {
            // Folders (pages_used, table_columns, etc)
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}

export class RelationshipsTreeProvider extends BaseTreeProvider {
    getChildrenImpl(element?: MeasureItem): Thenable<MeasureItem[]> {
        if (!this.auditResult) {
            return Promise.resolve([]);
        }

        if (!element) {
            return Promise.resolve(this.auditResult.semanticModel.relationships.map(r => {
                const label = `${r.fromTable}[${r.fromColumn}] ↔ ${r.toTable}[${r.toColumn}]`;
                const item = new MeasureItem(label, vscode.TreeItemCollapsibleState.None, 'relationship_item', undefined, undefined, undefined, undefined, undefined, `rel_${r.name}`);
                item.description = r.crossFilteringBehavior;
                return item;
            }));
        }

        return Promise.resolve([]);
    }
}

export class QueriesTreeProvider extends BaseTreeProvider {
    getChildrenImpl(element?: MeasureItem): Thenable<MeasureItem[]> {
        if (!this.auditResult) {
            return Promise.resolve([]);
        }

        if (!element) {
            const queries = this.auditResult.semanticModel.queries;
            const groups: { [group: string]: any[] } = {};
            const rootQueries: any[] = [];

            for (const q of queries) {
                if (q.group) {
                    if (!groups[q.group]) { groups[q.group] = []; }
                    groups[q.group].push(q);
                } else {
                    rootQueries.push(q);
                }
            }

            const children: MeasureItem[] = [];
            for (const groupName of Object.keys(groups).sort()) {
                children.push(new MeasureItem(groupName, vscode.TreeItemCollapsibleState.Collapsed, 'query_group', undefined, undefined, undefined, undefined, undefined, `qgroup_${groupName}`, groupName));
            }
            for (const q of rootQueries.sort((a, b) => a.name.localeCompare(b.name))) {
                const item = new MeasureItem(q.name, vscode.TreeItemCollapsibleState.None, 'query_item', undefined, undefined, undefined, undefined, undefined, `query_${q.name}`);
                item.command = { command: 'pbip-lens.showQueryM', title: 'Ver M', arguments: [q.name, q.content] };
                children.push(item);
            }
            return Promise.resolve(children);
        }

        if (element.contextValue === 'query_group' && element.folderName) {
            const folderQueries = this.auditResult.semanticModel.queries
                .filter(q => q.group === element.folderName)
                .sort((a, b) => a.name.localeCompare(b.name));

            return Promise.resolve(folderQueries.map(q => {
                const item = new MeasureItem(q.name, vscode.TreeItemCollapsibleState.None, 'query_item', undefined, undefined, undefined, undefined, undefined, `query_${q.name}`);
                item.command = { command: 'pbip-lens.showQueryM', title: 'Ver M', arguments: [q.name, q.content] };
                return item;
            }));
        }

        return Promise.resolve([]);
    }
}
