# DocWeaver - Automated Project Documentation for VS Code

<div align="center">

<a href="https://marketplace.visualstudio.com/items?itemName=itsabk.docweaver">
<img src="https://raw.githubusercontent.com/itsabk/docweaver/dec1d41969f0b2588e91d193d16600074a889870/assets/logo.jpg" alt="DocWeaver Logo" width="120" />
</a>

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/itsabk.docweaver.svg?style=flat&label=VS%20Marketplace&labelColor=1e1e1e&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=itsabk.docweaver)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/itsabk.docweaver.svg?style=flat&label=Downloads&labelColor=1e1e1e&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=itsabk.docweaver)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat&labelColor=1e1e1e&color=007ACC)](LICENSE)

_Generate comprehensive project documentation with AI-powered analysis_

</div>

## 🎯 Overview

DocWeaver is a VS Code extension designed to generate structured and concise documentation for projects. It automatically analyzes code files, extracts key technical details, and compiles comprehensive documentation, including project structure and inter-file relationships.

## ✨ Features

- **Automated Code Summarization**: Extracts imports, functions, classes, and overall file functionality
- **Project-Wide Documentation**: Generates technical documentation at the project level using file summaries
- **Module-Level Summaries**: Analyzes submodules for a structured understanding
- **Project Structure Tree View**: Visualizes the file hierarchy within VS Code
- **Customizable Prompts**: Users can modify summarization prompts to fit their needs
- **Supports OpenAI & Ollama**: Choose between OpenAI's GPT models or local Ollama-based processing
- **Markdown Export**: Saves generated documentation to structured Markdown files

## 📦 Installation

1. Install directly from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=itsabk.docweaver)
2. Or install from within VS Code:
   - Open VS Code
   - Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
   - Search for "DocWeaver"
   - Click Install
3. Restart VS Code to activate the extension

## 🚀 Usage

### Generating Documentation

1. Open a project in VS Code
2. Use the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P` on Mac)
3. Run **`DocWeaver: Document Project`**
4. View logs in the "DocWeaver" output channel
5. The generated documentation will be available in a `DocsWeaver` folder within your workspace

### Viewing Documentation

- Open `PROJECT_DOCUMENTATION.md` from the `DocsWeaver` folder
- Use the built-in webview to preview the documentation inside VS Code
- View individual file summaries stored in Markdown format within the `DocsWeaver` directory

### Customization

DocWeaver allows users to modify its behavior via VS Code settings (`Settings > Extensions > DocWeaver`):

| Setting                      | Description                           |
| ---------------------------- | ------------------------------------- |
| `docweaver.apiProvider`      | Choose between `openai` and `ollama`  |
| `docweaver.filePrompt`       | Custom prompt for file analysis       |
| `docweaver.projectPrompt`    | Custom prompt for project analysis    |
| `docweaver.modulePrompt`     | Custom prompt for module analysis     |
| `docweaver.ignorePatterns`   | Define which files should be excluded |
| `docweaver.maxFileSizeBytes` | Set size limits for file processing   |
| `docweaver.outputFileName`   | Customize the documentation filename  |

## 🔧 Dependencies

- `vscode` - Extension API
- `fs`, `path` - File system utilities
- `ignore` - .gitignore parsing
- `axios` - HTTP requests for API communication
- `marked` - Converts Markdown to HTML for the webview

## ❓ Troubleshooting

### Common Issues & Fixes

- **No documentation generated**: Ensure your workspace has valid files and is not empty
- **Files are being skipped**: Check `.gitignore` and `docweaver.ignorePatterns` settings
- **API errors**: Verify API keys or ensure the Ollama server is running

## 📄 License

This extension is open-source and distributed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues or pull requests on GitHub.

## 👤 Author

Developed by itsabk. Reach out via GitHub or email for support.

---

<div align="center">
<sub>If you find DocWeaver helpful, please consider giving it a ⭐️ on the marketplace!</sub>
</div>
