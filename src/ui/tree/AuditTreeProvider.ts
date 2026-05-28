import * as vscode from 'vscode';
import { GraphQueries, SemanticNodeDTO } from '../../core/engine/GraphQueries';

export type AuditTreeItemNode = AuditRootItem | AuditNodeItem;

export class AuditTreeProvider implements vscode.TreeDataProvider<AuditTreeItemNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<AuditTreeItemNode | undefined | void> =
        new vscode.EventEmitter<AuditTreeItemNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<AuditTreeItemNode | undefined | void> =
        this._onDidChangeTreeData.event;

    private queries: GraphQueries | null = null;
    private extensionUri: vscode.Uri | null = null;

    setExtensionUri(uri: vscode.Uri): void {
        this.extensionUri = uri;
    }

    private getIconUri(
        lightName: string,
        darkName?: string,
    ): { light: vscode.Uri; dark: vscode.Uri } | undefined {
        if (!this.extensionUri) {
            return undefined;
        }
        const baseUri = vscode.Uri.joinPath(this.extensionUri, 'images', 'icons');
        return {
            light: vscode.Uri.joinPath(baseUri, lightName),
            dark: vscode.Uri.joinPath(baseUri, darkName || lightName),
        };
    }

    refresh(queries: GraphQueries): void {
        this.queries = queries;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AuditTreeItemNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: AuditTreeItemNode): Thenable<AuditTreeItemNode[]> {
        if (!this.queries) {
            return Promise.resolve([]);
        }

        if (element) {
            if (element instanceof AuditRootItem) {
                // Level 2: Child nodes representing measures within selected audit category
                let nodes: SemanticNodeDTO[] = [];
                if (element.type === 'orphans') {
                    nodes = this.queries.getOrphans().filter((node) => node.kind === 'measure');
                } else if (element.type === 'active') {
                    nodes = this.queries
                        .getActiveMeasures()
                        .filter((node) => node.kind === 'measure');
                }

                const items = nodes.map((node) => new AuditNodeItem(node));
                items.sort((a, b) => a.node.name.localeCompare(b.node.name));
                return Promise.resolve(items);
            }
            return Promise.resolve([]);
        } else {
            // Level 1: Fixed root-level audit category folders
            return Promise.resolve([
                new AuditRootItem(
                    'Orphan Measures',
                    'orphans',
                    this.getIconUri('folder-orphan.svg'),
                ),
                new AuditRootItem('Measures in Use', 'active', this.getIconUri('folder-used.svg')),
            ]);
        }
    }
}

export class AuditRootItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly type: 'orphans' | 'active',
        public readonly iconOverride?:
            | { light: vscode.Uri; dark: vscode.Uri }
            | vscode.ThemeIcon
            | vscode.Uri,
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);

        if (iconOverride) {
            this.iconPath = iconOverride;
        } else if (type === 'orphans') {
            this.iconPath = new vscode.ThemeIcon(
                'warning',
                new vscode.ThemeColor('testing.iconFailed'),
            );
        } else {
            this.iconPath = new vscode.ThemeIcon(
                'pass',
                new vscode.ThemeColor('testing.iconPassed'),
            );
        }
    }
}

export class AuditNodeItem extends vscode.TreeItem {
    constructor(public readonly node: SemanticNodeDTO) {
        super(node.name, vscode.TreeItemCollapsibleState.None);

        this.tooltip = node.qualifiedName;
        this.description = node.kind;
        this.contextValue = 'measure_item';

        this.iconPath = new vscode.ThemeIcon('symbol-method');
        this.command = {
            command: 'pbip-lens.openNodeDetails',
            title: 'Open Details',
            arguments: [node.id],
        };
    }
}
