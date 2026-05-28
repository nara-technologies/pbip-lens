import * as vscode from 'vscode';
import { ExtensionController } from './extension/ExtensionController';

let controller: ExtensionController | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('PBIP Lens: Extension activated.');

    controller = new ExtensionController();
    controller.registerCommands(context);
}

export function deactivate() {
    if (controller) {
        controller.dispose();
        controller = null;
    }
}
