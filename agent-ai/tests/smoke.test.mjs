import { Tools, ToolError } from "../src/tools.js";
import { Agent } from "../src/agent.js";
import { createTermuxTools } from "../src/termux.js";
import { MistralClient } from "../src/mistral.js";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agent-ai-test-"));
const tools = new Tools(tmp);

await assert.rejects(tools.readFile("/etc/passwd"), ToolError);
await assert.rejects(tools.readFile("../../etc/passwd"), ToolError);
await assert.rejects(tools.execute("nope", {}), ToolError);

await tools.writeFile("test-dir/hello.txt", "hello world");
assert.strictEqual(await tools.readFile("test-dir/hello.txt"), "hello world");
assert.ok((await tools.listFiles("test-dir")).includes("hello.txt"));

assert.ok((await tools.runCommand("echo agent-test")).includes("agent-test"));
assert.ok((await tools.runCommand("exit 3")).includes("exit code 3"));

const seen = [];
let calls = 0;
const fakeClient = {
  async chat(messages) {
    calls++;
    seen.push(messages);
    if (calls === 1) {
      return {
        role: "assistant",
        content: null,
        toolCalls: [
          { id: "c1", function: { name: "read_file", arguments: JSON.stringify({ path: "test-dir/hello.txt" }) } },
        ],
      };
    }
    assert.strictEqual(messages.at(-1).role, "tool");
    assert.ok(messages.at(-1).content.includes("hello world"));
    return { role: "assistant", content: "The file says: hello world" };
  },
};
const agent = new Agent(fakeClient, tools, { log: () => {} });
assert.strictEqual(await agent.run("What is in test-dir/hello.txt?"), "The file says: hello world");
assert.strictEqual(seen[1].length, 5);

const originalPrefix = process.env.PREFIX;
process.env.PREFIX = "/nonexistent-com.termux";
assert.deepStrictEqual(createTermuxTools(), []);
process.env.PREFIX = originalPrefix;

const minimal = new MistralClient({ apiKey: "test-key" });
assert.strictEqual(minimal.model, "mistral-large-latest");
assert.throws(() => new MistralClient({ apiKey: "" }), /MISTRAL_API_KEY/);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("All agent-ai smoke tests passed");
