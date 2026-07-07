# clarity

A **better-UX, open-source mind-mapping library** for the web — an embeddable alternative to
SimpleMind. Headless TypeScript core, with a batteries-included React binding.

> Status: **early**. The headless `core` (data model, layout, undo/redo, Markdown/JSON I/O) is
> built and tested. The React renderer and live demo are next.

## Why

Great mind-mapping apps (SimpleMind, XMind, MindNode) are polished but proprietary and
non-embeddable. The open-source options are powerful but clunky. **clarity** aims to be the
one you'd actually enjoy using — and can drop into your own app.

The whole project is judged on **UX**:

- **Keyboard-first** — `Tab` = child, `Enter` = sibling, arrows to navigate, type to edit.
- **Zero jank** — 60fps pan/zoom and _animated_ layout: nodes glide, never teleport.
- **Inline editing** — edit text in place, no side panel.
- **Effortless restructuring** — drag a branch to reparent, rock-solid undo/redo.
- **Beautiful by default** + a focus/zen mode.

## Packages

| Package                   | What                                                            |
| ------------------------- | --------------------------------------------------------------- |
| `packages/core`           | Headless, framework-agnostic engine. **No DOM.**                |
| `packages/react` _(soon)_ | React renderer: DOM nodes + SVG connectors, keyboard, pan/zoom. |
| `demo/` _(soon)_          | Live demo web app + docs.                                       |

## Core at a glance

```ts
import { createStore, layout, toMarkdown, fromMarkdown } from "clarity-mind";

const store = createStore({ text: "My ideas" });
store.addChild(store.rootId, "First branch");
store.addChild(store.rootId, "Second branch");

// Compute geometry for rendering (headless — you supply node sizes):
const boxes = layout(store.map.root, {
  measure: (n) => ({ width: 8 * n.text.length + 24, height: 32 }),
});

// Round-trip to Markdown:
const md = toMarkdown(store.map.root);
const back = fromMarkdown(md);

store.undo();
store.redo();
```

## Develop

```bash
npm install
npm test          # Vitest
npm run typecheck
npm run lint
npm run build
```

## License

MIT © clarity contributors
