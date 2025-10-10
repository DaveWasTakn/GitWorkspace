import * as vscode from 'vscode';
import {
    CancellationToken,
    ConfigurationChangeEvent,
    Disposable,
    ProviderResult,
    TextDocumentContentProvider,
    TextEditor,
    TreeView,
    TreeViewVisibilityChangeEvent,
    Uri
} from 'vscode';
import {execSyscall, FileTreeDataProvider, getTempFileAtRevision, GitType, TreeItem} from './FileTreeDataProvider';
import * as path from 'path';
import {promises as fs} from "fs";


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

    vscode.commands.registerCommand('gitWorkspace_container_files.diffHead', async (treeItem: TreeItem) => {
        await cmd_diffHead(treeItem, fileTreeDataProvider, treeView);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.diffBranch', async (treeItem: TreeItem) => {
        await cmd_diffBranch(treeItem, fileTreeDataProvider, treeView);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.rename', async (treeItem: TreeItem) => {
        await cmd_rename(treeItem);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.rollback', async (treeItem: TreeItem) => {
        await cmd_rollback(treeItem, treeView);
    });

    vscode.commands.registerCommand('gitWorkspace_container_files.delete', async (treeItem: TreeItem) => {
        await cmd_delete(treeItem);
    });

    vscode.commands.registerCommand('gitWorkspace.workFlowQuickPick', async (repository: TreeItem) => {
        await cmd_workFlowQuickPick(repository);
    });

    vscode.workspace.onDidChangeConfiguration(event => {
        onDidChangeConfiguration(event, fileTreeDataProvider);
    });

    vscode.window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
        onDidChangeActiveTextEditor(editor, treeView, fileTreeDataProvider);
    });

    treeView.onDidChangeVisibility((treeViewVisibilityChangeEvent: TreeViewVisibilityChangeEvent) => {
        treeView_onDidChangeVisibility(treeViewVisibilityChangeEvent, treeView, fileTreeDataProvider);
    });

    // manually trigger selection sync after a delay, since there is no event to know when a treeview is fully populated
    delay(2000).then(() => onDidChangeActiveTextEditor(vscode.window.activeTextEditor, treeView, fileTreeDataProvider));
}

function delay(ms: number): Promise<any> {
    return new Promise(resolve => setTimeout(resolve, ms));
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

async function cmd_diffHead(treeItem: TreeItem, fileTreeDataProvider: FileTreeDataProvider, treeView: TreeView<TreeItem>) {
    await showDiff(treeItem, `${treeItem.label} (latest commit)  ↔  ${treeItem.label}`, "HEAD");
}

async function cmd_diffBranch(treeItem: TreeItem, fileTreeDataProvider: FileTreeDataProvider, treeView: TreeView<TreeItem>) {
    const branchName: string | undefined = await fileTreeDataProvider.getBranchName(treeItem.repo);
    if (!branchName) {
        vscode.window.showErrorMessage("Could not determine branch name ...");
        return;
    }
    const branchOriginRevision: string = fileTreeDataProvider.repositoryInfos[treeItem.repo].branches[branchName];
    await showDiff(treeItem, `${treeItem.label} (branch-origin)  ↔  ${treeItem.label}`, branchOriginRevision);
}

async function showDiff(treeItem: TreeItem, title: string, revision: string): Promise<boolean> {
    let filePath = path.normalize(treeItem.filePath);

    if (path.sep === "\\") {
        filePath = filePath.replace(/\\/g, "/");
    }

    let fileAtRevision: string;
    try {
        fileAtRevision = await getTempFileAtRevision(treeItem.repo, filePath, revision);
    } catch (e) {
        vscode.window.showInformationMessage(`The file did not exist at the specified revision : ${revision}`);
        return false;
    }

    const histContent: string = (await vscode.workspace.openTextDocument(vscode.Uri.file(fileAtRevision))).getText();
    await vscode.workspace.fs.delete(vscode.Uri.file(fileAtRevision), {recursive: false, useTrash: false});
    const histProviderRegistration = vscode.workspace.registerTextDocumentContentProvider("gitDiff", {
        provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
            // use textDocument provider instead of just providing the fileUri to make the old version view-only
            return histContent;
        }
    } as TextDocumentContentProvider);

    const disposables: Disposable[] = [histProviderRegistration];
    let newContentUri: Uri = vscode.Uri.file(treeItem.getAbsPath());

    if (isDeleted(treeItem)) {  // If the file is deleted then display an empty new document
        const emptyProviderRegistration = vscode.workspace.registerTextDocumentContentProvider("empty", {
            provideTextDocumentContent(uri: Uri, token: CancellationToken): ProviderResult<string> {
                return "";
            }
        } as TextDocumentContentProvider);

        disposables.push(emptyProviderRegistration);
        newContentUri = vscode.Uri.from({scheme: "empty", path: filePath, query: revision});
    }

    vscode.commands.executeCommand(
        "vscode.diff",
        vscode.Uri.from({scheme: "gitDiff", path: filePath, query: revision}),
        newContentUri,
        title
    ).then(() => disposables.forEach(x => x.dispose));
    return true;
}

