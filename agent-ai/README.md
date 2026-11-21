# agent-ai

A minimal coding agent for the terminal, powered by the Mistral API. Zero npm
dependencies — built entirely on Node.js built-ins (native `fetch`, `node:fs`,
`node:readline`, `node:child_process`).

The agent works in a loop: it inspects files, edits them, runs commands to
verify, and keeps going until the task is done.

## Capabilities

| Tool | Description |
|---|---|
| `list_files` | Recursive listing under the project root |
| `read_file` | Read a text file (256 KB limit) |
| `write_file` | Create or overwrite a file (parent dirs auto-created) |
| `run_command` | Run a shell command in the project root (60 s timeout) |

Safety rails included:

- All file paths are sandboxed to the project root (`--root`), so the agent
  cannot read or write outside it.
- Destructive commands (`rm -rf`, `sudo`, `git push --force`, piping curl to
  shell, …) require interactive confirmation before running.
- Stdout/stderr are truncated before being fed back to the model so a chatty
  command can't blow up the context.

## Setup

1. Requires Node.js 20+.
2. Copy `.env.example` to `.env` and set your key:

   ```
   MISTRAL_API_KEY=...
   MISTRAL_MODEL=mistral-large-latest
   ```

## Usage

Interactive REPL (from the project you want the agent to work on):

```sh
node /path/to/agent-ai/index.js
```

Single task:

```sh
node /path/to/agent-ai/index.js "Add a test for src/utils.js and run it"
```

Work on a different directory:

```sh
node /path/to/agent-ai/index.js --root /path/to/my-project
```

REPL commands: `/reset` clears conversation history, `/exit` quits.
