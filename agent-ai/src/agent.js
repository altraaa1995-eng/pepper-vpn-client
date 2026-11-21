import { MistralClient } from "./mistral.js";
import { Tools, ToolError } from "./tools.js";

const SYSTEM_PROMPT = `You are a coding agent working inside a project directory.
You can list files, read and write files, and run shell commands.
Rules:
- Inspect before editing: read relevant files and understand the project before making changes.
- Make the smallest correct change that satisfies the user's request.
- After edits, verify your work (run tests, builds, or the relevant commands).
- Never invent file contents you have not read.
- Report what you changed and how you verified it.`;

const MAX_TOOL_ROUNDS = 25;

export class Agent {
  constructor(client, tools, { log = console.error } = {}) {
    this.client = client;
    this.tools = tools;
    this.log = log;
    this.messages = [];
  }

  reset() {
    this.messages = [];
  }

  async run(userInput) {
    if (this.messages.length === 0) {
      this.messages.push({ role: "system", content: SYSTEM_PROMPT });
    }
    this.messages.push({ role: "user", content: userInput });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const assistant = await this.client.chat(this.messages, this.tools.list());
      this.messages.push(assistant);

      if (assistant.content) {
        this.log(assistant.content);
      }

      const toolCalls = assistant.toolCalls ?? [];
      if (toolCalls.length === 0) {
        return assistant.content ?? "";
      }

      for (const call of toolCalls) {
        const name = call.function?.name;
        let args;
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }

        this.log(`→ ${name} ${truncated(JSON.stringify(args))}`);
        let result;
        try {
          result = await this.tools.execute(name, args);
        } catch (err) {
          result = err instanceof ToolError ? `Error: ${err.message}` : `Error: ${err.message}`;
        }
        this.log(`← ${truncated(String(result).replace(/\n/g, " "))}`);

        this.messages.push({
          role: "tool",
          name,
          content: String(result).slice(0, 12_000),
          tool_call_id: call.id,
        });
      }
    }

    this.log("(stopped: reached tool-call round limit)");
    return "";
  }
}

function truncated(text, max = 200) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}
