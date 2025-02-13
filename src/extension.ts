import * as vscode from "vscode";
import { documentProject } from "./documentation";
import {
  ProjectStructureProvider,
  buildProjectStructure,
} from "./projectStructure";
import { errorToMessage, logError, setOutputChannel } from "./utils";
import { fileSummariesMap } from "./fileSummariesStore";

let outputChannel: vscode.OutputChannel;
let projectStructureProvider: ProjectStructureProvider;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("DocWeaver");
  setOutputChannel(outputChannel);
  outputChannel.appendLine("Extension Activated: Auto Project Documentation");

  // Register the main command to document the project.
  const disposable = vscode.commands.registerCommand(
    "extension.documentProject",
    async () => {
      try {
        await documentProject();
      } catch (error) {
        vscode.window.showErrorMessage(
          "Error generating documentation. See 'DocWeaver' output for details."
        );
        logError(`documentProject error: ${errorToMessage(error)}`);
      }
    }
  );
  context.subscriptions.push(disposable);

  // Register command to open documentation settings.
  const settingsDisposable = vscode.commands.registerCommand(
    "extension.openDocumentationSettings",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "docweaver"
      );
    }
  );
  context.subscriptions.push(settingsDisposable);

  // Register command to open file documentation from the tree view.
  const openFileDocDisposable = vscode.commands.registerCommand(
    "extension.openFileDocumentation",
    async (relativePath: string) => {
      const summary = fileSummariesMap.get(relativePath);
      if (!summary) {
        vscode.window.showErrorMessage(
          `No documentation available for ${relativePath}`
        );
        return;
      }
      const doc = await vscode.workspace.openTextDocument({
        content: summary,
        language: "markdown",
      });
      vscode.window.showTextDocument(doc, { preview: false });
    }
  );
  context.subscriptions.push(openFileDocDisposable);

  // Initialize and register the project structure tree view.
  projectStructureProvider = new ProjectStructureProvider({});
  vscode.window.registerTreeDataProvider(
    "projectStructureView",
    projectStructureProvider
  );

  // Register command to refresh the project structure view manually.
  const refreshDisposable = vscode.commands.registerCommand(
    "extension.refreshProjectStructure",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const allFiles = await vscode.workspace.findFiles(
        "**/*",
        "**/node_modules/**"
      );
      const newStructure = buildProjectStructure(allFiles, rootPath);
      projectStructureProvider.update(newStructure);
    }
  );
  context.subscriptions.push(refreshDisposable);
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
}
