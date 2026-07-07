/**
 * The clarity data model.
 *
 * A mind map is a single tree of {@link MindNode}s. Every operation in this
 * module is **pure**: it returns a new tree and never mutates its input. That
 * makes undo/redo trivial (keep old references) and rendering predictable.
 */

/** A single topic in the map. */
export interface MindNode {
  /** Stable unique id. */
  id: string;
  /** The topic text. */
  text: string;
  /** Child topics, in display order. */
  children: MindNode[];
  /** When true, children are hidden (and treated as absent by layout). */
  collapsed?: boolean;
  /** Optional longer note attached to the topic. */
  note?: string;
  /** Optional accent color (any CSS color string). Overrides the default
   *  depth-based palette for this node. */
  color?: string;
}

/** A whole map. Thin wrapper so the shape can grow (themes, meta) without churn. */
export interface MindMap {
  root: MindNode;
}

let idCounter = 0;

/** Generate a collision-resistant id. Deterministic-enough for a session, unique across maps. */
export function createId(): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `n${idCounter.toString(36)}-${rand}`;
}

/** Create a node. Pass an explicit `id` (e.g. in tests) or let one be generated. */
export function node(
  text: string,
  children: MindNode[] = [],
  opts: {
    id?: string;
    collapsed?: boolean;
    note?: string;
    color?: string;
  } = {},
): MindNode {
  return {
    id: opts.id ?? createId(),
    text,
    children,
    ...(opts.collapsed ? { collapsed: true } : {}),
    ...(opts.note !== undefined ? { note: opts.note } : {}),
    ...(opts.color !== undefined ? { color: opts.color } : {}),
  };
}

/** Create a map from a root node (or root text). */
export function createMap(root: MindNode | string): MindMap {
  return { root: typeof root === "string" ? node(root) : root };
}

/** Deep clone a subtree. */
export function cloneNode(n: MindNode): MindNode {
  return { ...n, children: n.children.map(cloneNode) };
}

/** Depth-first find. Returns the node with `id`, or `undefined`. */
export function findNode(root: MindNode, id: string): MindNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const hit = findNode(child, id);
    if (hit) return hit;
  }
  return undefined;
}

/** Find the parent of `id`. Returns `undefined` for the root or a missing id. */
export function findParent(root: MindNode, id: string): MindNode | undefined {
  for (const child of root.children) {
    if (child.id === id) return root;
    const hit = findParent(child, id);
    if (hit) return hit;
  }
  return undefined;
}

/** True if `ancestorId` is `id` or an ancestor of `id`. Used to block illegal moves. */
export function isAncestor(
  root: MindNode,
  ancestorId: string,
  id: string,
): boolean {
  const ancestor = findNode(root, ancestorId);
  if (!ancestor) return false;
  return !!findNode(ancestor, id);
}

/**
 * Return a new tree where the node matching `id` is replaced by `fn(node)`.
 * Only the path to that node is rebuilt; untouched subtrees are shared.
 */
function transform(
  root: MindNode,
  id: string,
  fn: (n: MindNode) => MindNode,
): MindNode {
  if (root.id === id) return fn(root);
  let changed = false;
  const children = root.children.map((child) => {
    const next = transform(child, id, fn);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

/** Update a node's fields (text/note/collapsed). Returns a new tree. */
export function updateNode(
  root: MindNode,
  id: string,
  patch: Partial<Omit<MindNode, "id" | "children">>,
): MindNode {
  return transform(root, id, (n) => ({ ...n, ...patch }));
}

/** Insert `child` under `parentId` at `index` (clamped; defaults to the end). */
export function insertChild(
  root: MindNode,
  parentId: string,
  child: MindNode,
  index = Number.POSITIVE_INFINITY,
): MindNode {
  return transform(root, parentId, (p) => {
    const children = [...p.children];
    const i = Math.max(0, Math.min(index, children.length));
    children.splice(i, 0, child);
    return { ...p, children };
  });
}

/** Remove the subtree rooted at `id`. Throws if `id` is the root. Returns a new tree. */
export function removeNode(root: MindNode, id: string): MindNode {
  if (root.id === id) {
    throw new Error("clarity: cannot remove the root node");
  }
  const recur = (n: MindNode): MindNode => {
    let changed = false;
    const kept = n.children.filter((c) => c.id !== id);
    if (kept.length !== n.children.length) changed = true;
    const children = kept.map((c) => {
      const next = recur(c);
      if (next !== c) changed = true;
      return next;
    });
    return changed ? { ...n, children } : n;
  };
  return recur(root);
}

/** Toggle (or set) the collapsed flag on a node. Returns a new tree. */
export function toggleCollapsed(
  root: MindNode,
  id: string,
  value?: boolean,
): MindNode {
  return transform(root, id, (n) => ({
    ...n,
    collapsed: value ?? !n.collapsed,
  }));
}

/**
 * Move the subtree `id` under `newParentId` at `index`.
 * Throws if the move would create a cycle (moving a node into its own descendant)
 * or if either node is missing. Returns a new tree.
 */
export function moveNode(
  root: MindNode,
  id: string,
  newParentId: string,
  index = Number.POSITIVE_INFINITY,
): MindNode {
  if (id === root.id) throw new Error("clarity: cannot move the root node");
  if (id === newParentId)
    throw new Error("clarity: cannot move a node into itself");
  if (isAncestor(root, id, newParentId)) {
    throw new Error("clarity: cannot move a node into its own descendant");
  }
  const subtree = findNode(root, id);
  if (!subtree) throw new Error(`clarity: node "${id}" not found`);
  if (!findNode(root, newParentId))
    throw new Error(`clarity: node "${newParentId}" not found`);

  const detached = removeNode(root, id);
  return insertChild(detached, newParentId, cloneNode(subtree), index);
}

/** Visit every node depth-first (parent before children). */
export function walk(
  root: MindNode,
  visit: (n: MindNode, depth: number) => void,
): void {
  const go = (n: MindNode, depth: number) => {
    visit(n, depth);
    for (const c of n.children) go(c, depth + 1);
  };
  go(root, 0);
}

/** Count all nodes in the tree. */
export function countNodes(root: MindNode): number {
  let count = 0;
  walk(root, () => (count += 1));
  return count;
}
