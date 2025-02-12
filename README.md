# Auto Project Documentation VSCode Extension

Auto Project Documentation is a Visual Studio Code extension that automatically generates comprehensive technical documentation for your project. It analyzes your project files, summarizes each file’s content, and produces a structured Markdown document detailing the technical aspects, architecture, and implementation details of your project.

---

## Features

- **Automated File Summarization**  
  Analyze individual source files to generate technical summaries, including information on imports, functions/classes, overall functionality, and file purpose.

- **Project-Wide Documentation**  
  Aggregate file summaries and project structure into an overall project summary covering the core purpose, technical architecture, and module interactions.

- **Customizable File Filtering**  
  Leverage your `.gitignore` rules and user-defined ignore patterns to exclude files and directories you don’t want to document. Optionally set a file size limit to skip processing very large files.

- **Configurable API Providers**  
  Choose between different API providers—**Ollama** or **OpenAI**—for generating summaries. Configure API endpoints, models, and keys as needed.

- **Progress Feedback and Logging**  
  Displays progress notifications during processing and logs detailed information (including errors) to a dedicated output channel ("Auto Documentation").

- **Output Options**  
  Open the generated documentation in a new VS Code tab and/or automatically save it to a Markdown file within your workspace.

---

## Installation

1. **Clone or Download the Repository**  
   Clone this repository to your local machine or download the ZIP archive and extract it.

2. **Install Dependencies**  
   Navigate to the extension directory in your terminal and run:

   ```bash
   npm install
   ```

   This will install the required packages (e.g., `axios`, `ignore`, etc.).

   > **Note:** If you want to enable concurrent file processing, consider installing the optional [p-limit](https://www.npmjs.com/package/p-limit) dependency.

3. **Launch the Extension**  
   Open the extension folder in Visual Studio Code and press `F5` to start a new Extension Development Host instance with the extension loaded.

---

## Configuration

The extension can be customized through the `docweaver` settings in your VS Code settings. Here are the available options:

- **`docweaver.ignorePatterns`** (`string[]`)  
  Additional file/directory patterns to ignore (besides those specified in `.gitignore`).

- **`docweaver.maxFileSizeBytes`** (`number`)  
  Maximum file size (in bytes) to process. Set to `0` to disable size checking.

- **`docweaver.saveToFile`** (`boolean`)  
  If set to `true`, the generated documentation will be saved to a file in your workspace.

- **`docweaver.outputFileName`** (`string`)  
  The name of the output file (default is `PROJECT_DOCUMENTATION.md`).

- **`docweaver.apiProvider`** (`string`)  
  Choose which API to use for summarization: `"ollama"` or `"openai"`.

- **`docweaver.ollamaUrl`** (`string`)  
  URL for the Ollama API (default is `http://localhost:11434`).

- **`docweaver.ollamaModel`** (`string`)  
  The model to use when calling the Ollama API (default is `"phi4"`).

- **`docweaver.openaiKey`** (`string`)  
  Your OpenAI API key (required if using OpenAI as the provider).

You can update these settings by navigating to **File > Preferences > Settings** (or via the gear icon) in VS Code and searching for `docweaver`.

---

## Usage

1. **Open Your Project**  
   Open the workspace you wish to document in Visual Studio Code.

2. **Run the Command**  
   Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette, then type and select:

   ```
   Document Project
   ```

   Alternatively, you can bind this command to a keyboard shortcut via your keybindings.

3. **Watch the Progress**  
   A progress notification will appear as the extension processes your files. You can follow the progress in the notification and check the "Auto Documentation" output channel for detailed logs.

4. **Review the Documentation**  
   Once processing is complete:
   - The documentation is opened in a new VS Code tab as a Markdown file.
   - If configured, the documentation is also saved to the specified output file (e.g., `PROJECT_DOCUMENTATION.md`) in your workspace.

---

## How It Works

1. **File Scanning and Filtering**  
   The extension recursively scans your workspace for files. It automatically excludes files based on:

   - The `.gitignore` file.
   - Additional ignore patterns provided in the settings.
   - Files exceeding the configured maximum size.

2. **File Summarization**  
   For each file, the extension:

   - Reads the file content.
   - Uses a detailed prompt to request a technical summary from the selected API provider (Ollama or OpenAI).
   - Applies retry logic and error handling to ensure robust API communication.

3. **Project Summarization**  
   After processing individual files, the extension:

   - Constructs a hierarchical tree of your project’s structure.
   - Aggregates file summaries and the project tree.
   - Generates an overall project summary that details the project’s architecture and implementation.

4. **Documentation Generation**  
   The final Markdown documentation includes:
   - A **Project Summary** section.
   - Detailed **File Summaries** for each processed file.
   - A JSON representation of the **Project Structure**.

---

## Dependencies

The extension relies on the following packages:

- [**axios**](https://www.npmjs.com/package/axios) – For making HTTP requests.
- [**ignore**](https://www.npmjs.com/package/ignore) – For processing `.gitignore` files and additional ignore patterns.
- [**vscode**](https://www.npmjs.com/package/vscode) – The official Visual Studio Code extension API.
- [**util**](https://nodejs.org/api/util.html) – Node.js utility module.
- _(Optional)_ [**p-limit**](https://www.npmjs.com/package/p-limit) – For concurrent file processing.

---

## Contributing

Contributions are welcome! If you have suggestions for improvements, bug fixes, or new features, please open an issue or submit a pull request.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Support

If you encounter any issues or have questions about the extension, please:

- Check the **"Auto Documentation"** output channel for detailed logs.
- Open an issue in the repository with a description of the problem and any relevant logs.

Happy documenting!
