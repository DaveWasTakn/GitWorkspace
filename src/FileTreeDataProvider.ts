import * as vscode from 'vscode';
import {ProviderResult} from 'vscode';
import * as path from 'path';
import {promisify} from 'util';
import {execFile} from 'child_process';
import * as fs from 'fs';

const execAsync = promisify(execFile);

async function execSyscall(executable: string, args: string[], cwd: string): Promise<string> {
    return (await execAsync(executable, args, {cwd})).stdout;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class FileTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {

    private data: Map<string, TreeItem[]> = new Map<string, TreeItem[]>();
    private gitPath: string = "git";

    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getParent(element: TreeItem): ProviderResult<TreeItem> {
        if (!element || element.type === ItemType.REPOSITORY || !element.getParent()) {
            return null;
        }
        return element.getParent();
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        const treeItems: TreeItem[] = [];

        if (!element) {
            let repositories: string[] | undefined = vscode.workspace.getConfiguration('gitWorkspace').get("path_to_repository");

            if (repositories === undefined || repositories.length <= 0 || repositories[0] === "TODO ADD PATH HERE") {
                vscode.window.showErrorMessage("Specify path to repository in the extension settings!");
                return [];
            }

            const configuredPath: string | undefined = vscode.workspace.getConfiguration('gitWorkspace').get<string>('path_to_git_executable');
            this.gitPath = configuredPath?.trim() || "git";

            await this.parseRepositories(repositories, treeItems);
        } else if (element.type === ItemType.REPOSITORY) {
            this.resolveRepository(element, treeItems);
        } else if (element.type === ItemType.DIRECTORY) {
            this.resolveDirectory(element, treeItems);
        }

        return treeItems;
    }

    private resolveDirectory(element: TreeItem, treeItems: TreeItem[]) {
        const prevDirs = path.join(...element.prevDirs) + path.sep;

        for (const item of this.data.get(element.repo) ?? []) {
            if (!item.filePath.includes(prevDirs)) {
                continue;
            }

            if (item.filePath.replace(prevDirs, "").includes(path.sep)) { // sub-dir
                const topDir = item.filePath.replace(prevDirs, "").split(path.sep)[0];
                if (!treeItems.some(x => x.filePath.replace(prevDirs, "").split(path.sep)[0] === topDir)) {
                    const t: TreeItem = new TreeItem(topDir, item.filePath, ItemType.DIRECTORY, element.repo, element);
                    element.prevDirs.forEach(x => t.prevDirs.push(x));
                    t.prevDirs.push(topDir);
                    treeItems.push(t);
                }
            } else { // file
                const t: TreeItem = new TreeItem(item.label, item.filePath, ItemType.FILE, item.repo, element, item.gitType);
                treeItems.push(t);
            }
        }
    }

    private resolveRepository(element: TreeItem, treeItems: TreeItem[]) {
        for (const item of this.data.get(element.repo) ?? []) {
            if (item.filePath.includes(path.sep)) {
                const topDir = item.filePath.split(path.sep)[0];
                if (treeItems.filter(h => h.label === topDir).length === 0) {
                    const t: TreeItem = new TreeItem(topDir, item.filePath, ItemType.DIRECTORY, element.repo, element);
                    t.prevDirs.push(topDir);
                    treeItems.push(t);
                }
            } else {
                item.changeType(ItemType.FILE);
                treeItems.push(item);
            }
        }
    }

    private async parseRepositories(repositories: string[], treeItems: TreeItem[]) {
        const getBranchNameCommand: string[] = ["name-rev", "--name-only", "HEAD"]; // git >= 1.7
        for (const repository of repositories) {
            let branch: string = "";
            try {
                let result = await execSyscall(this.gitPath, getBranchNameCommand, repository);
                branch = result.replace(/[\r\n]/g, "");
            } catch (error) {
                if (!fs.existsSync(repository)) {
                    vscode.window.showErrorMessage(`The repository ${repository} does not exist! It will be ignored.\n\nAlso check if your path is in the correct style: backslashes (\\) for Windows, and forward slashes (/) for Unix-based systems (including macOS and WSL)`);
                } else {
                    vscode.window.showErrorMessage("Error executing the following command: '" + this.gitPath + " " + getBranchNameCommand.join(" ") + "' in directory: " + repository);
                    console.error("exec error: " + error);
                }
                continue;
            }
            const r: TreeItem = new TreeItem(path.basename(repository) + " - " + branch, repository, ItemType.REPOSITORY, repository, undefined);
            r.setIcon("git_repo.png");
            treeItems.push(r);

            this.data.set(repository, await this.getData("", repository));
        }
    }

    async getData(currentPath: string, repo: string): Promise<TreeItem[]> {
        let results: string[] = [];
        const command1 = ["status", "--untracked-files=all", "--porcelain"];

        const masterCandidates = await execSyscall(this.gitPath, ["branch", "-l", "main", "master", "--format", "%(refname:short)"], repo);
        const masterName = masterCandidates ? masterCandidates.split("\n").map(s => s.trim()).filter(Boolean)[0] : "main";
        const command2 = ["diff", "--name-only", "--merge-base", masterName, "HEAD"];

        try {
            results.push(await execSyscall(this.gitPath, command1, repo));
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            console.error("exec error: " + error);
        }

        try {
            let result2 = await execSyscall(this.gitPath, command2, repo);
            if (result2) {
                result2 = result2.split("\n").filter(Boolean).map(x => "C " + x).join("\n");
            }
            results.push(result2);
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            console.error("exec error: " + error);
        }

        let result = results.join("\n").replace(/\r/g, "");
        let pathStrings: string[] = result
            .split("\n")
            .filter((x, i, a) => a.indexOf(x) === i)
            .filter(Boolean);

        let treeItemMap: Map<string, TreeItem> = new Map<string, TreeItem>();
        pathStrings.forEach(x => {
            createItem(currentPath, repo, x, treeItemMap);
        });

        let items: TreeItem[] = Array.from(treeItemMap.values()).filter(uniqueFilter);
        return items.sort(this.pathSort);
    }

    private pathSort(a: TreeItem, b: TreeItem): number {
        return a.filePath > b.filePath ? 1 : -1;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function createItem(currentPath: string, repo: string, gitRet: string, treeItemMap: Map<string, TreeItem>): void {
    let prefix: string;
    let remaining: string;
    try {
        const split: string[] = gitRet.trimStart().split(/(?<=^\S+?)\s+/g);
        prefix = split[0];
        remaining = split[1];
        if ((remaining.startsWith('"') && remaining.endsWith('"')) || (remaining.startsWith("'") && remaining.endsWith("'"))) {
            remaining = remaining.slice(1, -1);
        }
    } catch (e) {
        vscode.window.showErrorMessage("No prefix");
        prefix = "LMAO";
        remaining = gitRet;
    }

    const gitType: GitType = Object.values(GitType).includes(prefix as GitType) ? prefix as GitType : GitType.UNKNOWN;

    const treeItem: TreeItem = new TreeItem(path.basename(remaining), path.normalize(remaining), ItemType.UNKNOWN, repo, undefined, gitType);

    if (treeItemMap.has(remaining)) {
        const existing: TreeItem | undefined = treeItemMap.get(remaining);
        if (existing && gitTypePriority[existing.gitType] < gitTypePriority[treeItem.gitType]) {
            treeItemMap.set(remaining, treeItem);
        }
    } else {
        treeItemMap.set(remaining, treeItem);
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class TreeItem extends vscode.TreeItem {
    public prevDirs: string[] = [];
    private resourcesPath = path.join(__filename, '..', '..', 'resources');

    constructor(public label: string, public filePath: string, public type: ItemType, public repo: string, public parent: TreeItem | undefined, public gitType: GitType = GitType.UNKNOWN) {
        super(label);
        this.updateCollapsibleState();
        this.command = {
            "title": "open", "command": "gitWorkspace.onClickTreeItem" // commandId
        };
        this.gitType = gitType;
        if (this.type !== ItemType.DIRECTORY) {
            this.setCorrectIcon();
        }
    }

    public setCorrectIcon() {
        let icon: string;
        switch (this.gitType) {
            case (GitType.COMMITTED):
                icon = "icon-status-committed.png";
                break;
            case (GitType.ADDED):
                icon = "icon-status-added.png";
                break;
            case (GitType.DELETED):
                icon = "icon-status-deleted.png";
                break;
            case (GitType.MODIFIED):
                icon = "icon-status-modified.png";
                break;
            case (GitType.UNTRACKED):
                icon = "icon-status-untracked.png";
                break;
            default:
                icon = "icon-status-untracked.png";
                break;
        }
        this.iconPath = vscode.Uri.file(path.join(this.resourcesPath, icon));
    }

    public changeType(newType: ItemType) {
        this.type = newType;
        this.updateCollapsibleState();
    }

    async onItemSelection() {
        if (this.type === ItemType.FILE && this.gitType !== GitType.DELETED) {
            try {
                const p = path.join(this.repo, this.filePath);
                if (!fs.existsSync(p)) {
                    return;
                }
                const uri = vscode.Uri.file(p);
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(document, {preview: false});
                editor.selection = new vscode.Selection(0, 0, 0, 0);
            } catch (error: any) {
                vscode.window.showErrorMessage("Error:" + error.message);
                console.error(error);
            }
        }
    }

    setIcon(icon: string) {
        this.iconPath = vscode.Uri.file(path.join(this.resourcesPath, icon));
    }

    equals(other: TreeItem): boolean {
        return this.resourcesPath === other.resourcesPath && this.gitType === other.gitType && this.label === other.label && this.filePath === other.filePath && this.type === other.type && this.repo === other.repo;
    }

    getParent() {
        return this.parent;
    }

    private updateCollapsibleState() {
        if (this.type === ItemType.FILE) {
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        } else {
            this.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export function uniqueFilter(value: TreeItem, index: number, self: TreeItem[]) {
    return self.findIndex((obj) => obj.equals(value)) === index;
}

export enum ItemType {
    FILE, DIRECTORY, BRANCH, REPOSITORY, UNKNOWN
}

export enum GitType {
    UNTRACKED = "??", MODIFIED = "M", COMMITTED = "C", ADDED = "A", DELETED = "D", UNKNOWN = "LMAO"
}

const gitTypePriority = {
    [GitType.UNKNOWN]: 1,
    [GitType.COMMITTED]: 2,
    [GitType.MODIFIED]: 3,
    [GitType.UNTRACKED]: 4,
    [GitType.ADDED]: 5,
    [GitType.DELETED]: 6,
};
