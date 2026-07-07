import { describe, it, expect } from "vitest";
import { createStore } from "../store.js";
import { node, updateNode, findNode } from "../model.js";
import { toJSON, fromJSON } from "../io/json.js";

describe("node color", () => {
  it("node() carries an optional color", () => {
    expect(node("x").color).toBeUndefined();
    expect(node("x", [], { color: "#ef4444" }).color).toBe("#ef4444");
  });

  it("updateNode sets and clears a color", () => {
    const root = node("root", [node("a", [], { id: "a" })], { id: "root" });
    const colored = updateNode(root, "a", { color: "#10b981" });
    expect(findNode(colored, "a")?.color).toBe("#10b981");
    const cleared = updateNode(colored, "a", { color: undefined });
    expect(findNode(cleared, "a")?.color).toBeUndefined();
  });

  it("store.setColor updates a node and undoes cleanly", () => {
    const store = createStore("root");
    const id = store.addChild(store.rootId, "child");
    store.setColor(id, "#6366f1");
    expect(findNode(store.map.root, id)?.color).toBe("#6366f1");
    store.undo();
    expect(findNode(store.map.root, id)?.color).toBeUndefined();
  });

  it("color round-trips through JSON", () => {
    const store = createStore("root");
    const id = store.addChild(store.rootId, "child");
    store.setColor(id, "#f59e0b");
    const restored = fromJSON(toJSON(store.map));
    expect(findNode(restored.root, id)?.color).toBe("#f59e0b");
  });

  it("ignores a non-string color on import", () => {
    const bad = JSON.stringify({
      version: 1,
      root: { id: "r", text: "r", children: [], color: 123 },
    });
    expect(fromJSON(bad).root.color).toBeUndefined();
  });
});
