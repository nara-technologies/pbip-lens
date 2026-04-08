import * as vscode from 'vscode';
import { AuditResult, PageAudit } from '../core/models/AuditResult';
import { MeasureDefinition, ColumnDefinition, TableDefinition } from '../core/models/SemanticModel';

export abstract class BaseTreeProvider implements vscode.TreeDataProvider<MeasureItem> {
    protected _onDidChangeTreeData: vscode.EventEmitter<MeasureItem | undefined | void> = new vscode.EventEmitter<MeasureItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<MeasureItem | undefined | void> = this._onDidChangeTreeData.event;
    
    protected auditResult: AuditResult | undefined;

    refresh(result?: AuditResult): void {
        if (result) {
            this.auditResult = result;
        }
        this._onDidChangeTreeData.fire();
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
                items.push(new MeasureItem(`📉 Usa a (${deps.length})`, vscode.TreeItemCollapsibleState.Collapsed, 'deps_folder', undefined, undefined, element.measureData, element.columnData));
            }
            if (used && used.length > 0) {
                items.push(new MeasureItem(`📈 Usada por (${used.length})`, vscode.TreeItemCollapsibleState.Collapsed, 'usedby_folder', undefined, undefined, element.measureData, element.columnData));
            }
            return Promise.resolve(items);
        }
        
        if (element.contextValue === 'deps_folder') {
            const deps = element.measureData ? element.measureData.dependencies : (element.columnData ? element.columnData.dependencies : []);
            return Promise.resolve(deps.map(depName => {
                const depMeasure = this.getMeasureDefinition(depName);
                if (depMeasure) {
                    return new MeasureItem(depName, vscode.TreeItemCollapsibleState.None, 'child_item', depMeasure.filePath, undefined, depMeasure);
                }
                const depColumn = this.getColumnDefinition(depName);
                if (depColumn) {
                    return new MeasureItem(depName, vscode.TreeItemCollapsibleState.None, 'child_item', undefined, undefined, undefined, depColumn);
                }
                return new MeasureItem(depName, vscode.TreeItemCollapsibleState.None, 'child_item');
            }));
        }

        if (element.contextValue === 'usedby_folder') {
            const used = element.measureData ? element.measureData.usedBy : (element.columnData ? element.columnData.usedBy : []);
            return Promise.resolve(used.map(parentName => {
                 const parentMeasure = this.getMeasureDefinition(parentName);
                 if (parentMeasure) {
                     return new MeasureItem(parentName, vscode.TreeItemCollapsibleState.None, 'parent_item', parentMeasure.filePath, undefined, parentMeasure);
                 }
                 const parentColumn = this.getColumnDefinition(parentName);
                 if (parentColumn) {
                     return new MeasureItem(parentName, vscode.TreeItemCollapsibleState.None, 'parent_item', undefined, undefined, undefined, parentColumn);
                 }
                 return new MeasureItem(parentName, vscode.TreeItemCollapsibleState.None, 'parent_item');
            }));
        }
        return Promise.resolve([]);
    }

    abstract getChildren(element?: MeasureItem): Thenable<MeasureItem[]>;
}

export class MeasuresTreeProvider extends BaseTreeProvider {
    private groupByPage: boolean = false;

    toggleViewMode(): void {
        this.groupByPage = !this.groupByPage;
        this.refresh();
        vscode.window.showInformationMessage(`Vista cambiada a: ${this.groupByPage ? 'Por Páginas' : 'Global'}`);
    }

