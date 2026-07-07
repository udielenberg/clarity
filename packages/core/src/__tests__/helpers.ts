import { node, type MindNode } from "../model.js";

/** Test helper: create a node whose id equals its text (so tests can reference it). */
export function n(
  text: string,
  children: MindNode[] = [],
  opts: { collapsed?: boolean; note?: string } = {},
): MindNode {
  return node(text, children, { id: text, ...opts });
}
