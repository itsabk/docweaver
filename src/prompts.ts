export const DEFAULT_FILE_PROMPT = `
Analyze the following code snippet and provide a concise technical summary. Include:

- **Imports:** List each import with its purpose.
- **Functions/Classes:** For each, include the name, parameters (with types if available), return value, and a brief description.
- **Overall Functionality:** Summarize how the code operates.
- **Additional Notes:** Highlight key details, assumptions, or edge cases.
`;

export const DEFAULT_PROJECT_PROMPT = `
Using the file summaries and project structure below, generate a concise technical documentation overview. Include:

- **Project Overview:** Summarize the core purpose, main functionality, and target audience.
- **Technical Architecture:** Outline the system design, component relationships, and data flow.
- **Implementation Details:** Identify critical files, key classes/interfaces, and major dependencies.
- **Module Interactions:** Describe inter-file dependencies, API contracts, and data exchange patterns.
`;

export const DEFAULT_MODULE_PROMPT = `
Analyze the following file and submodule summaries for the module.
Provide a concise summary that covers:
- The module's overall functionality.
- Key responsibilities and purpose.
- Interactions with other modules or external dependencies.
Include any critical details.
`;

export function buildFilePrompt(
  template: string | undefined,
  codeSnippet: string
): string {
  const promptTemplate = template
    ? template.trim()
    : DEFAULT_FILE_PROMPT.trim();
  return [
    promptTemplate,
    "\nHere is the code snippet:\n```",
    codeSnippet,
    "```",
  ].join("\n");
}

export function buildProjectPrompt(
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
