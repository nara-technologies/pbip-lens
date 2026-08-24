import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GraphQueries } from '../core/engine/GraphQueries';

/**
 * Manages the lifecycle of the PBIP Lens WebviewPanel.
 * Reads local assets (HTML/CSS/JS) from disk and sets up the bidirectional IPC bridge.
 */
export class WebviewManager {
    private panel: vscode.WebviewPanel | null = null;
    private queries: GraphQueries | null = null;
    private projectName: string = '';

    /**
     * Updates the GraphQueries reference when the graph is modified.
     */
    public setQueries(queries: GraphQueries): void {
        this.queries = queries;
    }

    /**
     * Updates the project display name.
     */
    public setProjectName(name: string): void {
        this.projectName = name;
    }

    /**
     * Notifies the Webview that the backend state has been updated.
     * The frontend responds by cleaning its UI and requesting fresh metrics.
     */
    public notifyStateUpdated(): void {
        if (this.panel) {
            this.panel.webview.postMessage({ command: 'stateUpdated' });
        }
    }

    /**
     * Notifies the Webview that analysis failed, unblocking the UI "Updating..." state.
     */
    public notifyError(message: string): void {
        if (this.panel) {
            this.panel.webview.postMessage({ command: 'analysisFailed', error: message });
        }
    }

    /**
     * Creates or reveals the WebviewPanel of PBIP Lens.
     */
    public showPanel(context: vscode.ExtensionContext): void {
        // If the panel already exists, reveal it.
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Active);
            return;
        }

        const dashboardPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'dashboard');
        const imagesPath = vscode.Uri.joinPath(context.extensionUri, 'images');

        this.panel = vscode.window.createWebviewPanel(
            'pbipLensUI',
            'PBIP Lens',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [dashboardPath, imagesPath],
            },
        );

        this.panel.webview.html = this.getHtmlContent(this.panel.webview, dashboardPath, imagesPath);

        // IPC Bridge: Message routing from Webview to Extension Host
        this.panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'getMetrics':
                        this.handleGetMetrics();
                        return;

                    case 'searchNodes':
                        this.handleSearchNodes(message.query, message.limit);
                        return;

                    case 'getOrphans':
                        this.handleGetOrphans();
                        return;

                    case 'refreshProject':
                        vscode.commands.executeCommand('pbip-lens.refreshAnalysis');
                        return;
                }
            },
            undefined,
            context.subscriptions,
        );

        // Nullify panel instance upon disposal.
        this.panel.onDidDispose(
            () => {
                this.panel = null;
            },
            undefined,
            context.subscriptions,
        );
    }

    /**
     * Responds to the Webview with the graph's summary metrics.
     */
    private handleGetMetrics(): void {
        if (!this.panel || !this.queries) {
            return;
        }

        const data = this.queries.getMetricsSummary() as any;
        data.projectName = this.projectName;
        this.panel.webview.postMessage({
            command: 'metricsData',
            data,
        });
    }

    /**
     * Responds to the Webview with the node search results.
     */
    private handleSearchNodes(query: string, limit?: number): void {
        if (!this.panel || !this.queries) {
            return;
        }

        const data = this.queries.searchNodes(query, limit ?? 20);
        this.panel.webview.postMessage({
            command: 'searchResultData',
            data,
        });
    }

    /**
     * Responds to the Webview with the list of orphan nodes.
     */
    private handleGetOrphans(): void {
        if (!this.panel || !this.queries) {
            return;
        }

        const data = this.queries.getOrphans();
        this.panel.webview.postMessage({
            command: 'orphansData',
            data,
        });
    }

     /**
      * Reads index.html from disk and replaces template variables
      * with secure Webview resource URIs and cryptographic nonces.
      */
    private getHtmlContent(webview: vscode.Webview, dashboardUri: vscode.Uri, imagesUri: vscode.Uri): string {
        // Generate secure VS Code Webview resource URIs for local assets.
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(dashboardUri, 'styles.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(dashboardUri, 'main.js'));
        const logoDarkUri = webview.asWebviewUri(vscode.Uri.joinPath(imagesUri, 'logo-dark.svg'));
        const logoLightUri = webview.asWebviewUri(vscode.Uri.joinPath(imagesUri, 'logo-light.svg'));
        const cspSource = webview.cspSource;
        const nonce = this.generateNonce();
        const pkg = require('../../package.json');

        // Read dashboard HTML template from disk.
        const htmlPath = path.join(dashboardUri.fsPath, 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf-8');

        // Inject CSP, script paths, styling, and images into the HTML template.
        html = html.replace(/\{\{stylesUri\}\}/g, stylesUri.toString());
        html = html.replace(/\{\{scriptUri\}\}/g, scriptUri.toString());
        html = html.replace(/\{\{logoDarkUri\}\}/g, logoDarkUri.toString());
        html = html.replace(/\{\{logoLightUri\}\}/g, logoLightUri.toString());
        html = html.replace(/\{\{cspSource\}\}/g, cspSource);
        html = html.replace(/\{\{nonce\}\}/g, nonce);
        html = html.replace(/\{\{version\}\}/g, pkg.version);

        return html;
    }

    /**
     * Generates a cryptographically secure 32-character nonce for CSP.
     */
    private generateNonce(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Releases resources when the extension is deactivated.
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = null;
        }
    }
}