    getChildren(element?: MeasureItem): Thenable<MeasureItem[]> {
        if (!this.auditResult) {
            return Promise.resolve([new MeasureItem('Ejecuta la auditoría para ver resultados', vscode.TreeItemCollapsibleState.None)]);
        }

        if (!element) {
            if (this.groupByPage) {
                const items: MeasureItem[] = [];
                for (const page of this.auditResult.pages) {
                    items.push(new MeasureItem(`📄 ${page.displayName}`, vscode.TreeItemCollapsibleState.Collapsed, 'page', undefined, page));
                }
                const orphanCount = this.auditResult.globalOrphanedMeasures.length;
                items.push(new MeasureItem(`⚠️ Huérfanas (${orphanCount})`, vscode.TreeItemCollapsibleState.Collapsed, 'global_orphaned'));
                return Promise.resolve(items);
            } else {
                const usedCount = this.auditResult.globalUsedMeasures.length;
                const orphanCount = this.auditResult.globalOrphanedMeasures.length;
                return Promise.resolve([
                    new MeasureItem(`✅ En Uso (${usedCount})`, vscode.TreeItemCollapsibleState.Collapsed, 'global_used'),
                    new MeasureItem(`⚠️ Huérfanas (${orphanCount})`, vscode.TreeItemCollapsibleState.Collapsed, 'global_orphaned')
                ]);
            }
        }

        if (element.contextValue === 'page' && element.pageData) {
            const usedCount = element.pageData.usedMeasures.length;
            const colsCount = element.pageData.usedColumns.length;
            return Promise.resolve([
                new MeasureItem(`✅ Medidas en Uso (${usedCount})`, vscode.TreeItemCollapsibleState.Collapsed, 'page_used_measures', undefined, element.pageData),
                new MeasureItem(`✅ Columnas en Uso (${colsCount})`, vscode.TreeItemCollapsibleState.Collapsed, 'page_used_columns', undefined, element.pageData)
            ]);
        }
        
        if (element.contextValue === 'page_used_measures' && element.pageData) {
            return Promise.resolve(element.pageData.usedMeasures.map(m =>
                new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m)
            ));
        }

        if (element.contextValue === 'page_used_columns' && element.pageData) {
            return Promise.resolve(element.pageData.usedColumns.map(c =>
                new MeasureItem(c.name, (c.dependencies.length > 0 || c.usedBy.length > 0) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'column_item', undefined, undefined, undefined, c)
            ));
        }

        if (element.contextValue === 'global_used') {
            return Promise.resolve(this.auditResult.globalUsedMeasures.map(m =>
                new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m)
            ));
        }

        if (element.contextValue === 'global_orphaned') {
            return Promise.resolve(this.auditResult.globalOrphanedMeasures.map(m =>
                new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m)
            ));
        }

        return this.getDependenciesNodes(element);
    }
}

export class TablesTreeProvider extends BaseTreeProvider {
    getChildren(element?: MeasureItem): Thenable<MeasureItem[]> {
        if (!this.auditResult) {
            return Promise.resolve([new MeasureItem('Ejecuta la auditoría para ver resultados', vscode.TreeItemCollapsibleState.None)]);
        }

        if (!element) {
             const tables = Object.values(this.auditResult.semanticModel.tables).sort((a,b)=>a.name.localeCompare(b.name));
             return Promise.resolve(tables.map(t => new MeasureItem(t.name, vscode.TreeItemCollapsibleState.Collapsed, 'table_item', undefined, undefined, undefined, undefined, t)));
        }

        if (element.contextValue === 'table_item' && element.tableData) {
            const t = element.tableData;
            return Promise.resolve([
                new MeasureItem(`Columnas (${t.columns.length})`, vscode.TreeItemCollapsibleState.Collapsed, 'table_columns', undefined, undefined, undefined, undefined, t),
                new MeasureItem(`Medidas (${t.measures.length})`, vscode.TreeItemCollapsibleState.Collapsed, 'table_measures', undefined, undefined, undefined, undefined, t)
            ]);
        }

        if (element.contextValue === 'table_columns' && element.tableData) {
            return Promise.resolve(element.tableData.columns.map(cName => {
                const c = this.auditResult!.semanticModel.columns[cName.toLowerCase()];
                return new MeasureItem(c.name, (c.dependencies.length > 0 || c.usedBy.length > 0) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'column_item', undefined, undefined, undefined, c);
            }));
        }

        if (element.contextValue === 'table_measures' && element.tableData) {
            return Promise.resolve(element.tableData.measures.map(mName => {
                const m = this.auditResult!.semanticModel.measures[mName.toLowerCase()];
                return new MeasureItem(m.name, (m.dependencies.length > 0 || m.usedBy.length > 0) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None, 'measure_item', m.filePath, undefined, m);
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
        public readonly tableData?: TableDefinition
    ) {
        super(label, collapsibleState);
        
        if (contextValue === 'measure_item' || contextValue === 'column_item' || contextValue === 'child_item' || contextValue === 'parent_item') {
            
            if (measureData) {
                this.iconPath = new vscode.ThemeIcon('symbol-variable');
                if (measureData.content) {
                    this.command = { command: 'pbip-lens.showMeasureDax', title: 'Ver DAX', arguments: [measureData.name, measureData.content] };
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
        } else {
            // Folders (pages_used, table_columns, etc)
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}
