import * as vscode from "vscode";
import * as util from "util";

let outputChannel: vscode.OutputChannel | undefined;

export function setOutputChannel(channel: vscode.OutputChannel) {
  outputChannel = channel;
}

export function errorToMessage(error: any): string {
  return error instanceof Error
    ? error.message
    : util.inspect(error, { depth: null });
}

export function logError(message: string) {
  if (outputChannel) {
    outputChannel.appendLine(`[ERROR] ${message}`);
  }
}

export function logInfo(message: string) {
  if (outputChannel) {
    outputChannel.appendLine(`[INFO] ${message}`);
  }
}

export function removeThinkTags(str: string): string {
  return str.replace(/<think>[\s\S]*?<\/think>/g, "");
}

export function getWebviewContent(htmlContent: string): string {
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
