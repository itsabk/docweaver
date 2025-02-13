import axios, { AxiosRequestConfig } from "axios";
import { logError, errorToMessage, removeThinkTags } from "./utils";
import * as vscode from "vscode";

export async function summarizeFileWithOllama(
  prompt: string,
  filePath: string
): Promise<string> {
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

export async function summarizeFileWithOpenAI(
  prompt: string,
  filePath: string
): Promise<string> {
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

export async function summarizeModuleWithOllama(
  prompt: string
): Promise<string> {
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

export async function summarizeModuleWithOpenAI(
  prompt: string
): Promise<string> {
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

export async function fetchWithRetry(
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
      const delayTime = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delayTime));
    }
  }
}
