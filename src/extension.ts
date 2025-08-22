import * as vscode from 'vscode';
import {
    CancellationToken,
    ConfigurationChangeEvent,
    ProviderResult,
    TextDocumentContentProvider,
    TreeView,
    Uri
} from 'vscode';
import {FileTreeDataProvider, getFileAtRevision, GitType, TreeItem} from './FileTreeDataProvider';
import * as path from 'path';


export function activate(context: vscode.ExtensionContext) {
    const fileTreeDataProvider = new FileTreeDataProvider(context);

    const treeView = vscode.window.createTreeView('gitWorkspace_container_files', {
        treeDataProvider: fileTreeDataProvider
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.refreshEntry', () => {
        cmd_refreshEntry(fileTreeDataProvider);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.reset', () => {
        cmd_reset(fileTreeDataProvider);
    });

    vscode.commands.registerCommand('gitWorkspace.onClickTreeItem', () => {
        cmd_onClickTreeItem(treeView);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.quickAction', (treeItem: TreeItem) => {
        cmd_quickAction(treeItem, treeView);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.diffHead', async (treeItem: TreeItem) => {
        await cmd_diffHead(treeItem, fileTreeDataProvider);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.diffBranch', async (treeItem: TreeItem) => {
        await cmd_diffBranch(treeItem, fileTreeDataProvider);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.rename', (treeItem: TreeItem) => {
        cmd_rename(treeItem);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.rollback', (treeItem: TreeItem) => {
        cmd_rollback(treeItem);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.delete', (treeItem: TreeItem) => {
        cmd_delete(treeItem);
    });

    vscode.commands.registerCommand('gitWorkspace.workFlowQuickPick', async (repository: TreeItem) => {
        await cmd_workFlowQuickPick(repository);
    });

    vscode.workspace.onDidChangeConfiguration(event => {
        onDidChangeConfiguration(event, fileTreeDataProvider);
    });
}

export function deactivate() {
}

function cmd_refreshEntry(fileTreeDataProvider: FileTreeDataProvider) {
    fileTreeDataProvider.refresh();
}

function cmd_reset(fileTreeDataProvider: FileTreeDataProvider) {
    fileTreeDataProvider.reset();
    fileTreeDataProvider.refresh();
}

function cmd_onClickTreeItem(treeView: TreeView<TreeItem>) {
    if (treeView.selection[0] !== undefined && treeView.selection[0] !== null) {
        const treeItem: TreeItem = treeView.selection[0];
        treeItem.onItemSelection();
    }
}

function cmd_quickAction(treeItem: TreeItem, treeView: TreeView<TreeItem>) {
    treeView.reveal(treeItem, {select: true, focus: true, expand: false});
    // TODO provide option to choose quickAction - check and call corresponding function
}

async function cmd_diffHead(treeItem: TreeItem, fileTreeDataProvider: FileTreeDataProvider) {
    await showDiff(treeItem, "Diff to HEAD: " + treeItem.label, "HEAD");
}

async function cmd_diffBranch(treeItem: TreeItem, fileTreeDataProvider: FileTreeDataProvider) {
    const branchName: string | undefined = await fileTreeDataProvider.getBranchName(treeItem.repo);

    if (!branchName) {
        vscode.window.showErrorMessage("Could not determine branch name...");
        return;
    }

    const branchOriginRevision: string = fileTreeDataProvider.repositoryInfos[treeItem.repo].branches[branchName];
    await showDiff(treeItem, "Diff to branch-origin: " + treeItem.label, branchOriginRevision);
}

async function showDiff(treeItem: TreeItem, title: string, revision: string) {
    let filePath = path.normalize(treeItem.filePath);

    if (path.sep === "\\") {
        filePath = filePath.replace("\\", "/");
    }

    let fileContentAtRevision: string;
    try {
        fileContentAtRevision = await getFileAtRevision(treeItem.repo, filePath, revision);
    } catch (e) {
        vscode.window.showInformationMessage(`The file did not exist at the specified revision : ${revision}`);
        return;
    }

    const histProviderRegistration = vscode.workspace.registerTextDocumentContentProvider("gitDiff", {
        provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
            return fileContentAtRevision;   // ... maybe think about encoding the info in the uri and reusing the documentProvider
        }
    } as TextDocumentContentProvider);

    if (treeItem.gitType === GitType.DELETED || treeItem.gitType === GitType.COMMITTED_DELETED) {  // If the file is deleted then display it in the diff view next to an empty new document
        const emptyProviderRegistration = vscode.workspace.registerTextDocumentContentProvider("empty", {
            provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
                return "";
            }
        } as TextDocumentContentProvider);

        vscode.commands.executeCommand(
            "vscode.diff",
            vscode.Uri.parse(`gitDiff:${treeItem.filePath}:${revision}`),
            vscode.Uri.parse(`empty:${treeItem.filePath}:${revision}`),
            title
        ).then(() => {
            histProviderRegistration.dispose();
            emptyProviderRegistration.dispose();
        });
    } else {
        vscode.commands.executeCommand(
            "vscode.diff",
            vscode.Uri.parse(`gitDiff:${treeItem.filePath}:${revision}`),
            vscode.Uri.file(path.join(treeItem.repo, treeItem.filePath)),
            title
        ).then(() => histProviderRegistration.dispose());
    }

}

function cmd_rename(treeItem: TreeItem) {

}

function cmd_rollback(treeItem: TreeItem) {

}

function cmd_delete(treeItem: TreeItem) {

}

async function cmd_workFlowQuickPick(repository: TreeItem) {
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

    let shellPath = vscode.env.shell;
    const useChaining: boolean = vscode.workspace.getConfiguration('gitWorkspace').get<boolean>('useChainingForWorkflows') ?? true;
    if (useChaining && vscode.env.shell.toLowerCase().includes('powershell')) {
        // powershell only allows the chaining operator from version 7 and above.
        // default powershell version is likely 5.x --> use Command Prompt instead
        shellPath = "cmd.exe";
    }

    const terminal = vscode.window.createTerminal({
        name: workflow + " - workflow",
        cwd: repository.filePath,
        location: vscode.TerminalLocation.Panel,
        shellPath: shellPath
    });

    terminal.show();
    if (useChaining) {
        terminal.sendText(commands.join(" && "));
    } else {
        for (const cmd of commands) {
            terminal.sendText(cmd);
        }
    }
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

function onDidChangeConfiguration(event: ConfigurationChangeEvent, fileTreeDataProvider: FileTreeDataProvider) {
    if (event.affectsConfiguration('gitWorkspace.useFileWatchers')) {
        fileTreeDataProvider.disposeFileWatchers();
        fileTreeDataProvider.readConfig_useFileWatchers();
        fileTreeDataProvider.refresh();
    }
}