import * as vscode from 'vscode';
import {FileTreeDataProvider, TreeItem} from './FileTreeDataProvider';


export function activate(context: vscode.ExtensionContext) {
    const fileTreeDataProvider = new FileTreeDataProvider(context);

    const treeView = vscode.window.createTreeView('gitWorkspace_container_files', {
        treeDataProvider: fileTreeDataProvider
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.refreshEntry', () => fileTreeDataProvider.refresh());
    vscode.commands.registerCommand('gitWorkspace_container_files.reset', () => {
        fileTreeDataProvider.reset();
        fileTreeDataProvider.refresh();
    });

    vscode.commands.registerCommand('gitWorkspace.onClickTreeItem', x => {
        if (treeView.selection[0] !== undefined && treeView.selection[0] !== null) {
            const treeItem: TreeItem = treeView.selection[0];
            treeItem.onItemSelection();
        }
    });

    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('gitWorkspace.useFileWatchers')) {
            fileTreeDataProvider.disposeFileWatchers();
            fileTreeDataProvider.readConfig_useFileWatchers();
            fileTreeDataProvider.refresh();
        }
    });

    vscode.commands.registerCommand('gitWorkspace.workFlowQuickPick', async (repository: TreeItem) => {
        const workflows: Record<string, string[]> = vscode.workspace.getConfiguration('gitWorkspace').get<Record<string, string[]>>('customWorkflows') ?? {};

        if (!workflows || Object.keys(workflows).length === 0) {
            vscode.window.showInformationMessage('No workflows configured in settings.');
            return;
        }

        const workflow = await vscode.window.showQuickPick(Object.keys(workflows), {
            title: "Select a Workflow to run in the repository: " + repository.label
        });

        if (!workflow) {
            return;
        }

        const commands = workflows[workflow];

        for (let i = 0; i < commands.length; i++) {
            let cmd = commands[i];
            const placeholders = cmd.matchAll(/<<<.*?>>>/g);
            for (const [placeholder] of placeholders) {
                let value;
                if (placeholder in KNOWN_PLACEHOLDERS) {
                    value = KNOWN_PLACEHOLDERS[placeholder as keyof typeof KNOWN_PLACEHOLDERS](repository);
                } else {
                    value = await vscode.window.showInputBox({
                        title: "Input: " + placeholder.slice(3, -3)
                    });
                }

                if (!value) {
                    vscode.window.showInformationMessage("Aborting workflow: " + workflow);
                    return;
                }
                cmd = cmd.replace(placeholder, value);
            }
            commands[i] = cmd;
        }

        const terminal = vscode.window.createTerminal({
            name: workflow + " - workflow",
            cwd: repository.filePath,
            location: vscode.TerminalLocation.Panel,
            shellPath: vscode.env.shell
        });

        terminal.show();
        const useChaining: boolean = vscode.workspace.getConfiguration('gitWorkspace').get<boolean>('useChainingForWorkflows') ?? true;
        if (useChaining) {
            terminal.sendText(commands.join(" && "));
        } else {
            for (const cmd of commands) {
                terminal.sendText(cmd);
            }
        }
    });
}

const KNOWN_PLACEHOLDERS = {
    ["<<<$REPOSITORY_NAME>>>"]: (item: TreeItem) => item.label.slice(0, item.label.indexOf(" - ")),
    ["<<<$REPOSITORY_BRANCH>>>"]: (item: TreeItem) => item.label.slice(item.label.indexOf(" - ") + 3),
    ["<<<$REPOSITORY_BRANCH_WITHOUT_PREFIX>>>"]: (item: TreeItem) => {
        const label = item.label;
        const branch = label.slice(label.indexOf(" - ") + 3);
        const slashIndex = branch.indexOf("/");
        return slashIndex !== -1 ? branch.slice(slashIndex + 1) : branch;
    },
    ["<<<$REPOSITORY_PATH>>>"]: (item: TreeItem) => item.filePath
};

export function deactivate() {
}
