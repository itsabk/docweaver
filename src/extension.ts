import * as vscode from "vscode";
import * as fs from "fs";
import { promises as fsp } from "fs";
import * as path from "path";
import ignore from "ignore";
import axios, { AxiosRequestConfig } from "axios";
import * as util from "util";
import { marked } from "marked"; // <-- For converting Markdown to HTML

// Optional: Concurrency limit library (requires adding "p-limit" to dependencies).
// import pLimit from "p-limit";

/**
 * Global Output Channel for logs
 */
let outputChannel: vscode.OutputChannel;

// Global tree view provider for project structure
let projectStructureProvider: ProjectStructureProvider;

/**
 * Default prompt templates which can be overridden by user settings.
 * These no longer have {code} or other placeholders directly in them.
 */
const DEFAULT_FILE_PROMPT = `
Analyze the following code snippet and provide a concise technical summary. Include:

- **Imports:** List each import with its purpose.
- **Functions/Classes:** For each, include the name, parameters (with types if available), return value, and a brief description.
- **Overall Functionality:** Summarize how the code operates.
- **Additional Notes:** Highlight key details, assumptions, or edge cases.
`;

const DEFAULT_PROJECT_PROMPT = `
Using the file summaries and project structure below, generate a concise technical documentation overview. Include:

- **Project Overview:** Summarize the core purpose, main functionality, and target audience.
- **Technical Architecture:** Outline the system design, component relationships, and data flow.
- **Implementation Details:** Identify critical files, key classes/interfaces, and major dependencies.
- **Module Interactions:** Describe inter-file dependencies, API contracts, and data exchange patterns.
`;

// ─── Default prompt for module-level summarization ───────────────────────
const DEFAULT_MODULE_PROMPT = `
Analyze the following file and submodule summaries for the module.
Provide a concise summary that covers:
- The module's overall functionality.
- Key responsibilities and purpose.
- Interactions with other modules or external dependencies.
Include any critical details.
`;

/**
 * Activate the extension.
 */
export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("DocWeaver");
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
      // Regenerate project structure based on current workspace files.
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

/**
 * Deactivate the extension.
 */
export function deactivate() {
  if (outputChannel) {
    outputChannel.dispose();
  }
}

/**
 * Main function: Gathers files, summarizes each, aggregates project-wide summary
 * (using module-wise summarization), updates project structure view, and displays final documentation in a webview.
 */
