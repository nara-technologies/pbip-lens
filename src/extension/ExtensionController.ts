import * as vscode from 'vscode';
import { NodeFileSystem } from '../infrastructure/adapters/NodeFileSystem';
import { VSCodeLogger } from '../infrastructure/adapters/VSCodeLogger';
import { SemanticGraph } from '../core/graph/SemanticGraph';
import { GraphQueries } from '../core/engine/GraphQueries';
import { PurgeEngine } from '../core/engine/PurgeEngine';
import { WebviewManager } from './WebviewManager';
import { AuditEngine } from '../core/engine/AuditEngine';
import { OrphanNodeRule } from '../core/rules/OrphanNodeRule';
import { MissingDescriptionRule } from '../core/rules/MissingDescriptionRule';
import { EngineFactory } from '../core/factories/EngineFactory';
import { SemanticTreeProvider } from '../ui/tree/SemanticTreeProvider';
import { AuditTreeProvider } from '../ui/tree/AuditTreeProvider';
import { NodeInspectorManager } from '../ui/NodeInspectorManager';
import { Logger } from '../core/utils/Logger';

declare function setTimeout(callback: Function, ms?: number): any;
declare function clearTimeout(timeoutId: any): void;

export class ExtensionController {
    private graph: SemanticGraph | null = null;
    private queries: GraphQueries | null = null;
    private webviewManager = new WebviewManager();
    private projectName: string = 'Unknown Project';
    private treeProvider = new SemanticTreeProvider();
    private auditTreeProvider = new AuditTreeProvider();
    private inspectorManager = new NodeInspectorManager();
    private fsAdapter = new NodeFileSystem();
    private loggerAdapter = new VSCodeLogger('PBIP Lens');
    private purgeEngine = new PurgeEngine(this.fsAdapter, this.loggerAdapter);
    private auditEngine = new AuditEngine(
        [new OrphanNodeRule(), new MissingDescriptionRule()],
        this.loggerAdapter
    );
    private lastRootPath: string = '';
    private isInternalMutation: boolean = false;
    private isAnalyzing: boolean = false;

    private async resolveProjectName(basePath: string): Promise<string> {
        try {
            const uri = vscode.Uri.file(basePath);
            const files = await vscode.workspace.fs.readDirectory(uri);
            const pbipFile = files.find(
                ([name, type]) => name.endsWith('.pbip') && type === vscode.FileType.File,
            );
            if (pbipFile) {
                return pbipFile[0].replace('.pbip', '');
            }
        } catch (error: any) {
            Logger.error(`Error reading the project directory: ${error.message}`);
        }
        // Fallback parser without relying on 'path' module.
        const normalized = basePath.replace(/\\/g, '/');
        const parts = normalized.split('/');
        return parts[parts.length - 1] || 'Unknown Project';
    }

    public registerCommands(context: vscode.ExtensionContext) {
        // Register TreeView providers.
        this.auditTreeProvider.setExtensionUri(context.extensionUri);
        vscode.window.registerTreeDataProvider('pbip-lens-semantic-tree', this.treeProvider);
        vscode.window.registerTreeDataProvider('pbip-lens-audit-tree', this.auditTreeProvider);

        // Command: Trigger workspace semantic model analysis
        const analyzeCommand = vscode.commands.registerCommand(
            'pbip-lens.analyzeWorkspace',
            async () => {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    vscode.window.showErrorMessage(
                        'PBIP Lens: There is no folder open in VS Code.',
                    );
                    return;
                }
                await this.runAnalysis(context, workspaceFolders[0].uri.fsPath);
            },
        );

        // Command: Open visual Dashboard UI
        const showUICommand = vscode.commands.registerCommand('pbip-lens.showUI', () => {
            if (!this.queries) {
                vscode.window.showWarningMessage(
                    'PBIP Lens: Run "Analyze Workspace" before opening the UI.',
                );
                return;
            }
            this.webviewManager.showPanel(context);
        });

        // Command: Open Node Inspector details panel
        const openNodeDetailsCommand = vscode.commands.registerCommand(
            'pbip-lens.openNodeDetails',
            (nodeId: string) => {
                if (this.queries) {
                    this.inspectorManager.showOrUpdateNode(nodeId, this.queries);
                } else {
                    vscode.window.showWarningMessage(
                        'PBIP Lens: You must analyze the workspace first.',
                    );
                }
            },
        );

