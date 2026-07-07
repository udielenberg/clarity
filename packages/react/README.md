# @clarity-mind/react

[![npm](https://img.shields.io/npm/v/%40clarity-mind%2Freact?color=0EA5E9)](https://www.npmjs.com/package/@clarity-mind/react)
[![MIT](https://img.shields.io/npm/l/@clarity-mind/react?color=64748B)](https://github.com/udielenberg/clarity/blob/main/LICENSE)

The **React binding** for [clarity](https://github.com/udielenberg/clarity) — an interactive, keyboard-first `<MindMap>` component. Topic nodes are real DOM elements (crisp text, inline editing, accessible); connectors are SVG; the layout _animates_ so the map glides when it changes.

```bash
npm install clarity-mind @clarity-mind/react
```

> Requires React 18+ (declared as a peer dependency).

## Usage

```tsx
import { createStore } from "clarity-mind";
import { MindMap } from "@clarity-mind/react";

const store = createStore("My big idea");

export default function App() {
  return <MindMap store={store} style={{ height: "100vh" }} />;
}
```

The component is fully controlled by the `store`, so you own the data — read it, persist it (`toJSON`), or subscribe to changes.

### Props

| Prop        | Type             | Description                                                                    |
| ----------- | ---------------- | ------------------------------------------------------------------------------ |
| `store`     | `MindMapStore`   | The map to render + edit. Create one with `createStore()` from `clarity-mind`. |
| `className` | `string?`        | Class on the root canvas element.                                              |
| `style`     | `CSSProperties?` | Inline style on the root — **set a height**, or the canvas collapses to 0.     |

### Keyboard & mouse

| Input                           | Action                           |
| ------------------------------- | -------------------------------- |
| `Tab` / `Enter`                 | Add child / sibling              |
| `F2` or start typing            | Edit the node                    |
| `Delete`                        | Remove the node                  |
| `↑ ↓ ← →` · `Space`             | Move selection · collapse/expand |
| `⌘/Ctrl + Z` · `⇧⌘Z / Ctrl + Y` | Undo · redo                      |

Mouse: click selects · double-click edits · hover shows a `+` and a collapse toggle · right-click opens the menu · drag a node onto another to re-parent · drag the background to pan · wheel to zoom.

### Also exported

- `useMindMap(store)` — subscribe a component to the store; re-renders on every change (handy for your own toolbar/state).
- `navigate` — the arrow-key navigation helper, if you build custom controls.

## License

[MIT](https://github.com/udielenberg/clarity/blob/main/LICENSE) © udielenberg