async function documentProject() {
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
  // Concurrency (uncomment if using p-limit)
  // const concurrency: number = config.get("concurrency") || 2;
  // const limit = pLimit(concurrency);

  // Load .gitignore and combine with user-provided ignore patterns
  const gitignorePath = path.join(rootPath, ".gitignore");
  let ig = ignore();
  try {
    const gitignoreContent = await fsp.readFile(gitignorePath, "utf8");
    ig.add(gitignoreContent);
  } catch (err) {
    logInfo("No .gitignore found or error reading .gitignore.");
  }
  // Add additional ignore patterns
  ig.add(additionalIgnorePatterns);

  // Gather all files except node_modules by default
  const allFiles = await vscode.workspace.findFiles(
    "**/*",
    "**/node_modules/**"
  );

  // Asynchronously filter out files based on ignore patterns and file size
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

  // Build a hierarchical representation of the project structure and update tree view
  const projectStructure = buildProjectStructure(filteredFiles, rootPath);
  projectStructureProvider.update(projectStructure);

  // ─── Build a Map of file summaries for quick lookup ───────────────
  const fileSummariesMap = new Map<string, string>();
  fileSummaries.forEach((fs) => {
    fileSummariesMap.set(fs.file, fs.summary);
  });

  // ─── Generate a hierarchical module summary recursively ─────────
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
      // Ensure the DocsWeaver folder exists
      await fsp.mkdir(docsFolder, { recursive: true });

      // Save the overall project documentation
      const overallDocPath = path.join(docsFolder, outputFileName);
      await fsp.writeFile(overallDocPath, documentationContent, "utf8");

      // Save individual file summaries in the same folder structure as the project.
      for (const fileSummary of fileSummaries) {
        // fileSummary.file is the relative path (e.g., "src/utils/helper.js")
        const relativeFilePath = fileSummary.file;
        // Build the corresponding output path inside DocsWeaver
        let targetPath = path.join(docsFolder, relativeFilePath);
        // Replace the file extension with .md (or append .md if no extension)
        const parsedPath = path.parse(targetPath);
        targetPath = path.join(parsedPath.dir, parsedPath.name + ".md");

        // Ensure the target directory exists
        await fsp.mkdir(path.dirname(targetPath), { recursive: true });
        // Write the file summary
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

  // Display the documentation in a custom webview panel
  showDocumentationWebview(documentationContent);
}

/**
 * Process a single file: Read the file content and summarize it.
 */
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

/**
 * Summarize one file using Ollama or OpenAI, depending on user config.
 * The code snippet is automatically appended to the chosen file prompt.
 */
async function summarizeFile(
  content: string,
  filePath: string
): Promise<string> {
  const config = vscode.workspace.getConfiguration("docweaver");
  const apiProvider = config.get("apiProvider") as string;

  // Allow customization of the file prompt from settings.
  const customFilePrompt = config.get("filePrompt") as string;
  const promptTemplate =
    customFilePrompt && customFilePrompt.trim().length > 0
      ? customFilePrompt
      : DEFAULT_FILE_PROMPT;

  // Build final prompt by appending the code snippet at the end
  const finalPrompt = buildFilePrompt(promptTemplate, content);

  switch (apiProvider) {
    case "ollama":
      return summarizeFileWithOllama(finalPrompt, filePath);
    case "openai":
      return summarizeFileWithOpenAI(finalPrompt, filePath);
    default:
      // Fallback: Return first 5 lines as a naive summary
      return content.split("\n").slice(0, 5).join("\n");
  }
}

/**
 * Helper to combine file-level prompt with the code snippet.
 */
function buildFilePrompt(template: string, codeSnippet: string): string {
  return [
    template.trim(),
    "\nHere is the code snippet:\n```",
    codeSnippet,
    "```",
  ].join("\n");
}

/**
 * Summarize file with Ollama
 */
async function summarizeFileWithOllama(prompt: string, filePath: string) {
  const config = vscode.workspace.getConfiguration("docweaver");
  const ollamaUrl =
    (config.get("ollamaUrl") as string) || "http://localhost:11434";
  const ollamaModel = (config.get("ollamaModel") as string) || "phi4";

  try {
    const response = await fetchWithRetry(
      `${ollamaUrl}/api/generate`,
      { model: ollamaModel, prompt, stream: false },
      { timeout: 120000 }
    );
    const cleanedResponse = removeThinkTags(
      response.data.response || "Summary not available."
    );
    return cleanedResponse;
  } catch (error) {
    logError(
      `Error calling Ollama API for file ${filePath}: ${errorToMessage(error)}`
    );
    return "Summary not available (Ollama error).";
  }
}

/**
 * Summarize file with OpenAI
 */
async function summarizeFileWithOpenAI(prompt: string, filePath: string) {
  const config = vscode.workspace.getConfiguration("docweaver");
  const openaiKey = config.get("openaiKey") as string;
  if (!openaiKey) {
    logError("OpenAI API key is missing in settings.");
    return "Summary not available (no OpenAI key).";
  }

  try {
    const response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo", // Could be made configurable
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        timeout: 120000,
      }
    );

    const cleanedResponse = removeThinkTags(
      response.data.choices?.[0]?.message?.content || "Summary not available."
    );
    return cleanedResponse;
  } catch (error) {
    logError(
      `Error calling OpenAI API for file ${filePath}: ${errorToMessage(error)}`
    );
    return "Summary not available (OpenAI error).";
  }
}

/**
 * Summarize the project from all file summaries plus its structure.
 * (This function is kept as an option, though in this solution we use module-level summarization.)
 */
async function summarizeProject(
  fileSummaries: { file: string; summary: string }[],
  projectStructure: any
): Promise<string> {
  const config = vscode.workspace.getConfiguration("docweaver");
  const apiProvider = config.get("apiProvider") as string;

  // Combine the raw file summaries for reference
  const combinedSummaries = fileSummaries
    .map((f) => `File: ${f.file}\nSummary: ${f.summary}`)
    .join("\n\n");

  // Allow customization of the project prompt from settings.
  const customProjectPrompt = config.get("projectPrompt") as string;
  const promptTemplate =
    customProjectPrompt && customProjectPrompt.trim().length > 0
      ? customProjectPrompt
      : DEFAULT_PROJECT_PROMPT;

  // Build final prompt by appending the file summaries and project structure
  const finalPrompt = buildProjectPrompt(
    promptTemplate,
    combinedSummaries,
    projectStructure
  );

  switch (apiProvider) {
    case "ollama":
      return summarizeProjectWithOllama(finalPrompt);
    case "openai":
      return summarizeProjectWithOpenAI(finalPrompt);
    default:
      return "Project summary not available (no recognized API provider).";
  }
}

