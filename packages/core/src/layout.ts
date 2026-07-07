/**
 * The layout engine.
 *
 * Turns a {@link MindNode} tree into positioned boxes that a renderer can draw.
 * It is **headless**: it does not measure text itself (that needs a DOM/canvas),
 * so the caller supplies a `measure` function. The result is a flat map of
 * `id -> Box` plus the parent→child edges.
 *
 * Algorithm: a variable-size "tidy tree" laid out on two sides of a central
 * root (the classic mind-map look). First-level children are split between the
 * right and left sides; each side grows outward horizontally and stacks
 * vertically without overlap. Each side is vertically centered against the
 * taller one so the root sits in the middle.
 */
import type { MindNode } from "./model.js";

/** A positioned node. `x`/`y` is the top-left corner. */
export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Depth from the root (root = 0). */
  depth: number;
  /** Which side of the root this box sits on. The root itself is `"root"`. */
  side: "left" | "right" | "root";
}

/** A connector from a parent box to a child box. */
export interface Edge {
  from: string;
  to: string;
}

export interface LayoutResult {
  boxes: Map<string, Box>;
  edges: Edge[];
  /** Bounding box of the whole map. */
  bounds: { x: number; y: number; width: number; height: number };
}

export interface Size {
  width: number;
  height: number;
}

export interface LayoutOptions {
  /** Measure a node's rendered size. Defaults to a rough text estimate. */
  measure?: (node: MindNode) => Size;
  /** Horizontal gap between a parent and its children. Default 48. */
  hGap?: number;
  /** Vertical gap between sibling subtrees. Default 16. */
  vGap?: number;
  /** Lay children out on both sides of the root (true) or only the right. Default true. */
  twoSided?: boolean;
}

const defaultMeasure = (n: MindNode): Size => ({
  width: Math.max(48, n.text.length * 8 + 24),
  height: 32,
});

/** Children that participate in layout (collapsed nodes hide theirs). */
function visibleChildren(n: MindNode): MindNode[] {
  return n.collapsed ? [] : n.children;
}

interface Work {
  node: MindNode;
  size: Size;
  children: Work[];
  /** Vertical center, assigned in pass 1. */
  cy: number;
  /** Total vertical extent of this subtree, assigned in pass 1. */
  extent: number;
}

/** Build the working tree and measure every node. */
function build(node: MindNode, measure: (n: MindNode) => Size): Work {
  return {
    node,
    size: measure(node),
    children: visibleChildren(node).map((c) => build(c, measure)),
    cy: 0,
    extent: 0,
  };
}

/**
 * Pass 1 (vertical): assign each subtree a vertical center relative to a local
 * cursor starting at 0. A leaf reserves its own height; a parent centers on the
 * span of its children. Returns the total height consumed.
 */
function layoutVertical(work: Work, vGap: number, cursor: { y: number }): void {
  if (work.children.length === 0) {
    work.cy = cursor.y + work.size.height / 2;
    work.extent = work.size.height;
    cursor.y += work.size.height + vGap;
    return;
  }
  for (const child of work.children) {
    layoutVertical(child, vGap, cursor);
  }
  const first = work.children[0]!;
  const last = work.children[work.children.length - 1]!;
  // Guarantee the parent's own height fits even if its children span less.
  const childSpan =
    last.cy + last.size.height / 2 - (first.cy - first.size.height / 2);
  work.extent = Math.max(childSpan, work.size.height);
  work.cy = (first.cy + last.cy) / 2;
}

/** Shift a whole subtree vertically by `dy`. */
function shiftVertical(work: Work, dy: number): void {
  work.cy += dy;
  for (const child of work.children) shiftVertical(child, dy);
}

/**
 * Pass 2 (horizontal): walk outward from the root assigning x. For the right
 * side, a child sits to the right of its parent; for the left side, to the left.
 * Emits boxes and edges.
 */
function emit(
  work: Work,
  parentLeft: number,
  parentWidth: number,
  depth: number,
  side: "left" | "right" | "root",
  hGap: number,
  out: { boxes: Map<string, Box>; edges: Edge[] },
): void {
  let x: number;
  if (side === "left") {
    // Child's right edge sits `hGap` to the left of the parent's left edge.
    x = parentLeft - hGap - work.size.width;
  } else if (side === "right") {
    x = parentLeft + parentWidth + hGap;
  } else {
    // Root: centered on x = 0.
    x = -work.size.width / 2;
  }

  out.boxes.set(work.node.id, {
    id: work.node.id,
    x,
    y: work.cy - work.size.height / 2,
    width: work.size.width,
    height: work.size.height,
    depth,
    side,
  });

  // Below the root, children always inherit their parent's side.
  for (const child of work.children) {
    out.edges.push({ from: work.node.id, to: child.node.id });
    emit(child, x, work.size.width, depth + 1, side, hGap, out);
  }
}

export function layout(
  root: MindNode,
  options: LayoutOptions = {},
): LayoutResult {
  const measure = options.measure ?? defaultMeasure;
  const hGap = options.hGap ?? 48;
  const vGap = options.vGap ?? 16;
  const twoSided = options.twoSided ?? true;

  const rootWork = build(root, measure);
  const rootSize = rootWork.size;

  // Split first-level children between the two sides.
  const firstLevel = rootWork.children;
  let rightWorks: Work[];
  let leftWorks: Work[];
  if (twoSided && firstLevel.length > 1) {
    const half = Math.ceil(firstLevel.length / 2);
    rightWorks = firstLevel.slice(0, half);
    leftWorks = firstLevel.slice(half);
  } else {
    rightWorks = firstLevel;
    leftWorks = [];
  }

  // Vertical pass, independently per side.
  const measureSide = (works: Work[]): number => {
    const cursor = { y: 0 };
    for (const w of works) layoutVertical(w, vGap, cursor);
    return works.length === 0 ? 0 : cursor.y - vGap;
  };
  const rightHeight = measureSide(rightWorks);
  const leftHeight = measureSide(leftWorks);
  const sidesHeight = Math.max(rightHeight, leftHeight);
  const overallHeight = Math.max(sidesHeight, rootSize.height);

  // Center each side vertically within the overall height.
  for (const w of rightWorks)
    shiftVertical(w, (overallHeight - rightHeight) / 2);
  for (const w of leftWorks) shiftVertical(w, (overallHeight - leftHeight) / 2);

  rootWork.cy = overallHeight / 2;

  const out = { boxes: new Map<string, Box>(), edges: [] as Edge[] };

  // Emit root box (centered on origin).
  out.boxes.set(root.id, {
    id: root.id,
    x: -rootSize.width / 2,
    y: rootWork.cy - rootSize.height / 2,
    width: rootSize.width,
    height: rootSize.height,
    depth: 0,
    side: "root",
  });

  const rootLeft = -rootSize.width / 2;
  for (const w of rightWorks) {
    out.edges.push({ from: root.id, to: w.node.id });
    emit(w, rootLeft, rootSize.width, 1, "right", hGap, out);
  }
  for (const w of leftWorks) {
    out.edges.push({ from: root.id, to: w.node.id });
    emit(w, rootLeft, rootSize.width, 1, "left", hGap, out);
  }

  // Compute bounds.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of out.boxes.values()) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  return {
    boxes: out.boxes,
    edges: out.edges,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
  };
}
