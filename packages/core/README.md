# clarity-mind

[![npm](https://img.shields.io/npm/v/clarity-mind?color=6366F1)](https://www.npmjs.com/package/clarity-mind)
[![MIT](https://img.shields.io/npm/l/clarity-mind?color=64748B)](https://github.com/udielenberg/clarity/blob/main/LICENSE)

The **headless engine** behind [clarity](https://github.com/udielenberg/clarity) — a better-UX, open-source mind-mapping library.

Framework-agnostic and **DOM-free**: an immutable tree model, a tidy-tree layout, undo/redo, and Markdown/JSON I/O. Bring your own renderer — or use the React binding, [`@clarity-mind/react`](https://www.npmjs.com/package/@clarity-mind/react).

```bash
npm install clarity-mind
```

## Example

```ts
import { createStore, layout, toMarkdown, fromMarkdown } from "clarity-mind";

// A store wraps the tree with undo/redo + change subscriptions.
const store = createStore("Roadmap");
const q1 = store.addChild(store.rootId, "Q1");
store.addChild(q1, "Ship v1");
store.setText(q1, "Q1 — launch");

// Deterministic, two-sided "tidy tree" layout. You supply node sizes, so it
// works with any measuring strategy (DOM, canvas, a fixed grid…).
const { boxes, edges, bounds } = layout(store.map.root, {
  measure: (node) => ({ width: node.text.length * 8 + 24, height: 32 }),
});

// Round-trips through plain Markdown outlines.
const md = toMarkdown(store.map.root);
const tree = fromMarkdown(md);

store.undo();
store.redo();
```

## What's in the box

| Area                      | Exports                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Model** (pure tree ops) | `createMap`, `node`, `insertChild`, `removeNode`, `moveNode`, `updateNode`, `toggleCollapsed`, `findNode`, `walk`, … |
| **Store** (stateful)      | `createStore`, `MindMapStore` — `addChild`, `addSibling`, `setText`, `move`, `remove`, `undo`, `redo`, `subscribe`   |
| **Layout**                | `layout(root, options)` → `{ boxes, edges, bounds }`                                                                 |
| **History**               | `History` — the undo/redo stack                                                                                      |
| **I/O**                   | `toMarkdown` / `fromMarkdown`, `toJSON` / `fromJSON` (versioned)                                                     |

Every model operation is **pure** — it returns a new tree and never mutates its input, which is what makes undo/redo and predictable rendering trivial. Moves are cycle-safe (you can't drop a node into its own descendant).

## Types

Fully typed, `strict` + `noUncheckedIndexedAccess`. Key shapes:

```ts
interface MindNode {
  id: string;
  text: string;
  children: MindNode[];
  collapsed?: boolean;
  note?: string;
}

interface MindMap {
  root: MindNode;
}
```

## License

[MIT](https://github.com/udielenberg/clarity/blob/main/LICENSE) © udielenberg
