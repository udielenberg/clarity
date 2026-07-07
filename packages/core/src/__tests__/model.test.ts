import { describe, it, expect } from "vitest";
import {
  findNode,
  findParent,
  insertChild,
  removeNode,
  updateNode,
  moveNode,
  toggleCollapsed,
  isAncestor,
  countNodes,
  cloneNode,
} from "../model.js";
import { n } from "./helpers.js";

const sample = () => n("root", [n("a", [n("a1"), n("a2")]), n("b")]);

describe("model — purity", () => {
  it("does not mutate the input tree", () => {
    const root = sample();
    const snapshot = JSON.stringify(root);
    insertChild(root, "root", n("c"));
    removeNode(root, "b");
    updateNode(root, "a", { text: "changed" });
    expect(JSON.stringify(root)).toBe(snapshot);
  });

  it("shares untouched subtrees (structural sharing)", () => {
    const root = sample();
    const a = findNode(root, "a")!;
    const next = insertChild(root, "b", n("b1"));
    // The "a" subtree wasn't touched, so its reference is reused.
    expect(findNode(next, "a")).toBe(a);
  });
});

describe("model — find", () => {
  it("finds nodes and parents", () => {
    const root = sample();
    expect(findNode(root, "a1")?.text).toBe("a1");
    expect(findNode(root, "nope")).toBeUndefined();
    expect(findParent(root, "a1")?.id).toBe("a");
    expect(findParent(root, "root")).toBeUndefined();
  });
});

describe("model — mutations", () => {
  it("inserts at an index and clamps out-of-range indexes", () => {
    const root = sample();
    const next = insertChild(root, "root", n("x"), 1);
    expect(next.children.map((c) => c.id)).toEqual(["a", "x", "b"]);
    const end = insertChild(root, "root", n("y"), 999);
    expect(end.children.at(-1)?.id).toBe("y");
  });

  it("removes a subtree but refuses to remove the root", () => {
    const root = sample();
    const next = removeNode(root, "a");
    expect(findNode(next, "a")).toBeUndefined();
    expect(findNode(next, "a1")).toBeUndefined();
    expect(() => removeNode(root, "root")).toThrow(/root/);
  });

  it("updates fields", () => {
    const root = sample();
    const next = updateNode(root, "b", { text: "B!", note: "hi" });
    expect(findNode(next, "b")?.text).toBe("B!");
    expect(findNode(next, "b")?.note).toBe("hi");
  });

  it("toggles collapsed", () => {
    const root = sample();
    const collapsed = toggleCollapsed(root, "a");
    expect(findNode(collapsed, "a")?.collapsed).toBe(true);
    const expanded = toggleCollapsed(collapsed, "a");
    expect(findNode(expanded, "a")?.collapsed).toBe(false);
  });
});

describe("model — move", () => {
  it("reparents a subtree", () => {
    const root = sample();
    const next = moveNode(root, "a1", "b");
    expect(findParent(next, "a1")?.id).toBe("b");
    expect(findNode(next, "a")?.children.map((c) => c.id)).toEqual(["a2"]);
  });

  it("blocks moving a node into its own descendant", () => {
    const root = sample();
    expect(() => moveNode(root, "a", "a1")).toThrow(/descendant/);
    expect(isAncestor(root, "a", "a1")).toBe(true);
    expect(isAncestor(root, "b", "a1")).toBe(false);
  });
});

describe("model — misc", () => {
  it("counts nodes and clones deeply", () => {
    const root = sample();
    expect(countNodes(root)).toBe(5);
    const clone = cloneNode(root);
    expect(clone).not.toBe(root);
    expect(clone.children[0]).not.toBe(root.children[0]);
    expect(JSON.stringify(clone)).toBe(JSON.stringify(root));
  });
});
