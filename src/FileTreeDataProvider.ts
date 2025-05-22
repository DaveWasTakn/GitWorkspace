import * as vscode from 'vscode';
import {ExtensionContext, ProviderResult} from 'vscode';
import * as path from 'path';
import {promisify} from 'util';
import {execFile} from 'child_process';
import * as fs from 'fs';

const execAsync = promisify(execFile);

async function execSyscall(executable: string, args: string[], cwd: string): Promise<string> {
    return (await execAsync(executable, args, {cwd})).stdout;
}

type RepositoryInfo = {
    defaultBranch: string; branches: Record<string, string>;
};
type RepositoryInfos = Record<string, RepositoryInfo>;

const BRANCH_NAME_COMMAND: string[] = ["name-rev", "--name-only", "HEAD"]; // git >= 1.7
const DEFAULT_BRANCH_NAME_COMMAND: string[] = ["branch", "-l", "main", "master", "--format", "%(refname:short)"];
const GIT_STATUS_COMMAND: string[] = ["status", "--untracked-files=all", "--porcelain"];


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export class FileTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {

    private data: Map<string, TreeItem[]> = new Map<string, TreeItem[]>();
    private gitPath: string = "git";
    private repositoryInfos: RepositoryInfos = {};

    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private readonly context: ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    reset(): void {
        this.saveToGlobalMemento("repositoryInfos", {});
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

            if (!repositories || repositories.length === 0) {
                vscode.window.showErrorMessage("Specify path to repository in the extension settings!");
                return [];
            }

            const configuredPath: string | undefined = vscode.workspace.getConfiguration('gitWorkspace').get<string>('path_to_git_executable');
            this.gitPath = configuredPath?.trim() || "git";

            this.repositoryInfos = this.loadFromGlobalMemento("repositoryInfos", {});

            await this.parseRepositories(repositories, treeItems);
        } else if (element.type === ItemType.REPOSITORY) {
            this.resolveRepository(element, treeItems);
        } else if (element.type === ItemType.DIRECTORY) {
            this.resolveDirectory(element, treeItems);
        }

        return treeItems;
    }

    private saveToGlobalMemento(key: string, value: any): void {
        this.context.globalState.update(key, value);
    }

    private loadFromGlobalMemento<T>(key: string, defaultVal: T): T {
        return this.context.globalState.get<T>(key, defaultVal);
    }

    private resolveDirectory(element: TreeItem, treeItems: TreeItem[]): void {
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

    private resolveRepository(element: TreeItem, treeItems: TreeItem[]): void {
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

    private async parseRepositories(repositories: string[], treeItems: TreeItem[]): Promise<void> {
        for (const repository of repositories) {
            if (!this.repositoryInfos[repository]) {
                this.repositoryInfos[repository] = {
                    branches: {}, defaultBranch: await this.getDefaultBranchName(repository)
                };
                this.saveToGlobalMemento("repositoryInfos", this.repositoryInfos);
            }
            const branch: string | undefined = await this.getBranchName(repository);
            if (branch) {
                const r: TreeItem = new TreeItem(path.basename(repository) + " - " + branch, repository, ItemType.REPOSITORY, repository, undefined);
                r.setIcon("git_repo.png");
                treeItems.push(r);

                if (!this.repositoryInfos[repository].branches[branch]) {
                    this.repositoryInfos[repository].branches[branch] = await this.getBranchOrigin(repository, branch);
                    this.saveToGlobalMemento("repositoryInfos", this.repositoryInfos);
                }

                this.data.set(repository, await this.getData("", repository, branch));
            }
        }
    }

    private async getBranchOrigin(repository: string, branch: string): Promise<string> {
        // find the commit on the master branch immediately before this branch was created
        const revlist_branch: string[] = (await execSyscall(this.gitPath, ["rev-list", "--first-parent", branch, "--"], repository)).trim().split('\n');
        const revlist_master: string[] = (await execSyscall(this.gitPath, ["rev-list", "--first-parent", this.repositoryInfos[repository].defaultBranch, "--"], repository)).trim().split('\n');
        const masterSet = new Set(revlist_master);

        const branchOrigin: string | undefined = revlist_branch.find(commit => masterSet.has(commit));
        if (branchOrigin) {
            return branchOrigin;
        }

        // else just return the merge-base "git merge-base HEAD master"
        return await execSyscall(this.gitPath, ["merge-base", "HEAD", this.repositoryInfos[repository].defaultBranch], repository);
    }


    private async getBranchName(repository: string): Promise<string | undefined> {
        try {
            let result = await execSyscall(this.gitPath, BRANCH_NAME_COMMAND, repository);
            return result.replace(/[\r\n]/g, "");
        } catch (error) {
            if (!fs.existsSync(repository)) {
                vscode.window.showErrorMessage(`The repository ${repository} does not exist! It will be ignored.\n\nAlso check if your path is in the correct style: backslashes (\\) for Windows, and forward slashes (/) for Unix-based systems (including macOS and WSL)`);
            } else {
                vscode.window.showErrorMessage("Error executing the following command: '" + this.gitPath + " " + BRANCH_NAME_COMMAND.join(" ") + "' in directory: " + repository);
                console.error("exec error: " + error);
            }
            return undefined;
        }
    }

    private async getDefaultBranchName(repository: string): Promise<string> {
        const possibleNames = await execSyscall(this.gitPath, DEFAULT_BRANCH_NAME_COMMAND, repository);
        return possibleNames ? possibleNames.split("\n").map(s => s.trim()).filter(Boolean)[0] : "main";
    }

    async getData(currentPath: string, repo: string, branch: string): Promise<TreeItem[]> {
        let results: string[] = [];

        try {
            results.push(...(await execSyscall(this.gitPath, GIT_STATUS_COMMAND, repo)).trim().split(/\r?\n/).filter(Boolean));
        } catch (error) {
            vscode.window.showErrorMessage(error.message);
            console.error("exec error: " + error);
        }

        if (branch !== this.repositoryInfos[repo].defaultBranch) {
            try {
                const diffToBranchOrigin = await execSyscall(this.gitPath, ["diff", "--name-status", this.repositoryInfos[repo].branches[branch]], repo); // diff to the origin of this branch
                results.push(...diffToBranchOrigin.trim().split(/\r?\n/).filter(Boolean).map(x => "C" + x));
            } catch (error) {
                vscode.window.showErrorMessage(error.message);
                console.error("exec error: " + error);
            }
        }

        let treeItemMap: Map<string, TreeItem> = new Map<string, TreeItem>();
        new Set(results).forEach(x => {
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
        const split: string[] = gitRet.trimStart().split(/(?<=^\S+?)[\s\t]+?/g);
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
            case (GitType.COMMITTED_ADDED):
                icon = "icon-status-added-committed.png";
                break;
            case (GitType.DELETED):
                icon = "icon-status-deleted.png";
                break;
            case (GitType.COMMITTED_DELETED):
                icon = "icon-status-deleted-committed.png";
                break;
            case (GitType.MODIFIED):
                icon = "icon-status-modified.png";
                break;
            case (GitType.COMMITTED_MODIFIED):
                icon = "icon-status-modified-committed.png";
                break;
            case (GitType.UNTRACKED):
                icon = "icon-status-untracked.png";
                break;
            default:
                this.iconPath = new vscode.ThemeIcon("question");
                return;
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
    UNTRACKED = "??",
    MODIFIED = "M",
    COMMITTED_MODIFIED = "CM",
    COMMITTED = "C",
    ADDED = "A",
    COMMITTED_ADDED = "CA",
    DELETED = "D",
    COMMITTED_DELETED = "CD",
    UNKNOWN = "LMAO"
}

const gitTypePriority = {
    [GitType.UNKNOWN]: 0,
    [GitType.COMMITTED_MODIFIED]: 1,
    [GitType.COMMITTED_ADDED]: 2,
    [GitType.COMMITTED_DELETED]: 3,
    [GitType.COMMITTED]: 4,
    [GitType.MODIFIED]: 5,
    [GitType.UNTRACKED]: 6,
    [GitType.ADDED]: 7,
    [GitType.DELETED]: 8,
};
