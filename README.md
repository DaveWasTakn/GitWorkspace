# _GitWorkspace_

A convenient file explorer that displays currently changed files and their Git status for one or more Git repositories.

## Features

- **File Explorer Panel**  
  Displays all changed files (both tracked and untracked) from the specified Git repositories.

- **Branch Diff View**  
  Additionally, shows ALL changes of the current branch compared to its origin (the fork-off point from the `master` or
  `main` branch)!
  This provides a clear view of every file the branch has ever changed, **ignoring intermediate merges**!
  Ideal for visualizing the full impact of a feature/topic branch.

- **Git Status Indicators**  
  Icons next to each file indicate its current Git status (e.g., modified, added, deleted).

- **Multi-Repository Support**  
  Works seamlessly with multiple Git repositories within the same workspace.

- **Live Updates**  
  Automatically refreshes when the VS Code window gains focus. A manual refresh button is also available.

## QuickStart

Just add the (absolute) path to one or multiple Git repositories in the extensions settings!

## Icons-Legend

| Icon                                              | Meaning           |
|---------------------------------------------------|-------------------|
| ![](resources/icon-status-added.png)              | Added             |
| ![](resources/icon-status-deleted.png)            | Deleted           |
| ![](resources/icon-status-modified.png)           | Modified          |
| ![](resources/icon-status-untracked.png)          | Untracked         |
| ![](resources/icon-status-committed.png)          | Committed         |
|                                                   |                   |
| ![](resources/icon-status-added-committed.png)    | Merged + Added    |
| ![](resources/icon-status-modified-committed.png) | Merged + Modified |
| ![](resources/icon-status-deleted-committed.png)  | Merged + Deleted  |

The three icons on the bottom (Merged + XXXXX) represent files changed by the current branch that have already been
merged into the default branch (master/main).

## Support

**If you like this extension you can buy me a coffee :)**

<a href="https://www.buymeacoffee.com/daveWasTakn" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" height="60">
</a>

**Suggestions, feature requests or contributions are welcome on [Github](https://github.com/DaveWasTakn/GitWorkspace).**

**You can also leave reviews on
the [Microsoft Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=daveWasTaken.gitworkspace).**

## Repository

https://github.com/DaveWasTakn/GitWorkspace

## License

This extension is an open source project released under the [MIT](LICENSE.txt) license.
