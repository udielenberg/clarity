/**
 * Markdown import/export.
 *
 * A map serializes to an indented bullet list — the format people already use
 * for outlines, so it round-trips cleanly and pastes into any editor. Two
 * spaces of indentation per level; the first bullet is the root.
 *
 * Example:
 *   - My ideas
 *     - First branch
 *       - Detail
 *     - Second branch
 */
import { node, type MindNode } from "../model.js";

const INDENT = "  ";

/** Serialize a tree to an indented Markdown bullet list. */
export function toMarkdown(root: MindNode): string {
  const lines: string[] = [];
  const go = (n: MindNode, depth: number) => {
    const text = n.text.replace(/\r?\n/g, " ").trimEnd();
    lines.push(`${INDENT.repeat(depth)}- ${text}`);
    for (const c of n.children) go(c, depth + 1);
  };
  go(root, 0);
  return lines.join("\n");
}

/** A parsed bullet line. */
interface Parsed {
  depth: number;
  text: string;
}

function parseLine(line: string): Parsed | null {
  // Accept "-", "*", or "+" bullets. Indentation may be spaces or tabs.
  const match = /^([ \t]*)[-*+]\s+(.*)$/.exec(line);
  if (!match) return null;
  const indent = match[1] ?? "";
  const text = (match[2] ?? "").trim();
  // A tab counts as two spaces; otherwise depth is spaces / 2 (rounded down).
  const spaces = indent.replace(/\t/g, INDENT).length;
  return { depth: Math.floor(spaces / 2), text };
}

/**
 * Parse an indented bullet list back into a tree.
 *
 * If the text has a single top-level bullet, it becomes the root. If it has
 * several (or none), they are wrapped under a synthetic root titled `rootText`.
 */
export function fromMarkdown(text: string, rootText = "Map"): MindNode {
  const parsed = text
    .split(/\r?\n/)
    .map(parseLine)
    .filter((p): p is Parsed => p !== null && p.text.length > 0);

  if (parsed.length === 0) return node(rootText);

  // Normalize depths so the shallowest line is depth 0.
  const minDepth = Math.min(...parsed.map((p) => p.depth));
  for (const p of parsed) p.depth -= minDepth;

  const topLevel = parsed.filter((p) => p.depth === 0);
  const singleRoot = topLevel.length === 1;

  // Build using a stack of { depth, node }.
  const roots: MindNode[] = [];
  const stack: { depth: number; node: MindNode }[] = [];

  for (const p of parsed) {
    const n = node(p.text);
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= p.depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.node.children.push(n);
    } else {
      roots.push(n);
    }
    stack.push({ depth: p.depth, node: n });
  }

  if (singleRoot && roots.length === 1) return roots[0]!;
  return node(rootText, roots);
}
