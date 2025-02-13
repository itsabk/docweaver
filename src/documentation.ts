import * as vscode from "vscode";
import * as fs from "fs";
import { promises as fsp } from "fs";
import * as path from "path";
import ignore from "ignore";
import { marked } from "marked";
import { buildFilePrompt, DEFAULT_MODULE_PROMPT } from "./prompts";
import {
  summarizeFileWithOllama,
  summarizeFileWithOpenAI,
  summarizeModuleWithOllama,
  summarizeModuleWithOpenAI,
} from "./api";
import { buildProjectStructure } from "./projectStructure";
import { logError, logInfo, errorToMessage, getWebviewContent } from "./utils";
import { fileSummariesMap } from "./fileSummariesStore";

export async function documentProject() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage("No workspace folder found.");
    return;
  }
  const rootPath = workspaceFolders[0].uri.fsPath;
  const config = vscode.workspace.getConfiguration("docweaver");

  // Read settings
  const additionalIgnorePatterns: string[] = config.get("ignorePatterns") || [];
  const maxFileSize: number = config.get("maxFileSizeBytes") || 0; // 0 => no limit
  const saveToFile: boolean = config.get("saveToFile") || true;
  const outputFileName: string =
    config.get("outputFileName") || "PROJECT_DOCUMENTATION.md";

  // Load .gitignore and combine with user-provided ignore patterns
  const gitignorePath = path.join(rootPath, ".gitignore");
  let ig = ignore();
  try {
    const gitignoreContent = await fsp.readFile(gitignorePath, "utf8");
    ig.add(gitignoreContent);
  } catch (err) {
    logInfo("No .gitignore found or error reading .gitignore.");
  }
  ig.add(additionalIgnorePatterns);

  // Gather all files except node_modules by default
  const allFiles = await vscode.workspace.findFiles(
    "**/*",
    "**/node_modules/**"
  );
  const filteredFiles: vscode.Uri[] = [];
  for (const file of allFiles) {
    const relative = path.relative(rootPath, file.fsPath);
    if (ig.ignores(relative)) {
      continue;
    }
    if (maxFileSize > 0) {
      try {
        const stats = await fsp.stat(file.fsPath);
        if (stats.size > maxFileSize) {
          logInfo(
            `Skipping ${relative} (exceeds max file size: ${stats.size})`
          );
          continue;
        }
      } catch (err) {
        logError(`Error reading stats for ${relative}: ${errorToMessage(err)}`);
        continue;
      }
    }
    filteredFiles.push(file);
  }

  // Process files with a progress bar that supports cancellation
  const fileSummaries: { file: string; summary: string }[] = [];
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Generating documentation...",
      cancellable: true,
    },
    async (progress, token) => {
      for (let i = 0; i < filteredFiles.length; i++) {
        if (token.isCancellationRequested) {
          logInfo("Documentation generation cancelled by user.");
          break;
        }
        const file = filteredFiles[i];
        progress.report({
          message: `Processing file ${i + 1} of ${filteredFiles.length}`,
          increment: ((i + 1) / filteredFiles.length) * 100,
        });
        const summary = await processSingleFile(file, rootPath);
        fileSummaries.push({
          file: path.relative(rootPath, file.fsPath),
          summary,
        });
      }
    }
  );

  // Build project structure
  const projectStructure = buildProjectStructure(filteredFiles, rootPath);

  // Update the shared file summaries store.
  fileSummaries.forEach((fs) => {
    fileSummariesMap.set(fs.file, fs.summary);
  });

  // Generate a hierarchical module summary recursively
  const moduleSummary = await summarizeDirectoryRecursively(
    projectStructure,
    "",
    fileSummariesMap
  );

  // Use the module summary as the final project summary
  const projectSummary = moduleSummary;

  // Generate final Markdown documentation
  const documentationContent = generateDocumentationContent(
    fileSummaries,
    projectStructure,
    projectSummary
  );

  // Optionally save the documentation to a file in the workspace
  if (saveToFile) {
    const docsFolder = path.join(rootPath, "DocsWeaver");
    try {
      await fsp.mkdir(docsFolder, { recursive: true });
      const overallDocPath = path.join(docsFolder, outputFileName);
      await fsp.writeFile(overallDocPath, documentationContent, "utf8");

      // Save individual file summaries mirroring the project structure.
      for (const fileSummary of fileSummaries) {
        const relativeFilePath = fileSummary.file;
        let targetPath = path.join(docsFolder, relativeFilePath);
        const parsedPath = path.parse(targetPath);
        targetPath = path.join(parsedPath.dir, parsedPath.name + ".md");
        await fsp.mkdir(path.dirname(targetPath), { recursive: true });
        await fsp.writeFile(targetPath, fileSummary.summary, "utf8");
      }

      vscode.window.showInformationMessage(
        `Project documentation saved in the DocsWeaver folder.`
      );
      logInfo(`Documentation saved to folder: ${docsFolder}`);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to save documentation in the DocsWeaver folder.`
      );
      logError(`Error writing documentation: ${errorToMessage(err)}`);
    }
  }

  // Display the overall documentation in a webview panel.
  showDocumentationWebview(documentationContent);
}

async function processSingleFile(
  file: vscode.Uri,
  rootPath: string
): Promise<string> {
  try {
    const content = await fsp.readFile(file.fsPath, "utf8");
    const summary = await summarizeFile(content, file.fsPath);
    return summary;
  } catch (error) {
    logError(`Error processing file ${file.fsPath}: ${errorToMessage(error)}`);
    return "Summary not available (error reading file).";
  }
}

async function summarizeFile(
  content: string,
  filePath: string
): Promise<string> {
  const config = vscode.workspace.getConfiguration("docweaver");
  const apiProvider = config.get("apiProvider") as string;
  const customFilePrompt = config.get("filePrompt") as string;
  const promptTemplate =
    customFilePrompt && customFilePrompt.trim().length > 0
      ? customFilePrompt
      : undefined;
  const finalPrompt = buildFilePrompt(promptTemplate, content);

  switch (apiProvider) {
    case "ollama":
      return summarizeFileWithOllama(finalPrompt, filePath);
    case "openai":
      return summarizeFileWithOpenAI(finalPrompt, filePath);
    default:
      return content.split("\n").slice(0, 5).join("\n");
  }
}

async function summarizeDirectoryRecursively(
  structure: any,
  currentPath: string,
  fileSummariesMap: Map<string, string>
): Promise<string> {
  const collectedSummaries: string[] = [];

  for (const key of Object.keys(structure)) {
    const childPath = currentPath ? `${currentPath}${path.sep}${key}` : key;
    if (Object.keys(structure[key]).length === 0) {
      const fileSummary = fileSummariesMap.get(childPath);
      if (fileSummary) {
        collectedSummaries.push(`File: ${childPath}\nSummary: ${fileSummary}`);
      }
    } else {
      const submoduleSummary = await summarizeDirectoryRecursively(
        structure[key],
        childPath,
        fileSummariesMap
      );
      collectedSummaries.push(
        `Module: ${childPath}\nSummary: ${submoduleSummary}`
      );
    }
  }

  const combinedSummaries = collectedSummaries.join("\n\n");
  const modulePrompt = `${DEFAULT_MODULE_PROMPT}\n\n${combinedSummaries}`;
  const config = vscode.workspace.getConfiguration("docweaver");
  const apiProvider = config.get("apiProvider") as string;

  switch (apiProvider) {
    case "ollama":
      return await summarizeModuleWithOllama(modulePrompt);
    case "openai":
      return await summarizeModuleWithOpenAI(modulePrompt);
    default:
      return combinedSummaries;
  }
}

function generateDocumentationContent(
  fileSummaries: { file: string; summary: string }[],
  projectStructure: any,
  projectSummary: string
): string {
  const tableOfContents = `
- [Project Summary](#project-summary)
- [File Summaries](#file-summaries)
- [Project Structure](#project-structure)
`;

  let content = `# Project Documentation

${tableOfContents}

## Project Summary
${projectSummary}

## File Summaries
`;

  fileSummaries.forEach((fs) => {
    content += `### ${fs.file}\n\n${fs.summary}\n\n`;
  });

  content += `## Project Structure
\`\`\`json
${JSON.stringify(projectStructure, null, 2)}
\`\`\`
`;

  return content;
}

async function showDocumentationWebview(documentationContent: string) {
  const panel = vscode.window.createWebviewPanel(
    "documentationPreview",
    "Project Documentation",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const htmlContent = await marked(documentationContent);
  panel.webview.html = getWebviewContent(htmlContent);
}
