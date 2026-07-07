import { useMemo, useState } from "react";
import { createStore, toMarkdown } from "clarity-mind";
import { MindMap, useMindMap } from "@clarity-mind/react";

function seed() {
  const store = createStore("clarity");
  const ux = store.addChild(store.rootId, "Better UX");
  store.addChild(ux, "Keyboard-first");
  store.addChild(ux, "Animated layout");
  store.addChild(ux, "Inline editing");
  const eng = store.addChild(store.rootId, "Engineering");
  store.addChild(eng, "Headless core");
  store.addChild(eng, "React binding");
  const oss = store.addChild(store.rootId, "Open source");
  store.addChild(oss, "MIT license");
  store.addChild(oss, "npm: clarity-mind");
  return store;
}

export function App() {
  const store = useMemo(() => seed(), []);
  useMindMap(store); // re-render App when the map changes (for toolbar state)
  const [showMarkdown, setShowMarkdown] = useState(false);

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <span className="dot" /> clarity{" "}
          <span className="tag">mind-map demo</span>
        </div>
        <div className="actions">
          <button onClick={() => store.undo()} disabled={!store.canUndo()}>
            ↶ Undo
          </button>
          <button onClick={() => store.redo()} disabled={!store.canRedo()}>
            ↷ Redo
          </button>
          <button onClick={() => setShowMarkdown((s) => !s)}>
            {showMarkdown ? "Hide" : "Export"} Markdown
          </button>
        </div>
      </header>

      <div className="hint">
        <b>Mouse:</b> hover a node for <b>+</b> (add) &amp; collapse toggle ·{" "}
        <b>right-click</b> for the full menu · <b>drag</b> a node onto another
        to re-parent · double-click to rename · drag canvas to pan · zoom
        buttons bottom-right &nbsp;|&nbsp; <b>Keyboard:</b> <kbd>Tab</kbd> child
        · <kbd>Enter</kbd> sibling · <kbd>F2</kbd> edit · <kbd>Del</kbd> remove
        · <kbd>Space</kbd> collapse · <kbd>↑↓←→</kbd> move · <kbd>⌘Z</kbd> undo
      </div>

      <MindMap store={store} className="canvas" />

      {showMarkdown && (
        <pre className="markdown">{toMarkdown(store.map.root)}</pre>
      )}
    </div>
  );
}