async function cmd_rename(treeItem: TreeItem) {
    if (isDeleted(treeItem)) {
        vscode.window.showInformationMessage("Cannot rename a deleted file.");
        return;
    }

    const newName = await vscode.window.showInputBox({
        title: `Enter new name for file: ${treeItem.label}`,
        value: treeItem.label,
        validateInput: (value) => {
            if (!value.trim()) {
                return "Name cannot be empty";
            }
            if (value === treeItem.label) {
                return "Please enter a new name";
            }
            return;
        }
    });

    if (!newName) {
        return;
    }

    const oldFilePath = treeItem.getAbsPath();
    const newFilePath = path.join(treeItem.repo, treeItem.filePath.replace(treeItem.label, newName));

    await safeRename(oldFilePath, newFilePath);
    const document = await vscode.workspace.openTextDocument(newFilePath);
    await vscode.window.showTextDocument(document, {preview: false});
}

async function safeRename(oldPath: string, newPath: string) {
    try {
        await fs.access(newPath);
        vscode.window.showErrorMessage(`Target file already exists: "${newPath}"! Rename aborted.`);
        return;
    } catch (err: any) {
        if (err.code !== "ENOENT") {
            throw err;
        }
    }

    await fs.rename(oldPath, newPath);
}

async function cmd_rollback(treeItem: TreeItem, treeView: TreeView<TreeItem>) {
    if (await confirmation(`Are you sure you want to rollback the file "${treeItem.label}" to the latest commit?`)) {
        await execSyscall("git", ["checkout", "HEAD", "--", treeItem.filePath], treeItem.repo);
    }
}

function isDeleted(treeItem: TreeItem) {
    return treeItem.gitType === GitType.DELETED || treeItem.gitType === GitType.COMMITTED_DELETED;
}

async function cmd_delete(treeItem: TreeItem) {
    if (isDeleted(treeItem)) {
        vscode.window.showInformationMessage("Cannot delete a deleted file.");
        return;
    }

    if (await confirmation(`Are you sure you want to delete the file "${treeItem.label}"?`)) {
        try {
            await vscode.workspace.fs.delete(vscode.Uri.file(treeItem.getAbsPath()), {
                recursive: false,
                useTrash: true
            });
        } catch (e1) {
            try {
                await vscode.workspace.fs.delete(vscode.Uri.file(treeItem.getAbsPath()), {
                    recursive: false,
                    useTrash: false
                });
            } catch (e2) {
                vscode.window.showErrorMessage(`Failed to delete file "${treeItem.label}": ${e2}`);
            }
        }
    }
}

async function confirmation(message: string): Promise<boolean> {
    return "Yes" === await vscode.window.showInformationMessage(
        message,
        {modal: true},
        "Yes",
        "No"
    );
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
    if (event.affectsConfiguration('gitWorkspace')) {
        if (event.affectsConfiguration('gitWorkspace.path_to_repository')) {
            fileTreeDataProvider.reset();
        }
        if (event.affectsConfiguration('gitWorkspace.useFileWatchers')) {
            fileTreeDataProvider.disposeFileWatchers();
            fileTreeDataProvider.readConfig_useFileWatchers();
        }
        fileTreeDataProvider.refresh();
    }
}

function onDidChangeActiveTextEditor(editor: TextEditor | undefined, treeView: TreeView<TreeItem>, fileTreeDataProvider: FileTreeDataProvider, focus: boolean = false) {
    if (!treeView.visible || !(vscode.workspace.getConfiguration('gitWorkspace').get<boolean>('syncFileSelection') ?? true)) {
        return;
    }

    if (editor) {
        const treeItem: TreeItem | undefined = fileTreeDataProvider.treeItemPathsLookup[editor.document.uri.fsPath];
        if (treeItem) {
            treeView.reveal(treeItem, {select: true, focus: focus});
            return;
        }
    }

    treeView.reveal(Object.values(fileTreeDataProvider.treeItemPathsLookup)[0], {select: true, focus: focus}); // just reveal the repo, since there is no way to unselect items :(
}

function treeView_onDidChangeVisibility(treeViewVisibilityChangeEvent: TreeViewVisibilityChangeEvent, treeView: TreeView<TreeItem>, fileTreeDataProvider: FileTreeDataProvider) {
    if (treeViewVisibilityChangeEvent.visible) {
        onDidChangeActiveTextEditor(vscode.window.activeTextEditor, treeView, fileTreeDataProvider, true);
    }
}
