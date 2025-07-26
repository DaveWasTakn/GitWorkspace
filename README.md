# Git Workspace
![Installs Badge](https://vsmarketplacebadges.dev/installs/daveWasTaken.gitworkspace.svg)
![Stars Badge](https://vsmarketplacebadges.dev/rating-star/daveWasTaken.gitworkspace.svg)
![Marketplace Version Badge](https://vsmarketplacebadges.dev/version/daveWasTaken.gitworkspace.svg)

A convenient Git-based file explorer that displays (1) currently changed files, and (2) ALL files ever modified by
the current branch (since its creation!) for one or more Git repositories.

<img src="resources/workflow_feature.gif" width="800" height="auto">

## Features

- 📁 **File Explorer Panel**  
  Displays all changed files (both tracked and untracked) from the specified Git repositories.

- 🔀 **Branch Diff View**  
  Additionally, shows ALL changes of the current branch compared to its origin (the fork-off point from the `master` or
  `main` branch)!
  This provides a clear view of every file the branch has ever changed, **ignoring intermediate merges**!
  Ideal for visualizing the full impact of a feature/topic branch.

- ⚙️ **Custom Workflows**   
  A custom workflow is a set of commands that are executed in succession within the selected repository.
  Custom Workflows can be executed in a specific repository by clicking on it in the extension's explorer.
  See the demo shown in the gif above.
  They can be easily defined in the settings!

- 🔍 **Git Status Indicators**  
  Icons next to each file indicate its current Git status (e.g., modified, added, deleted).

- 🧬 **Multi-Repository Support**  
  Works seamlessly with multiple Git repositories within the same workspace.

- 🔄 **Live Updates**  
  Automatically refreshes when files change in one of the repositories or via a manual refresh button.

## QuickStart

Just add the (absolute) path to one or multiple Git repositories in the extensions settings!

## Icons-Legend

| Icon                                              | Meaning              |
|---------------------------------------------------|----------------------|
| ![](resources/icon-status-added.png)              | Added                |
| ![](resources/icon-status-deleted.png)            | Deleted              |
| ![](resources/icon-status-modified.png)           | Modified             |
| ![](resources/icon-status-untracked.png)          | Untracked            |
|                                                   |                      |
| ![](resources/icon-status-added-committed.png)    | Committed + Added    |
| ![](resources/icon-status-modified-committed.png) | Committed + Modified |
| ![](resources/icon-status-deleted-committed.png)  | Committed + Deleted  |

The three icons on the bottom (Committed + XXXXX) represent files that have been committed to the current branch,
regardless of whether these changes have already been merged back into the default branch (master/main).

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
