import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class ToolError extends Error {}

export class Tools {
  constructor(rootDir, { confirm, extraTools } = {}) {
    this.rootDir = path.resolve(rootDir);
    this.confirm = confirm ?? (() => Promise.resolve(true));
    this.extraTools = extraTools ?? [];
  }

  resolveSafe(relPath) {
    const resolved = path.resolve(this.rootDir, relPath);
    if (resolved !== this.rootDir && !resolved.startsWith(this.rootDir + path.sep)) {
      throw new ToolError(`Path escapes sandbox root: ${relPath}`);
    }
    return resolved;
  }

  list() {
    return [...this.extraTools.map((t) => t.def),
      {
        name: "list_files",
        description: "List files and directories, recursively, under the project root.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path to list. Defaults to the project root." },
          },
        },
      },
      {
        name: "read_file",
        description: "Read the full text content of a file.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path of the file to read." },
          },
          required: ["path"],
        },
      },
      {
        name: "write_file",
        description: "Create or overwrite a file with the given content. Parent directories are created automatically.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path of the file to write." },
            content: { type: "string", description: "Full content to write." },
          },
          required: ["path", "content"],
        },
      },
      {
        name: "run_command",
        description: "Run a shell command in the project root and return stdout, stderr, and exit code. Use for builds, tests, git, etc. Destructive commands require user confirmation.",
        inputSchema: {
          type: "object",
          properties: {
            command: { type: "string", description: "The shell command to run." },
          },
          required: ["command"],
        },
      },
    ];
  }

  async execute(name, args) {
    const extra = this.extraTools.find((t) => t.def.name === name);
    if (extra) {
      try {
        return await extra.run(args);
      } catch (err) {
        throw new ToolError(err.message);
      }
    }
    switch (name) {
      case "list_files":
        return this.listFiles(args.path ?? ".");
      case "read_file":
        return this.readFile(args.path);
      case "write_file":
        return this.writeFile(args.path, args.content);
      case "run_command":
        return this.runCommand(args.command);
      default:
        throw new ToolError(`Unknown tool: ${name}`);
    }
  }

  async listFiles(relPath) {
    const dir = this.resolveSafe(relPath);
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
    } catch (err) {
      throw new ToolError(`Cannot list ${relPath}: ${err.message}`);
    }
    const limited = entries.slice(0, 500);
    const lines = limited.map((e) => {
      const rel = path.relative(this.rootDir, path.join(e.parentPath ?? e.path, e.name));
      return e.isDirectory() ? `${rel}/` : rel;
    });
    if (entries.length > limited.length) lines.push(`... (${entries.length - limited.length} more)`);
    return lines.length ? lines.join("\n") : "(empty)";
  }

  async readFile(relPath) {
    const file = this.resolveSafe(relPath);
    try {
      const stat = await fs.stat(file);
      if (stat.size > 256 * 1024) throw new ToolError(`File too large to read: ${relPath}`);
      return await fs.readFile(file, "utf8");
    } catch (err) {
      if (err instanceof ToolError) throw err;
      throw new ToolError(`Cannot read ${relPath}: ${err.message}`);
    }
  }

  async writeFile(relPath, content) {
    if (typeof content !== "string") throw new ToolError("write_file requires string content");
    const file = this.resolveSafe(relPath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, "utf8");
    return `Wrote ${content.length} bytes to ${relPath}`;
  }

  async runCommand(command) {
    if (typeof command !== "string" || !command.trim()) {
      throw new ToolError("run_command requires a non-empty command");
    }
    const dangerous = /\brm\s+-[rf]|sudo|mkfs|shutdown|reboot|:\(\)\s*\{|curl[^|]*\|\s*(ba)?sh|git\s+push\s+--force\b/.test(command);
    if (dangerous && !(await this.confirm(`Allow command: ${command}?`))) {
      throw new ToolError("Command rejected by user");
    }
    try {
      const { stdout, stderr } = await execFileAsync("sh", ["-c", command], {
        cwd: this.rootDir,
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      });
      let out = `exit code 0`;
      if (stdout.trim()) out += `\nstdout:\n${stdout.trim().slice(0, 8000)}`;
      if (stderr.trim()) out += `\nstderr:\n${stderr.trim().slice(0, 4000)}`;
      return out;
    } catch (err) {
      const parts = [`exit code ${err.code ?? "unknown"}`];
      if (err.stdout?.trim()) parts.push(`stdout:\n${err.stdout.trim().slice(0, 8000)}`);
      if (err.stderr?.trim()) parts.push(`stderr:\n${err.stderr.trim().slice(0, 4000)}`);
      if (err.killed) parts.push("(timed out after 60s)");
      return parts.join("\n");
    }
  }
}
