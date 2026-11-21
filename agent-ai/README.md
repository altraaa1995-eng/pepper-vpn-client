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

## Running on Android (Termux)

The agent runs on your phone inside the [Termux](https://termux.dev) terminal
app (install Termux from F-Droid, not Play Store).

1. Install Termux, then in Termux run the one-time setup script:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/altraaa1995-eng/pepper-vpn-client/agent-ai/scripts/termux-setup.sh | bash
   ```

   or, if you already copied the files to the phone:

   ```sh
   bash scripts/termux-setup.sh
   ```

   It installs `nodejs` and `git`, downloads the agent into `~/agent-ai`, and
   writes your Mistral API key into a `600`-permission `.env` file.

2. Optional phone extras — install the `termux-api` package
   (`pkg install termux-api`) **and** the Termux:API add-on app. The agent then
   gains three extra tools the model can call:

   | Tool | Description |
   |---|---|
   | `phone_notify` | Send an Android notification (e.g. when a long task finishes) |
   | `phone_speak` | Speak text aloud via text-to-speech |
   | `phone_battery` | Read battery level/charging state |

   Without `termux-api` installed the tools are simply not offered to the
   model, and everything else works the same.

3. Run it against a folder on your phone:

   ```sh
   termux-setup-storage            # once, to access /storage/emulated/0
   cd ~/my-project                 # or ~/storage/shared/...
   node ~/agent-ai/index.js --root . "write a TODO.md listing open bugs"
   ```

   Or start the interactive REPL with `node ~/agent-ai/index.js`.
