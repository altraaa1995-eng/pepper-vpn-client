import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function termuxApiAvailable() {
  const prefix = process.env.PREFIX ?? "";
  if (!prefix.includes("com.termux")) return false;
  return fs.existsSync(`${prefix}/bin/termux-api`);
}

export function createTermuxTools() {
  if (!termuxApiAvailable()) return [];

  async function run(bin, args, { timeout = 30_000 } = {}) {
    try {
      const { stdout } = await execFileAsync(bin, args, { timeout });
      return stdout.trim();
    } catch (err) {
      const detail = err.stderr?.trim() ?? err.message;
      throw new Error(`${bin} failed (is the Termux:API app installed?): ${detail}`);
    }
  }

  return [
    {
      def: {
        name: "phone_notify",
        description: "Show an Android notification on this phone with a title and message. Use to alert the user when a long task finishes or needs attention.",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string", description: "Notification title." },
            content: { type: "string", description: "Notification message." },
          },
          required: ["title", "content"],
        },
      },
      run: ({ title, content }) => run("termux-notification", ["--title", String(title).slice(0, 100), "--content", String(content).slice(0, 500)])
        .then(() => "Notification sent"),
    },
    {
      def: {
        name: "phone_speak",
        description: "Speak text out loud on the phone using text-to-speech.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to speak. Keep it short." },
          },
          required: ["text"],
        },
      },
      run: ({ text }) => run("termux-tts-speak", [String(text).slice(0, 500)])
        .then(() => "Spoken"),
    },
    {
      def: {
        name: "phone_battery",
        description: "Get the phone battery status (percentage, charging state). Useful before long tasks.",
        inputSchema: { type: "object", properties: {} },
      },
      run: () => run("termux-battery-status", []).then((out) => {
        try {
          const s = JSON.parse(out);
          return `Battery ${s.percentage}%, ${s.plugged && s.plugged !== "UNPLUGGED" ? "charging" : "on battery"}`;
        } catch {
          return out.slice(0, 500);
        }
      }),
    },
  ];
}