/**
 * Helper to combine project-level prompt with file summaries and structure.
 */
function buildProjectPrompt(
  template: string,
  fileSummaries: string,
  structure: any
): string {
  return [
    template.trim(),
    "\n\nFile Summaries:\n",
    fileSummaries,
    "\n\nProject Structure (JSON):\n```json",
    JSON.stringify(structure, null, 2),
    "```",
  ].join("");
}

/**
 * Summarize project with Ollama
 */
async function summarizeProjectWithOllama(prompt: string) {
  const config = vscode.workspace.getConfiguration("docweaver");
  const ollamaUrl =
    (config.get("ollamaUrl") as string) || "http://localhost:11434";
  const ollamaModel = (config.get("ollamaModel") as string) || "phi4";

  try {
    const response = await fetchWithRetry(
      `${ollamaUrl}/api/generate`,
      { model: ollamaModel, prompt, stream: false },
      { timeout: 120000 }
    );
    const cleanedResponse = removeThinkTags(
      response.data.response || "Project summary not available."
    );
    return cleanedResponse;
  } catch (error) {
    logError(
      `Error calling Ollama API for project summary: ${errorToMessage(error)}`
    );
    return "Project summary not available (Ollama error).";
  }
}

/**
 * Summarize project with OpenAI
 */
async function summarizeProjectWithOpenAI(prompt: string) {
  const config = vscode.workspace.getConfiguration("docweaver");
  const openaiKey = config.get("openaiKey") as string;
  if (!openaiKey) {
    logError("OpenAI API key is missing in settings.");
    return "Project summary not available (no OpenAI key).";
  }

  try {
    const response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        timeout: 120000,
      }
    );

    const cleanedResponse = removeThinkTags(
      response.data.choices?.[0]?.message?.content ||
        "Project summary not available."
    );
    return cleanedResponse;
  } catch (error) {
    logError(
      `Error calling OpenAI API for project summary: ${errorToMessage(error)}`
    );
    return "Project summary not available (OpenAI error).";
  }
}

/**
 * ─── NEW: Recursively summarize a directory (module) ───────────────────────────
 *
 * Recursively traverses the project structure.
 * For directories, gathers file summaries (from files directly inside)
 * and submodule summaries (from child directories), then generates a summary
 * for that module using the DEFAULT_MODULE_PROMPT.
 *
 * @param structure The hierarchical structure of the current module.
 * @param currentPath The relative path of the current module.
 * @param fileSummariesMap A Map from file path to its summary.
 * @returns A summary string for the module.
 */
async function summarizeDirectoryRecursively(
  structure: any,
  currentPath: string,
  fileSummariesMap: Map<string, string>
): Promise<string> {
  const collectedSummaries: string[] = [];

  // Process each child (could be a file or a subdirectory)
  for (const key of Object.keys(structure)) {
    // Build the full relative path
    const childPath = currentPath ? `${currentPath}${path.sep}${key}` : key;
    if (Object.keys(structure[key]).length === 0) {
      // Leaf node – assume it’s a file. Retrieve its summary.
      const fileSummary = fileSummariesMap.get(childPath);
      if (fileSummary) {
        collectedSummaries.push(`File: ${childPath}\nSummary: ${fileSummary}`);
      }
    } else {
      // This is a subdirectory/module. Recursively summarize it.
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

  // Combine the collected summaries into a single text block.
  const combinedSummaries = collectedSummaries.join("\n\n");

  // Build the prompt using the module prompt and the aggregated summaries.
  const modulePrompt = `${DEFAULT_MODULE_PROMPT}\n\n${combinedSummaries}`;

  // Use the same API provider as for project summarization.
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

/**
 * ─── NEW: Module summarization functions for Ollama/OpenAI ───────────────
 */
async function summarizeModuleWithOllama(prompt: string): Promise<string> {
  const config = vscode.workspace.getConfiguration("docweaver");
  const ollamaUrl =
    (config.get("ollamaUrl") as string) || "http://localhost:11434";
  const ollamaModel = (config.get("ollamaModel") as string) || "phi4";

  try {
    const response = await fetchWithRetry(
      `${ollamaUrl}/api/generate`,
      { model: ollamaModel, prompt, stream: false },
      { timeout: 120000 }
    );
    const cleanedResponse = removeThinkTags(
      response.data.response || "Module summary not available."
    );
    return cleanedResponse;
  } catch (error) {
    logError(
      `Error calling Ollama API for module summary: ${errorToMessage(error)}`
    );
    return "Module summary not available (Ollama error).";
  }
}

async function summarizeModuleWithOpenAI(prompt: string): Promise<string> {
  const config = vscode.workspace.getConfiguration("docweaver");
  const openaiKey = config.get("openaiKey") as string;
  if (!openaiKey) {
    logError("OpenAI API key is missing in settings.");
    return "Module summary not available (no OpenAI key).";
  }

  try {
    const response = await fetchWithRetry(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        timeout: 120000,
      }
    );

    const cleanedResponse = removeThinkTags(
      response.data.choices?.[0]?.message?.content ||
        "Module summary not available."
    );
    return cleanedResponse;
  } catch (error) {
    logError(
      `Error calling OpenAI API for module summary: ${errorToMessage(error)}`
    );
    return "Module summary not available (OpenAI error).";
  }
}

/**
 * Helper function to POST with retries and custom timeout.
 */
async function fetchWithRetry(
  url: string,
  data: any,
  config: AxiosRequestConfig,
  maxRetries = 2
): Promise<any> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const response = await axios.post(url, data, config);
      return response;
    } catch (error) {
      attempt++;
      logError(
        `Error calling API (attempt ${attempt}): ${errorToMessage(error)}`
      );
      if (attempt > maxRetries) {
        throw error;
      }
      // Exponential backoff delay: 2^attempt * 1000ms
      const delayTime = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayTime));
    }
  }
}

