#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { Agent } from "./src/agent.js";
import { MistralClient } from "./src/mistral.js";
import { Tools } from "./src/tools.js";

function loadEnv(dir) {
  const envPath = path.join(dir, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function printHelp() {
  console.error(`Usage: agent-ai [options] [instruction]

Interactive coding agent powered by the Mistral API. Without an instruction
it starts a REPL; with one it runs a single task and exits.

Options:
  --root <dir>   Project directory the agent operates on (default: cwd)
  --model <id>   Mistral model (default: MISTRAL_MODEL or mistral-large-latest)
  --help         Show this help

Environment:
  MISTRAL_API_KEY  Required. Loaded from .env if present.
  MISTRAL_MODEL    Optional default model.`);
}

async function main() {
  const argv = process.argv.slice(2);
  const flags = { root: process.cwd(), model: null, task: [] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      return 0;
    }
    if (arg === "--root") {
      flags.root = path.resolve(argv[++i]);
    } else if (arg === "--model") {
      flags.model = argv[++i];
    } else {
      flags.task.push(arg);
    }
  }

  loadEnv(flags.root);

  const client = new MistralClient({
    apiKey: process.env.MISTRAL_API_KEY,
    model: flags.model ?? process.env.MISTRAL_MODEL ?? "mistral-large-latest",
  });

  const confirm = async (question) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    try {
      const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
      return answer === "y" || answer === "yes";
    } finally {
      rl.close();
    }
  };

  const tools = new Tools(flags.root, { confirm });
  const agent = new Agent(client, tools);

  const instruction = flags.task.join(" ").trim();
  if (instruction) {
    await agent.run(instruction);
    return 0;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  console.error(`Coding agent on ${flags.root} (model: ${client.model})`);
  console.error('Type your instructions. "/reset" clears the conversation, "/exit" quits.');
  try {
    while (true) {
      const line = (await rl.question("> ")).trim();
      if (!line) continue;
      if (line === "/exit" || line === "/quit") break;
      if (line === "/reset") {
        agent.reset();
        console.error("(conversation cleared)");
        continue;
      }
      try {
        await agent.run(line);
      } catch (err) {
        console.error(`Error: ${err.message}`);
      }
    }
  } finally {
    rl.close();
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
