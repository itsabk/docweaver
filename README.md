# DocWeaver - Automated Project Documentation for VS Code

![DocWeaver Logo](https://raw.githubusercontent.com/itsabk/docweaver/dec1d41969f0b2588e91d193d16600074a889870/assets/logo.jpg)

## Overview

DocWeaver is a VS Code extension designed to generate structured and concise documentation for projects. It automatically analyzes code files, extracts key technical details, and compiles comprehensive documentation, including project structure and inter-file relationships.

## Features

- **Automated Code Summarization**: Extracts imports, functions, classes, and overall file functionality.
- **Project-Wide Documentation**: Generates technical documentation at the project level using file summaries.
- **Module-Level Summaries**: Analyzes submodules for a structured understanding.
- **Project Structure Tree View**: Visualizes the file hierarchy within VS Code.
- **Customizable Prompts**: Users can modify summarization prompts to fit their needs.
- **Supports OpenAI & Ollama**: Choose between OpenAI’s GPT models or local Ollama-based processing.
- **Markdown Export**: Saves generated documentation to structured Markdown files.

## Installation

1. Open VS Code.
2. Install the extension from the marketplace or manually place the source in your extensions directory.
3. Restart VS Code to activate the extension.

## Usage

### Generating Documentation

1. Open a project in VS Code.
2. Use the command palette (`Ctrl + Shift + P` / `Cmd + Shift + P` on Mac).
3. Run **`DocWeaver: Document Project`**.
4. View logs in the "DocWeaver" output channel.
5. The generated documentation will be available in a `DocsWeaver` folder within your workspace.

### Viewing Documentation

- Open `PROJECT_DOCUMENTATION.md` from the `DocsWeaver` folder.
- Use the built-in webview to preview the documentation inside VS Code.
- View individual file summaries stored in Markdown format within the `DocsWeaver` directory.

### Customization

DocWeaver allows users to modify its behavior via VS Code settings (`Settings > Extensions > DocWeaver`).

- **API Provider** (`docweaver.apiProvider`): Choose between `openai` and `ollama`.
- **Custom Prompts** (`docweaver.filePrompt`, `docweaver.projectPrompt`, `docweaver.modulePrompt`).
- **Ignore Patterns** (`docweaver.ignorePatterns`): Define which files should be excluded.
- **Max File Size** (`docweaver.maxFileSizeBytes`): Set size limits for file processing.
- **Output Filename** (`docweaver.outputFileName`): Customize the documentation filename.

## Dependencies

- `vscode` - Extension API.
- `fs`, `path` - File system utilities.
- `ignore` - .gitignore parsing.
- `axios` - HTTP requests for API communication.
- `marked` - Converts Markdown to HTML for the webview.

## Troubleshooting

### Common Issues & Fixes

- **No documentation generated**: Ensure your workspace has valid files and is not empty.
- **Files are being skipped**: Check `.gitignore` and `docweaver.ignorePatterns` settings.
- **API errors**: Verify API keys or ensure the Ollama server is running.

## License

This extension is open-source and distributed under the MIT License.

## Contributions

Contributions are welcome! Feel free to submit issues or pull requests on GitHub.

## Author

Developed by itsabk. Reach out via GitHub or email for support.
