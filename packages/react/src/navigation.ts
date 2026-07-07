/**
 * Pure keyboard-navigation logic, split out so it can be unit-tested without a DOM.
 *
 * Semantics (tree-based, predictable): right = first child, left = parent,
 * up/down = previous/next sibling. Collapsed nodes expose no children.
 */
import { findNode, findParent, type MindNode } from "clarity-mind";

export type Direction = "up" | "down" | "left" | "right";

/** Return the id to select when moving `dir` from `selectedId`. Falls back to `selectedId`. */
export function navigate(
  root: MindNode,
  selectedId: string,
  dir: Direction,
): string {
  const current = findNode(root, selectedId);
  if (!current) return selectedId;
  const parent = findParent(root, selectedId);

  switch (dir) {
    case "right": {
      const kids = current.collapsed ? [] : current.children;
      return kids[0]?.id ?? selectedId;
    }
    case "left":
      return parent?.id ?? selectedId;
    case "up":
    case "down": {
      if (!parent) return selectedId;
      const i = parent.children.findIndex((c) => c.id === selectedId);
      const next = parent.children[dir === "up" ? i - 1 : i + 1];
      return next?.id ?? selectedId;
    }
  }
}
