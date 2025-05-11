import * as vscode from 'vscode';
import {FileTreeDataProvider, TreeItem} from './FileTreeDataProvider';


export function activate(context: vscode.ExtensionContext) {
    const fileTreeDataProvider = new FileTreeDataProvider();

    const treeView = vscode.window.createTreeView('gitWorkspace_container_files', {
        treeDataProvider: fileTreeDataProvider
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.refreshEntry', () => fileTreeDataProvider.refresh());

    vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
            fileTreeDataProvider.refresh();
            // console.log('Window gained focus');
        }
    });

    vscode.commands.registerCommand('gitWorkspace.onClickTreeItem', x => {
        if (treeView.selection[0] !== undefined && treeView.selection[0] !== null) {
            const treeItem: TreeItem = treeView.selection[0];
            treeItem.onItemSelection();
        }
    });
}

export function deactivate() {
}
