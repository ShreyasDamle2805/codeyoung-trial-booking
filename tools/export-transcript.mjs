import { readFileSync, writeFileSync, existsSync } from "node:fs";

const sources = process.argv.slice(2);
if (!sources.length)
  throw new Error(
    "Usage: node tools/export-transcript.mjs session.jsonl [another-session.jsonl]",
  );
const records = sources.flatMap((source) =>
  readFileSync(source, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line)),
);
const events = records
  .filter((record) => record.type === "response_item")
  .sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
const toolTypes = [
  "function_call",
  "function_call_output",
  "custom_tool_call",
  "custom_tool_call_output",
];
function textOnly(value) {
  if (typeof value === "string") {
    if (value.startsWith("data:image/") || value.startsWith("data:audio/"))
      return "[binary media omitted]";
    try {
      return textOnly(JSON.parse(value));
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(textOnly);
  if (value && typeof value === "object") {
    if (
      ["image", "image_url", "input_image", "audio", "input_audio"].includes(
        value.type,
      ) ||
      value.image_url
    )
      return "[binary media omitted]";
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, textOnly(entry)]),
    );
  }
  return value;
}
let output = `# AI interaction transcript\n\nExported ${new Date().toISOString()}. This is a snapshot of the available sessions, not a reconstruction. User and assistant messages and textual tool interactions are included; internal reasoning, system/developer instructions, and binary images/audio are excluded. Refresh after the final AI response and include any other sessions separately.\n\n`;
let messages = 0,
  tools = 0;
const seen = new Set();
for (const record of events) {
  const event = record.payload;
  if (event.id && seen.has(event.id)) continue;
  if (event.id) seen.add(event.id);
  if (
    event.type === "message" &&
    ["user", "assistant"].includes(event.role) &&
    event.channel !== "analysis"
  ) {
    const text = event.content.map((part) => part.text || "").join("\n");
    if (!text) continue;
    output += `## ${event.role === "user" ? "User" : "Assistant"}${event.channel === "commentary" ? " — progress update" : ""}\n\n${text}\n\n---\n\n`;
    messages++;
  } else if (toolTypes.includes(event.type)) {
    const content = textOnly(
      event.arguments ?? event.input ?? event.output ?? "",
    );
    const text =
      typeof content === "string" ? content : JSON.stringify(content, null, 2);
    const fence = "`".repeat(
      Math.max(
        3,
        ...[...text.matchAll(/`+/g)].map((match) => match[0].length + 1),
      ),
    );
    output += `<details>\n<summary>Tool ${event.name || "result"} (${event.call_id || tools + 1})</summary>\n\n${fence}text\n${text}\n${fence}\n\n</details>\n\n`;
    tools++;
  }
}
if (existsSync("docs/provided-context.txt"))
  output +=
    "## Earlier context supplied by the user (verbatim attachment)\n\n" +
    readFileSync("docs/provided-context.txt", "utf8");
writeFileSync("TRANSCRIPT.md", output);
console.log(
  `Exported ${messages} messages and ${tools} textual tool interactions to TRANSCRIPT.md`,
);
