export type InlineCommand = {
  name: string;
  switchValue: string;
  context: string;
  argsRaw: string;
  args: Record<string, string>;
  fullFrom: number;
  fullTo: number;
  contextFrom: number;
  contextTo: number;
};

export type BlockCommand = {
  name: string;
  title: string;
  content: string;
};

function cleanArgValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

export function parseCommandArgs(raw = ""): Record<string, string> {
  const body = raw.trim().replace(/^\{/, "").replace(/\}$/, "").trim();
  if (!body) return {};
  const out: Record<string, string> = {};
  for (const part of body.split(/[;,]/)) {
    const match = part.trim().match(/^([A-Za-z][\w-]*)\s*:\s*(.+)$/);
    if (!match) continue;
    out[match[1].toLowerCase()] = cleanArgValue(match[2]);
  }
  return out;
}

function findClose(text: string, open: number, closeChar: "]" | "}"): number {
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") return -1;
    if (ch === closeChar) return i;
  }
  return -1;
}

function metaRange(text: string, closeBracket: number): { raw: string; fullTo: number } {
  let openBrace = closeBracket + 1;
  while (openBrace < text.length && (text[openBrace] === " " || text[openBrace] === "\t")) openBrace++;
  if (text[openBrace] !== "{") return { raw: "", fullTo: closeBracket + 1 };
  const closeBrace = findClose(text, openBrace, "}");
  if (closeBrace < 0) return { raw: "", fullTo: closeBracket + 1 };
  return {
    raw: text.slice(openBrace, closeBrace + 1),
    fullTo: closeBrace + 1,
  };
}

export function scanInlineCommands(text: string, name?: string): InlineCommand[] {
  const commands: InlineCommand[] = [];
  const re = /@@([A-Za-z][\w-]*)(?:\(([^)\n]*)\))?[ \t]+\[/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const commandName = match[1].toLowerCase();
    if (name && commandName !== name.toLowerCase()) continue;
    const openBracket = re.lastIndex - 1;
    const closeBracket = findClose(text, openBracket, "]");
    if (closeBracket < 0) continue;
    const meta = metaRange(text, closeBracket);
    commands.push({
      name: commandName,
      switchValue: match[2]?.trim() ?? "",
      context: text.slice(openBracket + 1, closeBracket),
      argsRaw: meta.raw,
      args: parseCommandArgs(meta.raw),
      fullFrom: match.index,
      fullTo: meta.fullTo,
      contextFrom: openBracket + 1,
      contextTo: closeBracket,
    });
    re.lastIndex = meta.fullTo;
  }
  return commands;
}

export function parseBlockCommandOpenLine(line: string): { name: string; title: string } | null {
  const match = line.match(/^\s*#\+begin(?:_|\s+)([A-Za-z][\w-]*)(?:\s+([^\n]+?))?\s*$/i);
  if (!match) return null;
  return {
    name: match[1].toLowerCase(),
    title: match[2]?.trim() ?? "",
  };
}

export function isBlockCommandCloseLine(line: string, name: string): boolean {
  const escaped = line.replace(/^(\s*)\\(?=#\+end)/i, "$1");
  const pattern = new RegExp(`^\\s*#\\+end(?:_|\\s+)${name}\\s*$`, "i");
  return pattern.test(escaped);
}

export function parseBlockCommandText(text: string): BlockCommand | null {
  const open = text.match(/^\s*#\+begin(?:_|\s+)([A-Za-z][\w-]*)(?:\s+([^\n]+?))?\s*\n/i);
  if (!open) return null;
  const name = open[1].toLowerCase();
  const lines = text.slice(open[0].length).replace(/\n$/, "").split(/\n/);
  const closeLine = lines.at(-1) ?? "";
  if (!isBlockCommandCloseLine(closeLine, name)) return null;
  return {
    name,
    title: open[2]?.trim() ?? "",
    content: lines.slice(0, -1).join("\n").replace(/\n$/, ""),
  };
}