        // Command: Purge orphan measures directly from source TMDL files
        const purgeNodeCommand = vscode.commands.registerCommand(
            'pbip-lens.purgeNode',
            async (nodeId: string, nodeName: string) => {
                if (!this.queries) {
                    vscode.window.showWarningMessage(
                        'PBIP Lens: You must analyze the workspace first.',
                    );
                    return;
                }

                const nodeDetails = this.queries.getNodeDetails(nodeId);
                if (!nodeDetails || nodeDetails.kind !== 'measure' || !nodeDetails.isOrphan) {
                    vscode.window.showWarningMessage(
                        'PBIP Lens: Only orphan measures can be purged.',
                    );
                    return;
                }

                // Verify if the workspace has active git integration.
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
                const hasGit = await this.isGitTracked(workspaceRoot);

                let confirmed: string | undefined;

                if (!hasGit) {
                    // Present high-visibility warning if git is not initialized (Cancel is the default action).
                    confirmed = await vscode.window.showWarningMessage(
                        `Git not detected in this project.\n\n` +
                            `Deleting "${nodeName}" CANNOT be undone permanently with Ctrl+Z ` +
                            `once you close VS Code. It is highly recommended to initialize Git ` +
                            `(git init) and commit before proceeding.`,
                        { modal: true },
                        'Delete anyway',
                    );
                    if (confirmed !== 'Delete anyway') {
                        return;
                    }
                } else {
                    // Present standard delete confirmation dialog.
                    confirmed = await vscode.window.showWarningMessage(
                        `Do you want to physically delete the measure "${nodeName}" from the model?\n` +
                            `Git is active — you can undo with "git checkout" if needed.`,
                        { modal: true },
                        'Purge',
                    );
                    if (confirmed !== 'Purge') {
                        return;
                    }
                }

                // 1. Set concurrency protection lock flag.
                this.isInternalMutation = true;

                try {
                    // 2. Perform physical deletion in disk.
                    const success = await this.purgeEngine.deleteMeasure(nodeDetails);

                    if (success) {
                        vscode.window.showInformationMessage(`PBIP Lens: Measure purged.`);
                        this.inspectorManager.closePanel();

                        // Update local semantic graph within transactional isolation.
                        if (this.graph) {
                            this.graph.beginTransaction();
                            this.graph.removeNode(nodeDetails.id);
                            this.graph.commit();
                        }

                        // Trigger UI and TreeView refreshes.
                        if (this.graph) {
                            this.treeProvider.refresh(this.graph);
                        }
                        if (this.queries) {
                            this.auditTreeProvider.refresh(this.queries);
                        }
                        this.webviewManager.notifyStateUpdated();
                    } else {
                        vscode.window.showErrorMessage(
                            `PBIP Lens: Could not delete measure "${nodeName}".`,
                        );
                    }
                } finally {
                    // 2. Release lock flag under final block.
                    setTimeout(() => {
                        this.isInternalMutation = false;
                    }, 500);
                }
            },
        );

        const showLogsCommand = vscode.commands.registerCommand('pbip-lens.showLogs', () => {
            Logger.show();
        });

        const refreshAnalysisCommand = vscode.commands.registerCommand(
            'pbip-lens.refreshAnalysis',
            async () => {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
                if (workspaceRoot) {
                    await this.runAnalysis(context, workspaceRoot);
                }
            },
        );

        let debounceTimer: any;
        const documentObserver = vscode.workspace.onDidChangeTextDocument((event) => {
            // Ignore file watcher events triggered by our own physical mutations.
            if (this.isInternalMutation) return;

            // Only monitor .tmdl and .dax files.
            if (
                event.document.languageId === 'dax' ||
                event.document.languageId === 'tmdl' ||
                event.document.uri.fsPath.endsWith('.tmdl')
            ) {
                if (debounceTimer) clearTimeout(debounceTimer);

                // Debounce watcher events to prevent thrashing during fast sequential writes.
                debounceTimer = setTimeout(() => {
                    Logger.info(
                        `External change/Ctrl+Z detected in ${event.document.fileName}. Synchronizing graph...`,
                    );

                    const folders = vscode.workspace.workspaceFolders;
                    const workspaceRoot =
                        folders && folders.length > 0 ? folders[0].uri.fsPath : '';

                    if (workspaceRoot) {
                        this.runAnalysis(context, workspaceRoot); // Re-trigger analysis in the background.
                    }
                }, 800);
            }
        });

        // Initialize official logger.
        Logger.info('PBIP Lens: Activating extension...');

        context.subscriptions.push(
            analyzeCommand,
            showUICommand,
            openNodeDetailsCommand,
            purgeNodeCommand,
            showLogsCommand,
            refreshAnalysisCommand,
            documentObserver,
        );
    }

    /**
     * Core of the analysis pipeline. Extracted from the analyzeWorkspace command
     * to allow invoking it with a real `await` from purgeNode (executeCommand
     * does not wait for the asynchronous handler, it only queues the command).
     */
    private async runAnalysis(context: vscode.ExtensionContext, rootPath: string): Promise<void> {
        if (this.isAnalyzing) {
            Logger.warn('Analysis already in progress. Ignoring overlapping request.');
            return;
        }
        this.isAnalyzing = true;
        try {
            const engine = EngineFactory.createSemanticEngine(this.fsAdapter, this.loggerAdapter);

            vscode.window.showInformationMessage('PBIP Lens: Starting project analysis...');
            await engine.processProject(rootPath);

            this.graph = engine.graph;
            this.queries = new GraphQueries(this.graph, this.auditEngine);
            this.projectName = await this.resolveProjectName(rootPath);

            this.webviewManager.setProjectName(this.projectName);
            this.webviewManager.setQueries(this.queries);
            this.webviewManager.showPanel(context);
            this.webviewManager.notifyStateUpdated();

            await vscode.commands.executeCommand('setContext', 'pbip-lens.isAudited', true);

            this.treeProvider.refresh(this.graph);
            this.auditTreeProvider.refresh(this.queries);

            const metrics = this.queries.getMetricsSummary();
            vscode.window.showInformationMessage(
                `PBIP Lens: Analysis completed. Metrics: ${metrics.totalMeasures} measures, ${metrics.totalColumns} columns, ${metrics.totalVisuals} visuals.`,
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(`PBIP Lens Error: ${error.message}`);
            this.webviewManager.notifyError(error.message);
            Logger.error(`PBIP Lens Engine Error: ${error.message}`);
        } finally {
            this.isAnalyzing = false;
        }
    }

    /**
     * Detects if the workspace root directory has Git initialized.
     * Searches for the presence of the .git folder — compatible with normal repos and submodules.
     */
    private async isGitTracked(rootPath: string): Promise<boolean> {
        if (!rootPath) return false;
        try {
            const gitUri = vscode.Uri.file(rootPath + '/.git');
            await vscode.workspace.fs.stat(gitUri);
            return true;
        } catch {
            return false;
        }
    }
    /**
     * Releases resources when the extension is deactivated.
     */
    public dispose(): void {
        this.webviewManager.dispose();
        this.graph = null;
        this.queries = null;
    }
}
