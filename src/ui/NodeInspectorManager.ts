import * as vscode from 'vscode';
import { GraphQueries, SemanticNodeDetailDTO } from '../core/engine/GraphQueries';

export class NodeInspectorManager {
    private currentPanel: vscode.WebviewPanel | undefined;

    public async showOrUpdateNode(nodeId: string, queries: GraphQueries | null) {
        if (!queries) {
            vscode.window.showWarningMessage(
                'PBIP Lens: No model context. Scan the workspace first.',
            );
            return;
        }

        const nodeDetails = queries.getNodeDetails(nodeId);
        if (!nodeDetails) {
            vscode.window.showErrorMessage(`Node not found: ${nodeId}`);
            return;
        }

        const impact = queries.getNodeImpact(nodeId);
        const violations = queries.getNodeViolations(nodeId);
        const enrichedPayload = { ...nodeDetails, impact, violations };

        if (this.currentPanel) {
            this.currentPanel.reveal(vscode.ViewColumn.Active);
            this.currentPanel.webview.postMessage({ command: 'renderNode', data: enrichedPayload });
        } else {
            this.currentPanel = vscode.window.createWebviewPanel(
                'pbipLensNodeInspector',
                'Inspector de Nodo',
                vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                },
            );

            this.currentPanel.webview.html = this.getWebviewContent();

            this.currentPanel.onDidDispose(() => {
                this.currentPanel = undefined;
            });

            this.currentPanel.webview.onDidReceiveMessage((message) => {
                if (message.command === 'navigate') {
                    this.showOrUpdateNode(message.nodeId, queries);
                } else if (message.command === 'purgeNode') {
                    // Forward action to the ExtensionController registered command
                    vscode.commands.executeCommand(
                        'pbip-lens.purgeNode',
                        message.nodeId,
                        message.nodeName,
                    );
                }
            });

            setTimeout(() => {
                this.currentPanel?.webview.postMessage({
                    command: 'renderNode',
                    data: enrichedPayload,
                });
            }, 100);
        }
    }

    public closePanel(): void {
        if (this.currentPanel) {
            this.currentPanel.dispose();
            this.currentPanel = undefined;
        }
    }

    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inspector de Nodo</title>
    <style>
        :root {
            --bg-base: var(--vscode-editor-background, #1e1e1e);
            --bg-card: var(--vscode-editorWidget-background, var(--vscode-sideBar-background, #2d2d2d));
            --text-primary: var(--vscode-editor-foreground, #e5e7eb);
            --text-secondary: var(--vscode-descriptionForeground, #9ca3af);
            --border: var(--vscode-widget-border, var(--vscode-panelSection-border, #404040));
        }
        body {
            background-color: var(--bg-base);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 20px;
            margin: 0;
            line-height: 1.5;
        }
        .main-container {
            border-radius: 8px;
            padding: 20px;
            transition: box-shadow 0.3s ease, border 0.3s ease;
        }
        .glow-orphan {
            border: 1px solid rgba(239, 68, 68, 0.3);
            box-shadow: 0 0 20px rgba(239, 68, 68, 0.05);
        }
        .glow-active {
            border: 1px solid rgba(34, 197, 94, 0.3);
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.05);
        }
        .header {
            margin-bottom: 24px;
        }
        .breadcrumbs {
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }
        .title-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .title {
            font-size: 24px;
            font-weight: 600;
            margin: 0;
        }
        .badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-orphan { background-color: #ef4444; color: #fff; }
        .badge-active { background-color: #10b981; color: #fff; }
        .badge-kind { background-color: var(--bg-card); border: 1px solid var(--border); color: var(--text-secondary); }
        .badge-visual-inline { background-color: #3b82f6; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px; display: inline-block; vertical-align: middle; font-weight: bold; }
        .badge-base {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-right: 6px;
        }
        .badge-visual-value {
            background-color: rgba(59, 130, 246, 0.15);
            border: 1px solid #3b82f6;
            color: #60a5fa;
        }
        .badge-visual-calc, .badge-visual-calculation {
            background-color: rgba(168, 85, 247, 0.15);
            border: 1px solid #a855f7;
            color: #c084fc;
        }
        .badge-visual-filter {
            background-color: rgba(249, 115, 22, 0.15);
            border: 1px solid #f97316;
            color: #fb923c;
        }
        .badge-visual-security {
            background-color: rgba(239, 68, 68, 0.15);
            border: 1px solid #ef4444;
            color: #fca5a5;
        }
        
        /* Purge Button: Luxury Minimal Destructive */
        .btn-danger {
            padding: 6px 14px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            background-color: transparent;
            color: #ef4444;
            border: 1px solid #ef4444;
            transition: background-color 0.2s ease, color 0.2s ease;
            margin-left: auto;
        }
        .btn-danger:hover {
            background-color: #ef4444;
            color: #fff;
        }
        .btn-danger:active {
            background-color: #dc2626;
            border-color: #dc2626;
        }
        .grid-2 {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 16px;
        }
        
        .section {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 20px;
            min-width: 0;
            overflow-wrap: break-word;
        }
        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-top: 0;
            margin-bottom: 12px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        /* ---- Impact Badge ---- */
        .impact-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 14px 0 20px 0;
        }
        .impact-label {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-secondary);
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }
        .impact-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 3px 10px;
            border-radius: 12px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            border: 1px solid;
        }
        .impact-None  { background: rgba(100,116,139,0.12); color:#94a3b8;  border-color:rgba(100,116,139,0.3); }
        .impact-Low   { background: rgba(56,189,248,0.12);  color:#38bdf8;  border-color:rgba(56,189,248,0.3);  }
        .impact-Medium{ background: rgba(245,158,11,0.12);  color:#f59e0b;  border-color:rgba(245,158,11,0.3);  }
        .impact-High  { background: rgba(239,68,68,0.12);   color:#ef4444;  border-color:rgba(239,68,68,0.3);   }
        .impact-breakdown {
            font-size: 11px;
            color: var(--text-secondary);
        }

        /* ---- Linter Findings ---- */
        .linter-card {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 16px;
        }
        .linter-ok {
            font-size: 13px;
            color: #10b981;
            font-weight: 500;
        }
        .violation-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid var(--border);
        }
        .violation-item:last-child { border-bottom: none; }
        .violation-severity {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 10px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            white-space: nowrap;
            flex-shrink: 0;
        }
        .sev-Low      { background:rgba(56,189,248,0.12);  color:#38bdf8;  border:1px solid rgba(56,189,248,0.3);  }
        .sev-Medium   { background:rgba(245,158,11,0.12);  color:#f59e0b;  border:1px solid rgba(245,158,11,0.3);  }
        .sev-High     { background:rgba(249,115,22,0.12);  color:#f97316;  border:1px solid rgba(249,115,22,0.3);  }
        .sev-Critical { background:rgba(239,68,68,0.12);   color:#ef4444;  border:1px solid rgba(239,68,68,0.3);   }
        .violation-msg { font-size: 13px; line-height: 1.4; color: var(--text-primary); }
        
        .usage-badge {
            display: inline-block;
            background-color: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.2);
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            margin-right: 6px;
            margin-bottom: 6px;
            text-transform: uppercase;
        }
        .usage-badge.visual-badge {
            background-color: rgba(16, 185, 129, 0.1);
            color: #10b981;
            border-color: rgba(16, 185, 129, 0.2);
        }
        .usage-badge.measure-badge {
            background-color: rgba(245, 158, 11, 0.1);
            color: #f59e0b;
            border-color: rgba(245, 158, 11, 0.2);
        }
        .usage-badge.relationship-badge {
            background-color: rgba(168, 85, 247, 0.1);
            color: #c084fc;
            border-color: rgba(168, 85, 247, 0.2);
        }

        /* Description Box */
        .description-box {
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-left: 4px solid var(--vscode-infoIcon-foreground, var(--vscode-textLink-foreground, #3b82f6));
            border-radius: 4px;
            padding: 10px 14px;
            margin-bottom: 20px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            font-size: 13px;
            color: var(--text-primary);
        }
        .description-icon {
            font-size: 14px;
            flex-shrink: 0;
            margin-top: 1px;
        }
        .description-text {
            margin: 0;
            line-height: 1.4;
        }

        /* Model Relationships Diagram */
        .rel-diagram-container {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding: 10px 0;
        }
        .rel-diagram-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        .rel-node-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        .rel-box-title {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
        }
        .rel-box {
            background-color: var(--bg-card);
            border: 1px solid var(--vscode-editorWidget-border, var(--border));
            border-radius: 6px;
            padding: 10px 16px;
            min-width: 150px;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 2px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            transition: border-color 0.2s ease;
        }
        .rel-box:hover {
            border-color: var(--vscode-textLink-foreground, #3b82f6);
        }
        .rel-box-from {
            border-left: 3px solid var(--vscode-textLink-foreground, #3b82f6);
        }
        .rel-box-to {
            border-left: 3px solid var(--vscode-symbolIcon-interfaceForeground, #10b981);
        }
        .rel-table-name {
            font-weight: 600;
            font-size: 13px;
            color: var(--text-primary);
        }
        .rel-column-name {
            font-family: Consolas, monospace;
            font-size: 11px;
            color: var(--vscode-textLink-foreground, #3b82f6);
        }
        .rel-connector {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 120px;
            justify-content: center;
        }
        .rel-connector-line {
            flex-grow: 1;
            height: 1px;
            background-color: var(--vscode-editorWidget-border, var(--border));
        }
        .rel-arrow-text {
            font-size: 11px;
            font-weight: 600;
            color: var(--text-secondary);
            background-color: var(--bg-base);
            padding: 2px 8px;
            border: 1px solid var(--vscode-editorWidget-border, var(--border));
            border-radius: 12px;
            white-space: nowrap;
        }
        
        .list-container {
            margin: 0;
            padding-left: 20px;
        }
        .list-container li {
            margin-bottom: 4px;
        }
        
        pre, code, pre span {
            background: transparent !important;
            background-color: transparent !important;
        }
        pre {
            background-color: #0d1117 !important; /* Deep Carbon Gray */
            color: #f8fafc !important; /* Bright White base text */
            padding: 16px;
            border-radius: 6px;
            overflow-x: auto;
            margin: 0;
            font-family: Consolas, 'Courier New', monospace;
            font-size: 14px;
        }
        pre code {
            color: #f8fafc !important; 
            background: transparent !important;
        }
        .dax-comment { color: #5c7e60 !important; font-style: italic; } /* Muted Olive Green */
        .dax-string { color: #f59e0b !important; } /* Amber */
        .dax-table { color: #fbbf24 !important; } /* Orange/Gold */
        .dax-keyword { color: #38bdf8 !important; font-weight: bold; } /* Cyan */
        .dax-number { color: #a78bfa !important; } /* Amethyst Purple */
        
        .lineage-list {
            list-style: none;
            margin: 0;
            padding: 0;
            max-height: 200px;
            overflow-y: auto;
        }
        .lineage-list::-webkit-scrollbar {
            width: 6px;
        }
        .lineage-list::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.1);
            border-radius: 4px;
        }
        .lineage-list::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background, rgba(255,255,255,0.1));
            border-radius: 4px;
        }
        .lineage-list::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground, rgba(255,255,255,0.2));
        }
        .lineage-item {
            padding: 8px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            font-size: 0.85rem;
            transition: background-color 0.2s;
        }
        .lineage-item:last-child {
            border-bottom: none;
        }
        .lineage-item:hover {
            background-color: rgba(255,255,255,0.05);
        }
        .lineage-name {
            font-weight: 600;
            color: var(--text-primary);
        }
        .lineage-type {
            color: var(--text-secondary);
        }
        
        .dax-container {
            position: relative;
            background-color: #0d1117;
            border: 1px solid var(--border);
            border-radius: 6px;
            margin-top: 8px;
            overflow: hidden;
        }
        .dax-code-wrapper {
            max-height: 6em;
            overflow: hidden;
            position: relative;
            transition: max-height 0.25s ease-out;
        }
        .dax-container.dax-expanded .dax-code-wrapper {
            max-height: none;
        }
        .dax-fade-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2em;
            background: linear-gradient(to bottom, transparent, #0d1117);
            pointer-events: none;
        }
        .dax-container.dax-expanded .dax-fade-overlay {
            display: none;
        }
        .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-primary);
            width: 28px;
            height: 28px;
            cursor: pointer;
            z-index: 10;
            transition: background-color 0.2s, border-color 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
        }
        .copy-btn:hover {
            background: rgba(255, 255, 255, 0.15);
            border-color: var(--text-secondary);
        }
        .expand-btn {
            position: absolute;
            bottom: 8px;
            right: 8px;
            background: rgba(13, 17, 23, 0.8);
            border: 1px solid var(--border);
            border-radius: 4px;
            color: var(--text-secondary);
            padding: 4px 8px;
            cursor: pointer;
            font-size: 11px;
            z-index: 10;
            transition: background-color 0.2s, color 0.2s;
            user-select: none;
        }
        .expand-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
        }
        .dax-container pre {
            padding-right: 48px;
            padding-bottom: 32px;
        }

        /* ── Theme Adaptations (vscode-light) ───────────────────────── */
        body.vscode-light {
            --bg-base: var(--vscode-editor-background, #ffffff);
            --bg-card: var(--vscode-editorWidget-background, #f3f3f3);
            --text-primary: var(--vscode-editor-foreground, #333333);
            --text-secondary: var(--vscode-descriptionForeground, #666666);
            --border: var(--vscode-widget-border, var(--vscode-panelSection-border, #e5e7eb));
        }

        .vscode-light .badge-visual-value {
            background-color: rgba(59, 130, 246, 0.08);
            border-color: #3b82f6;
            color: #1d4ed8;
        }
        .vscode-light .badge-visual-calc, .vscode-light .badge-visual-calculation {
            background-color: rgba(168, 85, 247, 0.08);
            border-color: #a855f7;
            color: #7e22ce;
        }
        .vscode-light .badge-visual-filter {
            background-color: rgba(249, 115, 22, 0.08);
            border-color: #f97316;
            color: #c2410c;
        }
        .vscode-light .badge-visual-security {
            background-color: rgba(239, 68, 68, 0.08);
            border-color: #ef4444;
            color: #b91c1c;
        }

        .vscode-light .impact-None  { background:rgba(100,116,139,0.08); color:#475569; border-color:rgba(100,116,139,0.2); }
        .vscode-light .impact-Low   { background:rgba(14,165,233,0.08);  color:#0369a1; border-color:rgba(14,165,233,0.2); }
        .vscode-light .impact-Medium{ background:rgba(217,119,6,0.08);   color:#b45309; border-color:rgba(217,119,6,0.2); }
        .vscode-light .impact-High  { background:rgba(220,38,38,0.08);   color:#b91c1c; border-color:rgba(220,38,38,0.2); }

        .vscode-light .usage-badge {
            background-color: rgba(14, 165, 233, 0.08);
            color: #0369a1;
            border-color: rgba(14, 165, 233, 0.2);
        }
        .vscode-light .usage-badge.visual-badge {
            background-color: rgba(22, 163, 74, 0.08);
            color: #15803d;
            border-color: rgba(22, 163, 74, 0.2);
        }
        .vscode-light .usage-badge.measure-badge {
            background-color: rgba(217, 119, 6, 0.08);
            color: #b45309;
            border-color: rgba(217, 119, 6, 0.2);
        }
        .vscode-light .usage-badge.relationship-badge {
            background-color: rgba(168, 85, 247, 0.08);
            color: #7e22ce;
            border-color: rgba(168, 85, 247, 0.2);
        }

        .vscode-light pre {
            background-color: var(--vscode-textBlockCode-background, #f6f8fa) !important;
            color: var(--vscode-editor-foreground, #24292f) !important;
        }
        .vscode-light pre code {
            color: var(--vscode-editor-foreground, #24292f) !important;
        }
        .vscode-light .dax-container {
            background-color: var(--vscode-textBlockCode-background, #f6f8fa);
        }
        .vscode-light .dax-fade-overlay {
            background: linear-gradient(to bottom, transparent, var(--vscode-textBlockCode-background, #f6f8fa));
        }

        .vscode-light .dax-comment { color: #008000 !important; }
        .vscode-light .dax-string { color: #a31515 !important; }
        .vscode-light .dax-table { color: #7a3e00 !important; }
        .vscode-light .dax-keyword { color: #0000ff !important; font-weight: bold; }
        .vscode-light .dax-number { color: #7038a8 !important; }

        .vscode-light .lineage-item {
            border-bottom: 1px solid var(--border);
        }
        .vscode-light .lineage-item:hover {
            background-color: var(--vscode-list-hoverBackground, rgba(0,0,0,0.03));
        }
        .vscode-light .copy-btn {
            background: var(--vscode-button-secondaryBackground, rgba(0, 0, 0, 0.05));
            color: var(--vscode-button-secondaryForeground, var(--text-primary));
        }
        .vscode-light .copy-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground, rgba(0, 0, 0, 0.1));
        }
        .vscode-light .expand-btn {
            background: var(--vscode-textBlockCode-background, #f6f8fa);
        }
    </style>
</head>
<body>
    <div id="app">Cargando...</div>

    <script>
        const vscode = acquireVsCodeApi();

        const copySvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>';
        const checkSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;"><polyline points="20 6 9 17 4 12"></polyline></svg>';

        let currentDaxExpression = '';

        function copyDaxToClipboard() {
            if (!currentDaxExpression) return;
            navigator.clipboard.writeText(currentDaxExpression).then(() => {
                const btn = document.getElementById('dax-copy-btn');
                if (btn) {
                    btn.innerHTML = checkSvg;
                    setTimeout(() => {
                        btn.innerHTML = copySvg;
                    }, 2000);
                }
            }).catch(err => {
                console.error('Error al copiar: ', err);
            });
        }

        function toggleDaxExpand() {
            const container = document.getElementById('dax-container');
            const btn = document.getElementById('dax-expand-btn');
            if (container && btn) {
                const isExpanded = container.classList.toggle('dax-expanded');
                if (isExpanded) {
                    btn.innerHTML = 'Colapsar ▲';
                } else {
                    btn.innerHTML = 'Expandir ▼';
                }
            }
        }

        function adjustDaxLayout() {
            const wrapper = document.getElementById('dax-code-wrapper');
            const expandBtn = document.getElementById('dax-expand-btn');
            const fadeOverlay = document.getElementById('dax-fade-overlay');
            if (wrapper && expandBtn && fadeOverlay) {
                setTimeout(() => {
                    if (wrapper.scrollHeight <= wrapper.clientHeight + 8) {
                        expandBtn.style.display = 'none';
                        fadeOverlay.style.display = 'none';
                    } else {
                        expandBtn.style.display = 'block';
                        fadeOverlay.style.display = 'block';
                    }
                }, 50);
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'renderNode') {
                render(message.data);
            }
        });

        // Cache reference to the active node being inspected for purge actions
        let currentNodeData = null;

        function highlightDAX(code) {
            if (!code) return '';
            
            // 1. Escape HTML special characters
            let safeCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            
            // 2. Lexer tokenizer regex matching token precedence hierarchy
            // Group 1: Multi-line comments
            // Group 2: Single-line/inline comments
            // Group 3: String literals
            // Group 4: Single-quoted table names
            // Group 5: Numeric constants
            // Group 6: Reserved DAX keywords & functions
            const tokenizer = /(\\/\\*[\\s\\S]*?\\*\\/)|((?:\\/\\/|--).*$)|("[^"]*")|('[^']*')|\\b(\\d+(?:\\.\\d+)?)\\b|\\b(VAR|RETURN|CALCULATE|SUM|MIN|MAX|DATE|QUOTIENT|MOD|YEAR|FORMAT|UPPER|LEFT|MID|LEN|FILTER|SWITCH|SELECTEDVALUE|IF|ISBLANK|BLANK|TRUE|FALSE|DIVIDE|COUNTROWS|VALUES|CONTAINS)\\b/gim;
            
            // 3. Single-pass token wrapping in O(N) time complexity
            return safeCode.replace(tokenizer, (match, mComment, lComment, str, tbl, num, keyword) => {
                if (mComment) return \`<span class="dax-comment">\${mComment}</span>\`;
                if (lComment) return \`<span class="dax-comment">\${lComment}</span>\`;
                if (str) return \`<span class="dax-string">\${str}</span>\`;
                if (tbl) return \`<span class="dax-table">\${tbl}</span>\`;
                if (num) return \`<span class="dax-number">\${num}</span>\`;
                if (keyword) return \`<span class="dax-keyword">\${keyword.toUpperCase()}</span>\`;
                return match; // Return unmodified base text
            });
        }

        function getKindIcon(id) {
            const kindMatch = id.match(/^([^:]+):/);
            if (!kindMatch) return '[?]';
            const kind = kindMatch[1].toLowerCase();
            switch (kind) {
                case 'measure': return '<span style="color:#f59e0b; font-weight:bold;">[M]</span>';
                case 'column': return '<span style="color:#38bdf8; font-weight:bold;">[C]</span>';
                case 'table': return '<span style="color:#fbbf24; font-weight:bold;">[T]</span>';
                case 'visual': return '<span style="color:#10b981; font-weight:bold;">[V]</span>';
                default: return \`<span style="color:var(--text-secondary); font-weight:bold;">[\${kind[0].toUpperCase()}]</span>\`;
            }
        }

        function getCleanName(id) {
            // Normalize node identifiers (e.g. 'measure:sales.total_sales' -> 'total_sales')
            const parts = id.split(':');
            if (parts.length < 2) return id;
            const path = parts[1].split('.');
            return path[path.length - 1]; // Extract leaf name as clean display identifier
        }

        function createLineageItem(dep) {
            const targetId = dep.sourceId === currentId ? dep.targetId : dep.sourceId;
            const isVisual = targetId.startsWith('visual:');
            const isRole = targetId.startsWith('role:');
            
            let badge = '';
            if (isVisual) {
                if (dep.type === 'visualValue') {
                    badge = ' <span class="badge-base badge-visual-value">VALUE</span>';
                } else if (dep.type === 'visualCalculation') {
                    badge = ' <span class="badge-base badge-visual-calculation">CALCULATION</span>';
                } else if (dep.type === 'visualFilter') {
                    badge = ' <span class="badge-base badge-visual-filter">FILTER</span>';
                } else {
                    badge = ' <span class="badge-visual-inline">VISUAL</span>';
                }
            } else if (isRole) {
                badge = ' <span class="badge-base badge-visual-security">RLS SECURITY</span>';
            }

            const nameToShow = (dep.sourceId === currentId ? dep.targetName : dep.sourceName) || getCleanName(targetId);
            
            let warningText = '';
            if (isVisual && !dep.hasExplicitName) {
                warningText = ' <span style="color:#f59e0b; font-size: 11px; font-style: italic; margin-left: 6px;">(⚠️ Suggestion: Assign a title to the visual)</span>';
            }

            return \`
                <li class="lineage-item" onclick="navigate('\${targetId}')">
                    <span class="lineage-name">\${getKindIcon(targetId)} \${nameToShow}\${warningText}\${badge}</span>
                </li>
            \`;
        }

        let currentId = '';

        function navigate(id) {
            vscode.postMessage({ command: 'navigate', nodeId: id });
        }

        function render(data) {
            currentId = data.id;
            currentNodeData = data;
            if (data.expression) {
                currentDaxExpression = \`[\${data.name}] =
\${data.expression}\`;
            } else {
                currentDaxExpression = '';
            }
            let breadcrumbs = [];
            if (data.parentTableName) breadcrumbs.push(data.parentTableName);
            if (data.displayFolder) breadcrumbs.push(data.displayFolder);
            breadcrumbs.push(data.name);

            const nodeDetails = data;
            const hasSecurityFilter = nodeDetails.incomingEdges && nodeDetails.incomingEdges.some(e => e.edgeType.toLowerCase() === 'securityfilter');

            let isOrphan = data.isOrphan;
            if (data.usabilityMetrics) {
                const structural = data.usabilityMetrics.structuralUsage || 0;
                const presentation = data.usabilityMetrics.presentationUsage || 0;
                if (structural > 0 || presentation > 0) {
                    isOrphan = false;
                }
            }
            if (hasSecurityFilter) {
                isOrphan = false;
            }

            let statusBadge = isOrphan 
                ? '<span class="badge badge-orphan">Orphan</span>'
                : '<span class="badge badge-active">In Use</span>';
            
            // 1. Impact Badge — calculates impact level from incoming edge data
            const impact = data.impact || { level: 'None', breakdown: { measures: 0, columns: 0, visuals: 0, roles: 0 } };
            const breakdown = impact.breakdown;
            const bkParts = [];
            if (breakdown.visuals > 0)  bkParts.push(breakdown.visuals + ' visual' + (breakdown.visuals > 1 ? 's' : ''));
            if (breakdown.measures > 0) bkParts.push(breakdown.measures + ' measure' + (breakdown.measures > 1 ? 's' : ''));
            if (breakdown.columns > 0)  bkParts.push(breakdown.columns + ' column' + (breakdown.columns > 1 ? 's' : ''));
            if (breakdown.roles > 0)    bkParts.push(breakdown.roles + ' RLS role' + (breakdown.roles > 1 ? 's' : ''));
            const bkText = bkParts.length > 0 ? 'Consumed by: ' + bkParts.join(', ') : 'No direct consumers';

            const impactHtml = \`
                <div class="impact-row">
                    <span class="impact-label">Impact Level:</span>
                    <span class="impact-badge impact-\${impact.level}">\${impact.level}</span>
                    <span class="impact-breakdown">\${bkText}</span>
                </div>
            \`;

            // 2. Linter Findings — violations from AuditEngine
            const violations = data.violations || [];
            let linterHtml;
            if (violations.length === 0) {
                linterHtml = \`
                    <div class="section">
                        <div class="section-title">LINTER FINDINGS</div>
                        <div class="linter-card">
                            <span class="linter-ok">No architectural violations detected.</span>
                        </div>
                    </div>
                \`;
            } else {
                const items = violations.map(v => \`
                    <div class="violation-item">
                        <span class="violation-severity sev-\${v.severity}">\${v.severity}</span>
                        <span class="violation-msg">\${v.message}</span>
                    </div>
                \`).join('');
                linterHtml = \`
                    <div class="section">
                        <div class="section-title">LINTER FINDINGS</div>
                        <div class="linter-card">\${items}</div>
                    </div>
                \`;
            }

            // 2. Compute utilization metrics grouped by category
            const incomingVisuals = nodeDetails.incomingEdges ? nodeDetails.incomingEdges.filter(e => e.sourceId.startsWith('visual:')) : [];
            const valueCount = incomingVisuals.filter(e => e.edgeType === 'VisualValue').length;
            const calcCount = incomingVisuals.filter(e => e.edgeType === 'VisualCalculation').length;
            const filterCount = incomingVisuals.filter(e => e.edgeType === 'VisualFilter').length;

            const measureCount = nodeDetails.incomingEdges ? nodeDetails.incomingEdges.filter(e => e.sourceId.startsWith('measure:')).length : 0;
            const securityCount = nodeDetails.incomingEdges ? nodeDetails.incomingEdges.filter(e => e.edgeType.toLowerCase() === 'securityfilter').length : 0;
            const relationshipCount = nodeDetails.incomingEdges
                ? nodeDetails.incomingEdges.filter(e => e.edgeType.toUpperCase() === 'RELATIONSHIP').length
                : 0;
            const otherCount = nodeDetails.incomingEdges 
                ? nodeDetails.incomingEdges.filter(e => 
                    !e.sourceId.startsWith('visual:') && 
                    !e.sourceId.startsWith('measure:') && 
                    e.edgeType.toLowerCase() !== 'securityfilter' &&
                    e.edgeType.toUpperCase() !== 'RELATIONSHIP'
                  ).length 
                : 0;

            let telemetryHtml = '';
            let pills = [];
            if (valueCount > 0) {
                pills.push(\`<span class="badge-base badge-visual-value">VALUE (\${valueCount})</span>\`);
            }
            if (calcCount > 0) {
                pills.push(\`<span class="badge-base badge-visual-calculation">VISUAL CALCULATION (\${calcCount})</span>\`);
            }
            if (filterCount > 0) {
                pills.push(\`<span class="badge-base badge-visual-filter">FILTER (\${filterCount})</span>\`);
            }
            if (measureCount > 0) {
                pills.push(\`<span class="usage-badge measure-badge">MEASURE (\${measureCount})</span>\`);
            }
            if (securityCount > 0) {
                pills.push(\`<span class="badge-base badge-visual-security">RLS SECURITY (\${securityCount})</span>\`);
            }
            if (relationshipCount > 0) {
                pills.push(\`<span class="usage-badge relationship-badge">RELATIONSHIP (\${relationshipCount})</span>\`);
            }
            if (otherCount > 0) {
                pills.push(\`<span class="usage-badge">OTHERS (\${otherCount})</span>\`);
            }

            if (pills.length > 0) {
                telemetryHtml = pills.join(' ');
            } else {
                telemetryHtml = '<span style="color: var(--text-secondary); font-size: 13px;">None</span>';
            }

            let codeSection = '';
            if (data.expression) {
                const fullDaxText = \`[\${data.name}] =
\${data.expression}\`;
                codeSection = \`
                    <div class="section">
                        <div class="section-title">DAX Expression</div>
                        <div class="dax-container" id="dax-container">
                            <button class="copy-btn" id="dax-copy-btn" onclick="copyDaxToClipboard()" title="Copy to clipboard">
                                \${copySvg}
                            </button>
                            <div class="dax-code-wrapper" id="dax-code-wrapper">
                                <pre><code id="dax-code-content">\${highlightDAX(fullDaxText)}</code></pre>
                                <div class="dax-fade-overlay" id="dax-fade-overlay"></div>
                            </div>
                            <button class="expand-btn" id="dax-expand-btn" onclick="toggleDaxExpand()">
                                Expand ▼
                            </button>
                        </div>
                    </div>
                \`;
            }

            let fwdHtml = data.directDependencies.length > 0
                ? \`<ul class="lineage-list">\${data.directDependencies.map(createLineageItem).join('')}</ul>\`
                : '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">No dependencies</div>';

            let revHtml = data.usedBy.length > 0
                ? \`<ul class="lineage-list">\${data.usedBy.map(createLineageItem).join('')}</ul>\`
                : '<div style="color:var(--text-secondary);font-size:13px;padding:8px 0">Not used by anyone</div>';

            let relationshipsSection = '';
            if (data.relationships && data.relationships.length > 0) {
                let relItems = data.relationships.map(r => \`<li>Direction: \${r.direction} | Filter: \${r.crossFilteringBehavior}</li>\`).join('');
                relationshipsSection = \`
                    <div class="section">
                        <div class="section-title">Relationships (Cross-Filtering)</div>
                        <ul class="list-container">\${relItems}</ul>
                    </div>
                \`;
            }

            let descriptionHtml = '';
            if (data.description) {
                descriptionHtml = \`
                    <div class="description-box">
                        <span class="description-icon">ℹ️</span>
                        <div class="description-text">\${data.description}</div>
                    </div>
                \`;
            }

            let bottomGridHtml = '';
            if (data.kind.toLowerCase() === 'column' && data.columnRelationships && data.columnRelationships.length > 0) {
                const relationshipsHtml = data.columnRelationships.map(r => {
                    return \`
                        <div class="rel-diagram-row">
                            <div class="rel-node-wrapper">
                                <div class="rel-box-title">Source Table</div>
                                <div class="rel-box rel-box-from">
                                    <span class="rel-table-name">\${r.fromTable}</span>
                                    <span class="rel-column-name">[\${r.fromCol}]</span>
                                </div>
                            </div>
                            <div class="rel-connector">
                                <div class="rel-connector-line"></div>
                                <span class="rel-arrow-text">
                                    \${r.direction === 'Both' ? '◀ Both ▶' : 'Single ▶'}
                                </span>
                                <div class="rel-connector-line"></div>
                            </div>
                            <div class="rel-node-wrapper">
                                <div class="rel-box-title">Target Table</div>
                                <div class="rel-box rel-box-to">
                                    <span class="rel-table-name">\${r.toTable}</span>
                                    <span class="rel-column-name">[\${r.toCol}]</span>
                                </div>
                            </div>
                        </div>
                    \`;
                }).join('');

                bottomGridHtml = \`
                    <div class="section" style="grid-column: 1 / -1;">
                        <div class="section-title">MODEL RELATIONSHIPS</div>
                        <div class="rel-diagram-container">
                            \${relationshipsHtml}
                        </div>
                    </div>
                \`;
            } else {
                bottomGridHtml = \`
                    <div class="grid-2">
                        <div class="section">
                            <div class="section-title">Depends On (Uses)</div>
                            \${fwdHtml}
                        </div>
                        <div class="section">
                            <div class="section-title">Consumed By (Used by)</div>
                            \${revHtml}
                        </div>
                    </div>
                \`;
            }

            let glowClass = isOrphan ? 'glow-orphan' : 'glow-active';

            const html = \`
                <div class="main-container \${glowClass}">
                    <div class="header">
                        <div class="breadcrumbs">\${breadcrumbs.join(' > ')}</div>
                        <div class="title-row">
                            <h1 class="title">\${data.name}</h1>
                            <span class="badge badge-kind">\${data.kind.toUpperCase()}</span>
                            \${statusBadge}
                            \${(isOrphan && data.kind === 'measure') ? '<button class="btn-danger" onclick="purgeNode()">&#x1F5D1; Purge Measure</button>' : ''}
                        </div>
                        \${impactHtml}
                    </div>

                    \${descriptionHtml}

                    \${linterHtml}

                    <div class="grid-2">
                        <div class="section">
                            <div class="section-title">USADO POR:</div>
                            \${telemetryHtml}
                        </div>
                        \${data.formatString ? \`<div class="section"><div class="section-title">Formato</div><div>\${data.formatString}</div></div>\` : ''}
                    </div>

                    \${relationshipsSection}
                    \${codeSection}

                    \${bottomGridHtml}
                </div>
            \`;
            
            document.getElementById('app').innerHTML = html;
            adjustDaxLayout();
        }

        function purgeNode() {
            if (!currentNodeData) { return; }
            vscode.postMessage({
                command: 'purgeNode',
                nodeId: currentNodeData.id,
                nodeName: currentNodeData.name
            });
        }
    </script>
</body>
</html>`;
    }
}
