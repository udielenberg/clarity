import { describe, it, expect, vi } from "vitest";
import { createStore } from "../store.js";
import { findNode, findParent } from "../model.js";

describe("MindMapStore", () => {
  it("adds children and reports the root id", () => {
    const store = createStore("root");
    const id = store.addChild(store.rootId, "child");
    expect(findNode(store.map.root, id)?.text).toBe("child");
    expect(store.map.root.children).toHaveLength(1);
  });

  it("adds a sibling right after the target", () => {
    const store = createStore("root");
    const a = store.addChild(store.rootId, "a");
    store.addChild(store.rootId, "c");
    const b = store.addSibling(a, "b");
    expect(store.map.root.children.map((c) => c.id)).toEqual([
      a,
      b,
      expect.any(String),
    ]);
    expect(findNode(store.map.root, b)?.text).toBe("b");
  });

  it("refuses a sibling for the root", () => {
    const store = createStore("root");
    expect(() => store.addSibling(store.rootId)).toThrow(/root/);
  });

  it("notifies subscribers on change and supports unsubscribe", () => {
    const store = createStore("root");
    const spy = vi.fn();
    const off = store.subscribe(spy);
    store.addChild(store.rootId, "x");
    expect(spy).toHaveBeenCalledTimes(1);
    off();
    store.addChild(store.rootId, "y");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("undoes and redoes mutations", () => {
    const store = createStore("root");
    const id = store.addChild(store.rootId, "a");
    store.setText(id, "renamed");
    expect(findNode(store.map.root, id)?.text).toBe("renamed");
    store.undo();
    expect(findNode(store.map.root, id)?.text).toBe("a");
    store.undo();
    expect(store.map.root.children).toHaveLength(0);
    store.redo();
    expect(store.map.root.children).toHaveLength(1);
  });

  it("moves a node between parents", () => {
    const store = createStore("root");
    const a = store.addChild(store.rootId, "a");
    const b = store.addChild(store.rootId, "b");
    const child = store.addChild(a, "child");
    store.move(child, b);
    expect(findParent(store.map.root, child)?.id).toBe(b);
  });
});
