import * as vscode from "vscode";
import * as path from "path";

export function buildProjectStructure(
  files: vscode.Uri[],
  rootPath: string
): any {
  const tree: any = {};
  for (const file of files) {
    const relative = path.relative(rootPath, file.fsPath);
    const parts = relative.split(path.sep);
    let current = tree;
    for (const part of parts) {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
  }
  return tree;
}

export class ProjectStructureProvider
  implements vscode.TreeDataProvider<ProjectItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    ProjectItem | undefined | void
  > = new vscode.EventEmitter<ProjectItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private treeData: any;

  constructor(treeData: any) {
    this.treeData = treeData;
  }

  update(treeData: any): void {
    this.treeData = treeData;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
    if (!this.treeData) {
      return Promise.resolve([]);
    }
    if (!element) {
      return Promise.resolve(this.convertToProjectItems(this.treeData));
    } else {
      return Promise.resolve(
        this.convertToProjectItems(element.children || {})
      );
    }
  }

  private convertToProjectItems(obj: any): ProjectItem[] {
    return Object.keys(obj).map((key) => {
      const childrenObj = obj[key];
      const hasChildren = Object.keys(childrenObj).length > 0;
      const item = new ProjectItem(
        key,
        hasChildren
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        childrenObj
      );
      return item;
    });
  }
}

export class ProjectItem extends vscode.TreeItem {
  public children: any;
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    children: any
  ) {
    super(label, collapsibleState);
    this.children = children;
    this.contextValue =
      collapsibleState === vscode.TreeItemCollapsibleState.None
        ? "file"
        : "directory";
  }
}

export async function promptForWorkspaceFolder(
  workspaceFolders: readonly vscode.WorkspaceFolder[]
): Promise<vscode.WorkspaceFolder | undefined> {
  if (workspaceFolders.length === 1) {
    return workspaceFolders[0];
  }
  const chosen = await vscode.window.showQuickPick(
    workspaceFolders.map((wf) => wf.name),
    { placeHolder: "Select a workspace folder to document" }
  );
  return workspaceFolders.find((wf) => wf.name === chosen);
}
