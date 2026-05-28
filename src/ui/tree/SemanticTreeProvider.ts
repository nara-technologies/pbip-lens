import * as vscode from 'vscode';
import { SemanticGraph } from '../../core/graph/SemanticGraph';
import { NodeKinds, SemanticNode } from '../../core/models/CanonicalModel';

export type TreeItemNode = SemanticTreeItem | FolderTreeItem;

export class SemanticTreeProvider implements vscode.TreeDataProvider<TreeItemNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItemNode | undefined | void> =
        new vscode.EventEmitter<TreeItemNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItemNode | undefined | void> =
        this._onDidChangeTreeData.event;

    private graph: SemanticGraph | null = null;

    refresh(graph: SemanticGraph): void {
        this.graph = graph;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItemNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItemNode): Thenable<TreeItemNode[]> {
        if (!this.graph) {
            return Promise.resolve([]);
        }

        if (element) {
            if (element instanceof FolderTreeItem) {
                // Level 3: Child nodes within a subfolder
                const items = element.children.map((node) => new SemanticTreeItem(node));
                items.sort((a, b) => {
                    if (a.node.kind !== b.node.kind) {
                        return a.node.kind === NodeKinds.Column ? -1 : 1;
                    }
                    return a.node.name.localeCompare(b.node.name);
                });
                return Promise.resolve(items);
            }

            if (element instanceof SemanticTreeItem && element.node.kind === NodeKinds.Table) {
                // Level 2: Child nodes within a Table (O(1) lookup using parentTableIndex)
                const childrenNodes = this.graph.getChildrenByTable(element.node.id);

                const items: TreeItemNode[] = [];
                const folders = new Map<string, SemanticNode[]>();

                for (const node of childrenNodes) {
                    const displayFolder =
                        'displayFolder' in node
                            ? ((node as any).displayFolder as string)
                            : undefined;
                    if (displayFolder) {
                        if (!folders.has(displayFolder)) {
                            folders.set(displayFolder, []);
                        }
                        folders.get(displayFolder)!.push(node);
                    } else {
                        items.push(new SemanticTreeItem(node));
                    }
                }

                for (const [folderName, nodes] of folders.entries()) {
                    items.push(new FolderTreeItem(folderName, nodes));
                }

                // Sort: Folders first, then Columns, then Measures, sorted alphabetically
                items.sort((a, b) => {
                    const isAFolder = a instanceof FolderTreeItem;
                    const isBFolder = b instanceof FolderTreeItem;
                    if (isAFolder && !isBFolder) return -1;
                    if (!isAFolder && isBFolder) return 1;

                    if (isAFolder && isBFolder) {
                        return (a as FolderTreeItem).label.localeCompare(
                            (b as FolderTreeItem).label,
                        );
                    }

                    const aItem = a as SemanticTreeItem;
                    const bItem = b as SemanticTreeItem;
                    if (aItem.node.kind !== bItem.node.kind) {
                        return aItem.node.kind === NodeKinds.Column ? -1 : 1;
                    }
                    return aItem.node.name.localeCompare(bItem.node.name);
                });

                return Promise.resolve(items);
            }
            return Promise.resolve([]);
        } else {
            // Level 1: Root-level Table nodes
            const tables = this.graph.getNodesByKind(NodeKinds.Table);
            const items = tables.map((table) => new SemanticTreeItem(table));
            items.sort((a, b) => a.node.name.localeCompare(b.node.name));
            return Promise.resolve(items);
        }
    }
}

export class FolderTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly children: SemanticNode[],
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'folder';
    }
}

export class SemanticTreeItem extends vscode.TreeItem {
    constructor(public readonly node: SemanticNode) {
        super(
            node.name,
            node.kind === NodeKinds.Table
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None,
        );

        this.tooltip = node.qualifiedName;
        this.description = node.kind === NodeKinds.Table ? '' : node.kind;

        switch (node.kind) {
            case NodeKinds.Table:
                this.iconPath = new vscode.ThemeIcon('symbol-class');
                this.contextValue = 'table_item';
                break;
            case NodeKinds.Column:
                this.iconPath = new vscode.ThemeIcon('symbol-variable');
                this.contextValue = 'column_item';
                this.command = {
                    command: 'pbip-lens.openNodeDetails',
                    title: 'Abrir Detalles',
                    arguments: [node.id],
                };
                break;
            case NodeKinds.Measure:
                this.iconPath = new vscode.ThemeIcon('symbol-method');
                this.contextValue = 'measure_item';
                this.command = {
                    command: 'pbip-lens.openNodeDetails',
                    title: 'Abrir Detalles',
                    arguments: [node.id],
                };
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('symbol-property');
        }
    }
}
