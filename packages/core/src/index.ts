/**
 * clarity-mind — headless mind-mapping engine.
 *
 * Framework-agnostic and DOM-free: data model, layout, undo/redo, and I/O.
 * Pair it with a rendering binding (e.g. `@clarity-mind/react`) to draw a map.
 */
export type { MindNode, MindMap } from "./model.js";
export {
  createId,
  node,
  createMap,
  cloneNode,
  findNode,
  findParent,
  isAncestor,
  updateNode,
  insertChild,
  removeNode,
  toggleCollapsed,
  moveNode,
  walk,
  countNodes,
} from "./model.js";

export { History } from "./history.js";
export { MindMapStore, createStore, type Unsubscribe } from "./store.js";

export {
  layout,
  type Box,
  type Edge,
  type Size,
  type LayoutResult,
  type LayoutOptions,
} from "./layout.js";

export { toMarkdown, fromMarkdown } from "./io/markdown.js";
export { toJSON, fromJSON, FORMAT_VERSION } from "./io/json.js";