/**
 * Helper function to remove <think>...</think> tags and their content.
 */
function removeThinkTags(str: string): string {
  return str.replace(/<think>[\s\S]*?<\/think>/g, "");
}

/**
 * Builds a tree representation of the project structure based on file paths.
 */
function buildProjectStructure(files: vscode.Uri[], rootPath: string): any {
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

/**
 * Generate final Markdown documentation content.
 *
 * Includes a table of contents at the top for quick navigation.
 */
function generateDocumentationContent(
  fileSummaries: { file: string; summary: string }[],
  projectStructure: any,
  projectSummary: string
): string {
  // Table of contents links
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

/**
 * Display the documentation content in a custom webview panel,
 * rendered as HTML using the "marked" library.
 */
async function showDocumentationWebview(documentationContent: string) {
  const panel = vscode.window.createWebviewPanel(
    "documentationPreview",
    "Project Documentation",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    }
  );

  // Convert Markdown to HTML
  const htmlContent = await marked(documentationContent);

  // Wrap the rendered HTML in a basic webpage
  panel.webview.html = getWebviewContent(htmlContent);
}

/**
 * Helper function to generate HTML content for the webview.
 * We apply some basic styling for headings, code blocks, etc.
 */
function getWebviewContent(htmlContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Project Documentation</title>
  <style>
    body {
      font-family: sans-serif;
      padding: 20px;
      line-height: 1.6;
    }
    h1, h2, h3 {
      margin-top: 1.5em;
      border-bottom: 1px solid #ccc;
      padding-bottom: 0.3em;
    }
    pre {
      background: #f0f0f0;
      padding: 8px;
      overflow-x: auto;
    }
    code {
      font-family: Consolas, monospace;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
}

/**
 * Convert any error to a readable string message.
 */
function errorToMessage(error: any): string {
  return error instanceof Error
    ? error.message
    : util.inspect(error, { depth: null });
}

/**
 * Output log functions for convenience.
 */
function logError(message: string) {
  if (outputChannel) {
    outputChannel.appendLine(`[ERROR] ${message}`);
  }
}
function logInfo(message: string) {
  if (outputChannel) {
    outputChannel.appendLine(`[INFO] ${message}`);
  }
}

/**
 * ProjectStructureProvider implements a TreeDataProvider for the project structure view.
 */
class ProjectStructureProvider implements vscode.TreeDataProvider<ProjectItem> {
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
      // Return top-level items
      return Promise.resolve(this.convertToProjectItems(this.treeData));
    } else {
      // Return children of the element
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

/**
 * ProjectItem represents a node in the project structure tree.
 */
class ProjectItem extends vscode.TreeItem {
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

/**
 * (Optional) Prompt the user to select a folder if multiple workspaceFolders exist.
 */
async function promptForWorkspaceFolder(
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
