# _GitWorkspace_

A convenient file explorer that displays currently changed files and their Git status for one or more Git repositories.

## Features

- **_File Explorer Panel_**: Displays changed (tracked and untracked) files from the specified Git repository.
- **_Branch Diff View_**: Also shows files changed compared to the `master` branch.
- **_Git Status Indicators_**: Displays file status through icons next to the files.
- **_Multi-Repository Support_**: Can be used with multiple Git repositories.
- **_Live Updates_**: Automatically refreshes whenever the vscode window gains focus; also offers a manual refresh
  button.

## QuickStart

Just add the (absolute) path to one or multiple git repositories in the extensions settings!

## Icons-Legend

| Icon                                              | Meaning              |
|---------------------------------------------------|----------------------|
| ![](resources/icon-status-added.png)              | Added                |
| ![](resources/icon-status-deleted.png)            | Deleted              |
| ![](resources/icon-status-modified.png)           | Modified             |
| ![](resources/icon-status-untracked.png)          | Untracked            |
| ![](resources/icon-status-committed.png)          | Committed            |
| ------                                            | -------------------- |
| ![](resources/icon-status-added-committed.png)    | Committed + Added    |
| ![](resources/icon-status-modified-committed.png) | Committed + Modified |
| ![](resources/icon-status-deleted-committed.png)  | Committed + Deleted  |

The three icons on the bottom (Committed + XXXXX) represent files changed by the current branch that have already been
merged into the default branch (master/main).

## Support

**If you like this extension you can buy me a coffee :)**

<a href="https://www.buymeacoffee.com/daveWasTakn" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="217" height="60">
</a>

**Suggestions, feature requests or contributions are welcome on [github](https://github.com/DaveWasTakn/GitWorkspace).**

**You can also leave reviews on
the [Microsoft Marketplace](https://marketplace.visualstudio.com/items?itemName=daveWasTaken.gitworkspace).**

## Repository

https://github.com/DaveWasTakn/GitWorkspace

## License

This extension is open source project released under the [MIT](LICENSE.txt) license.
