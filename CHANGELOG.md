# v2.0.1
## Changes
- Update README
  - Remove custom labels from badges, vscode marketplace rejects them

# v2.0.2
## Changes
- Refresh the tree whenever an extension specific setting is changed
- Improve error handling and reporting
  - Skip empty path entries in the repository settings
  - Check if the directory actually exists whenever a command fails and notify the user
- Improve logging (to dev console)
- Update README


# v2.0.1
## Changes
- Update README


# v2.0.0
## Additions
- A right-click context menu which includes the following options:
  - diff: latest commit
    - a diff of the selected file to the HEAD (current latest commit)
  - diff: branch origin
    - a diff of the selected file and the state it was in when the branch was created. Showing ALL changes that the
      current branch made to this file
  - rename
  - rollback
    - discard all current changes and revert the file to the latest commit
  - delete
    - if possible (if the os supports it), move the file to the trash

## Changes
- Synchronize the selection in the tree view based on the current opened document!
- Code Refactoring
- Remove unnecessary files from being packaged into the vsix, thus shrinking the extension size from 2.9 MB to 70 KB. 
- Update README


# v1.2.0
## Additions
- Custom Workflows
    - A custom workflow is a set of commands that are executed in succession within the selected repository, and can be easily defined in the settings.

<img src="https://raw.githubusercontent.com/DaveWasTakn/GitWorkspace/refs/heads/main/resources/excluded/workflow_feature.gif" width="800" height="auto">

## Changes
- update README


# v1.1.4
## Fixes
- fix splitting regex not working correctly due to lazy modifier


# v1.1.3
## Fixes
- fix unexpected `git diff` output on renames
    - by using the `--no-renames` flag
- handle tabs `\t` in filenames by using null-character `\0` as delimiter for `git diff`
    - by using the `-z` flag


# v1.1.2
## Additions
- Add FileSystemWatchers for each repository to automatically refresh on any changes


# v1.1.1
## Changes
- update README
- add icon
- rename to "Git Workspace"


# v1.1.0
## Additions
- implement a diff to the actual branch origin!
    - retain and display file-status-info for branch diff with its origin fork-point
- cache repository information
- add button to reset this cache

## Changes
- some refactoring to reduce unnecessary operations


# v1.0.4
## Changes
- remove default value for repository path settings


# v1.0.3
## Changes
- update error message when repository path is invalid (#1)
- clarify correct path specification in extension settings


# v1.0.2
## Changes
- update README


# v1.0.1
## Additions
- add option to manually specify the path to a particular _git_ executable
- add funding option

## Changes
- adjust settings to be more user friendly

## Fixes
- fix missing file error on case-sensitive systems
    - by using `forceConsistentCasingInFileNames` option
- fix os specific issues when executing commands (argument handling)
    - by using `execFile`  instead of just `exec`
