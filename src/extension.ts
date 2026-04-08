import * as vscode from 'vscode';
import { PBIPAuditRunner } from './core/auditRunner';
import { MeasuresTreeProvider, TablesTreeProvider } from './ui/treeDataProvider';
import { ColumnDefinition } from './core/models/SemanticModel';

class MeasureDaxProvider implements vscode.TextDocumentContentProvider {
    private contents = new Map<string, string>();
    setContent(uri: string, content: string) {
        this.contents.set(uri, content);
    }
    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contents.get(uri.toString()) || 'No content found =(';
    }
}

class ColumnDashboardProvider implements vscode.TextDocumentContentProvider {
    private contents = new Map<string, string>();
    setContent(uri: string, content: string) {
        this.contents.set(uri, content);
    }
    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contents.get(uri.toString()) || 'No content found =(';
    }
}

function formatDaxToVirtualDocument(measureName: string, rawContent: string): string {
    const lines = rawContent.split(/\r?\n/);
    const metadataLines: string[] = [];
    const daxLines: string[] = [];
    
    let foundDaxEnd = false;
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!foundDaxEnd) {
            if (trimmed === '') { continue; }
            if (/^(formatString|formatStringExpression|displayFolder|lineageTag|isHidden|isAvailableInMDX|sortByColumn|summarizeBy|dataCategory|annotation\s|extend_annotation\s)/i.test(trimmed)) {
                metadataLines.unshift(trimmed);
                continue;
            }
            foundDaxEnd = true;
            daxLines.unshift(line);
        } else {
            daxLines.unshift(line);
        }
    }

    for (let i = 0; i < daxLines.length; i++) {
        if (/^\s*measure/.test(daxLines[i])) {
            daxLines[i] = daxLines[i].replace(/^\s*measure\s+['"]?([^=\n]+?)['"]?\s*=/, `${measureName} =`);
        }
        if (daxLines[i].includes('```')) {
            daxLines[i] = daxLines[i].replace(/```/g, '').trimEnd();
        }
    }

    const finalMetadata = metadataLines.length > 0 ? metadataLines.join('\n') + '\n\n' : '';
    const finalDax = '\n--------------------\n-- DAX DEFINITION --\n--------------------\n' + daxLines.join('\n');
    return finalMetadata + finalDax;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('PBIP Lens is now active.');
    let lastResults: any = null;

    const measuresProvider = new MeasuresTreeProvider();
    vscode.window.registerTreeDataProvider('pbipLensMeasuresView', measuresProvider);

    const tablesProvider = new TablesTreeProvider();
    vscode.window.registerTreeDataProvider('pbipLensTablesView', tablesProvider);

    const runAuditCommand = vscode.commands.registerCommand('pbip-lens.runAudit', async () => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "PBIP Lens: Auditando proyecto...",
            cancellable: false
        }, async () => {
            const results = await PBIPAuditRunner.run();
            if (!results) {
                vscode.window.showErrorMessage('No se encontró un proyecto PBIP válido.');
                return;
            }
            lastResults = results;
            measuresProvider.refresh(results);
            tablesProvider.refresh(results);
            vscode.commands.executeCommand('pbipLensMeasuresView.focus');
        });
    });

    const openFileCommand = vscode.commands.registerCommand('pbip-lens.openFile', (filePath: string) => {
        vscode.workspace.openTextDocument(filePath).then(doc => {
            vscode.window.showTextDocument(doc, { preview: true });
        });
    });

    const daxProvider = new MeasureDaxProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('pbip-lens-dax', daxProvider));

    const showMeasureDaxCommand = vscode.commands.registerCommand('pbip-lens.showMeasureDax', async (name: string, content: string) => {
        const uri = vscode.Uri.parse(`pbip-lens-dax:${encodeURIComponent(name)}.dax`);
        const formattedContent = formatDaxToVirtualDocument(name, content);
        daxProvider.setContent(uri.toString(), formattedContent);
        const doc = await vscode.workspace.openTextDocument(uri);
        vscode.languages.setTextDocumentLanguage(doc, 'dax');
        vscode.window.showTextDocument(doc, { preview: true });
    });

    const colProvider = new ColumnDashboardProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('pbip-lens-column', colProvider));

    const showColumnDashboardCommand = vscode.commands.registerCommand('pbip-lens.showColumnDashboard', async (columnDef: ColumnDefinition) => {
        const uri = vscode.Uri.parse(`pbip-lens-column:${encodeURIComponent(columnDef.name.toLowerCase())}.md`);
        let md = `# 📊 Análisis de Columna: **${columnDef.name}**\n\n`;
        md += `| Propiedad | Valor |\n`;
        md += `| --- | --- |\n`;
        md += `| **Tabla** | \`${columnDef.tableName}\` |\n`;
        md += `| **Tipo de Dato** | \`${columnDef.dataType || 'Desconocido'}\` |\n`;
        md += `| **Origen** | ${columnDef.isCalculated ? 'Calculada (DAX) 🔧' : 'Física 📁'} |\n`;
        if (columnDef.sourceColumn && !columnDef.isCalculated) {
            md += `| **Columna Origen** | \`${columnDef.sourceColumn}\` |\n`;
        }
        md += `\n### Auditoría Quirúrgica de Uso\n`;
        md += `| Frente de Auditoría | Estado |\n`;
        md += `| :--- | :--- |\n`;
        md += `| **En Visuales PBIX** | ${columnDef.usedInVisuals ? 'Sí ✅' : 'No ❌'} |\n`;
        md += `| **En Medidas DAX** | ${columnDef.isUsedInMeasures ? `Sí ✅ (Usada por ${columnDef.usedBy.filter(u => lastResults?.semanticModel?.measures?.[u.toLowerCase()]).length} medidas)` : 'No ❌'} |\n`;
        md += `| **En Columnas Calc.** | ${columnDef.isUsedInCalculatedColumns ? `Sí ✅ (Usada por ${columnDef.usedBy.filter(u => lastResults?.semanticModel?.columns?.[u.toLowerCase()]).length} columnas)` : 'No ❌'} |\n`;
        md += `| **Es Llave de Relación** | ${columnDef.isRelationshipKey ? 'Sí 🗝️' : 'No ❌'} |\n`;
        md += `| **Es Sort-By Target** | ${columnDef.isSortByTarget ? 'Sí ⚠️' : 'No ❌'} |\n`;
        md += `| **Usada en Roles (RLS)** | ${columnDef.isUsedInRLS ? 'Sí 🔒' : 'No ❌'} |\n\n`;

        const isInnocuous = !columnDef.usedInVisuals && !columnDef.isUsedInMeasures && !columnDef.isUsedInCalculatedColumns && !columnDef.isRelationshipKey && !columnDef.isSortByTarget && !columnDef.isUsedInRLS;
        
        if (isInnocuous) {
            md += `> [!TIP]\n> **Factor de Inocuidad:** Esta columna está completamente huérfana en las 6 capas del modelo. Retirarla ahorrará RAM y acelerará el modelo sin romper reportes ni lógicas.\n\n`;
        } else if (!columnDef.usedInVisuals) {
            md += `> [!CAUTION]\n> **Factor de Inocuidad:** Esta columna NO está en visuales, pero es **estructural** (usada en DAX, relaciones o RLS). ¡No la elimines!\n\n`;
        }

        if (columnDef.isCalculated && columnDef.content) {
            md += `## 📝 Definición DAX\n`;
            // Extraer solo la fórmula DAX principal (remover metadatos)
            const daxBody = formatDaxToVirtualDocument(columnDef.name, columnDef.content).split('-- DAX DEFINITION --\n--------------------\n')[1];
            md += `\`\`\`dax\n${daxBody || columnDef.content}\n\`\`\`\n\n`;
        }

        if (columnDef.usedBy && columnDef.usedBy.length > 0) {
            md += `## 📈 Utilizada por (${columnDef.usedBy.length})\n`;
            columnDef.usedBy.forEach(u => {
                const uKey = u.toLowerCase();
                const isMeasure = lastResults?.semanticModel?.measures?.[uKey];
                const isColumn = lastResults?.semanticModel?.columns?.[uKey];
                const typeLabel = isMeasure ? '*(Medida)*' : (isColumn ? '*(Columna)*' : '');
                md += `- \`${u}\` ${typeLabel}\n`;
            });
        }

        colProvider.setContent(uri.toString(), md);
        await vscode.commands.executeCommand('markdown.showPreview', uri);
    });

    const refreshAuditCommand = vscode.commands.registerCommand('pbip-lens.refreshAudit', () => {
        vscode.commands.executeCommand('pbip-lens.runAudit');
    });

    const expandAllCommand = vscode.commands.registerCommand('pbip-lens.expandAll', () => {
        measuresProvider.expandAll();
        tablesProvider.expandAll();
    });

    const toggleViewCommand = vscode.commands.registerCommand('pbip-lens.toggleViewMode', () => {
        measuresProvider.toggleViewMode();
    });

    context.subscriptions.push(
        runAuditCommand, 
        refreshAuditCommand, 
        expandAllCommand, 
        openFileCommand, 
        showMeasureDaxCommand, 
        showColumnDashboardCommand, 
        toggleViewCommand
    );
}

export function deactivate() {}
