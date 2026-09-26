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
const messages = records
  .filter(
    (record) =>
      record.type === "response_item" &&
      record.payload?.type === "message" &&
      ["user", "assistant"].includes(record.payload.role) &&
      record.payload.channel !== "analysis",
  )
  .sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));

function readableMessage(text) {
  // These blocks are IDE-injected context, not the user's task or AI response.
  text = text
    .replace(/<recommended_plugins>[\s\S]*?<\/recommended_plugins>/g, "")
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/g, "")
    .replace(
      /# AGENTS\.md instructions\s*<INSTRUCTIONS>[\s\S]*?<\/INSTRUCTIONS>/g,
      "",
    );

  // Keep the exact request following the IDE's file/tab/attachment preamble.
  if (
    /^\s*# (?:Context from my IDE setup|Files pasted by the user):/.test(text)
  ) {
    const marker = /^## My request:\s*\n/m.exec(text);
    if (marker) text = text.slice(marker.index + marker[0].length);
  }

  // Render the actual clarification answer, not the UI's opaque identifiers.
  const reply =
    /<send_user_message_question_reply>\s*([\s\S]*?)\s*<\/send_user_message_question_reply>/.exec(
      text,
    );
  if (reply) {
    const answers = JSON.parse(reply[1]);
    text = answers
      .map(({ question, answer }) => `Reply to: ${question}\n\n${answer}`)
      .join("\n\n");
  }

  // Retain useful source links without exposing the workstation's drive or username.
  return text
    .replace(/[A-Z]:[\\/]codeyoung-trial-booking[\\/]/gi, "")
    .replace(
      /[A-Z]:[\\/]Users[\\/][^\\/\r\n]+[\\/]\.codex[\\/]attachments[\\/][^\\/\r\n]+[\\/][^\r\n]+/gi,
      "[local attachment; supplied text is included below]",
    )
    .trim();
}

let output = `# AI interaction transcript\n\nExported ${new Date().toISOString()}.\n\n## Export policy\n\nThis is a chronological record of the available **user prompts and user-facing assistant responses**, including progress updates and clarification answers. The dialogue is not summarized or rewritten.\n\nFor readability, the export omits tool execution records, IDE-injected plugin/environment/file-tab metadata, internal reasoning, system/developer instructions, and binary media. Workspace file links are made relative and local attachment paths are omitted. These presentation changes do not change the implementation requests or answers. Generated source code and tests are available in the repository. Original execution records remain in the local session files; they are not part of this public transcript.\n\nThe earlier conversation and review attachment supplied by the user are preserved below as source material, with their original wording. Their claims are not independently endorsed by the exporter. This is a snapshot through export time: refresh after further AI work, and supply any additional session files when exporting.\n\n## Implementation conversation\n\n`;
const seen = new Set();
let count = 0;
for (const { payload, timestamp } of messages) {
  if (payload.id && seen.has(payload.id)) continue;
  if (payload.id) seen.add(payload.id);
  const text = readableMessage(
    payload.content.map((part) => part.text || "").join("\n"),
  );
  if (!text) continue;
  count++;
  const role = payload.role === "user" ? "User" : "Assistant";
  const detail = payload.channel === "commentary" ? " — progress update" : "";
  output += `### ${count}. ${role}${detail}\n\n${timestamp ? `*${timestamp}*\n\n` : ""}${text}\n\n---\n\n`;
}

for (const [path, title] of [
  [
    "docs/provided-context.txt",
    "Earlier assignment context and conversation supplied by the user",
  ],
  [
    "docs/review-feedback.txt",
    "Claude review supplied by the user after publication",
  ],
]) {
  if (!existsSync(path)) continue;
  output += `## ${title}\n\n<details>\n<summary>Expand the full original supplied text</summary>\n\n${readFileSync(path, "utf8")}\n\n</details>\n\n`;
}
writeFileSync("TRANSCRIPT.md", output.trimEnd() + "\n");
console.log(
  `Exported ${count} user/assistant messages without tool or IDE metadata.`,
);
