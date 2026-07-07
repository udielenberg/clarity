/**
 * An ergonomic, mutable-feeling wrapper over the pure model + history.
 *
 * The store holds the current {@link MindMap} and an undo stack. Every mutating
 * method applies a pure operation, records the new snapshot, and notifies
 * subscribers. This is what a UI binding (e.g. the React package) drives.
 */
import { History } from "./history.js";
import {
  createMap,
  insertChild,
  moveNode,
  node,
  removeNode,
  toggleCollapsed,
  updateNode,
  type MindMap,
  type MindNode,
} from "./model.js";

export type Unsubscribe = () => void;

export class MindMapStore {
  private history: History<MindMap>;
  private listeners = new Set<() => void>();

  constructor(root: MindNode | string, historyLimit = 200) {
    this.history = new History(createMap(root), historyLimit);
  }

  /** The current map (immutable snapshot). */
  get map(): MindMap {
    return this.history.current;
  }

  /** The root node's id — handy since callers often add to the root. */
  get rootId(): string {
    return this.map.root.id;
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(nextRoot: MindNode): void {
    if (nextRoot === this.map.root) return;
    this.history.push({ root: nextRoot });
    this.emit();
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  /** Add a child topic under `parentId`. Returns the new node's id. */
  addChild(parentId: string, text = "", index?: number): string {
    const child = node(text);
    this.commit(insertChild(this.map.root, parentId, child, index));
    return child.id;
  }

  /** Add a sibling after `siblingId`. Throws if `siblingId` is the root. Returns the new id. */
  addSibling(siblingId: string, text = ""): string {
    const parent = findParentId(this.map.root, siblingId);
    if (!parent) throw new Error("clarity: cannot add a sibling to the root");
    const idx = childIndex(this.map.root, parent, siblingId);
    const child = node(text);
    this.commit(insertChild(this.map.root, parent, child, idx + 1));
    return child.id;
  }

  /** Change a node's text. */
  setText(id: string, text: string): void {
    this.commit(updateNode(this.map.root, id, { text }));
  }

  /** Change a node's note. */
  setNote(id: string, note: string): void {
    this.commit(updateNode(this.map.root, id, { note }));
  }

  /** Remove a subtree. */
  remove(id: string): void {
    this.commit(removeNode(this.map.root, id));
  }

  /** Toggle (or set) a node's collapsed flag. */
  toggleCollapse(id: string, value?: boolean): void {
    this.commit(toggleCollapsed(this.map.root, id, value));
  }

  /** Move a subtree under a new parent. */
  move(id: string, newParentId: string, index?: number): void {
    this.commit(moveNode(this.map.root, id, newParentId, index));
  }

  /** Replace the whole map (e.g. after an import). Resets nothing but the current state. */
  replace(map: MindMap): void {
    this.history.push(map);
    this.emit();
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  undo(): void {
    if (!this.canUndo()) return;
    this.history.undo();
    this.emit();
  }

  redo(): void {
    if (!this.canRedo()) return;
    this.history.redo();
    this.emit();
  }
}

function findParentId(root: MindNode, id: string): string | undefined {
  for (const child of root.children) {
    if (child.id === id) return root.id;
    const hit = findParentId(child, id);
    if (hit) return hit;
  }
  return undefined;
}

function childIndex(root: MindNode, parentId: string, childId: string): number {
  const find = (n: MindNode): number => {
    if (n.id === parentId) return n.children.findIndex((c) => c.id === childId);
    for (const c of n.children) {
      const i = find(c);
      if (i !== -1) return i;
    }
    return -1;
  };
  return find(root);
}

/** Convenience factory. */
export function createStore(root: MindNode | string): MindMapStore {
  return new MindMapStore(root);
}
