import { describe, it, expect } from "vitest";
import { node } from "clarity-mind";
import { navigate } from "./navigation.js";

const tree = () =>
  node(
    "root",
    [
      node("a", [node("a1", [], { id: "a1" }), node("a2", [], { id: "a2" })], {
        id: "a",
      }),
      node("b", [], { id: "b" }),
    ],
    {
      id: "root",
    },
  );

describe("navigate", () => {
  it("right goes to the first child", () => {
    expect(navigate(tree(), "root", "right")).toBe("a");
    expect(navigate(tree(), "a", "right")).toBe("a1");
  });

  it("left goes to the parent", () => {
    expect(navigate(tree(), "a1", "left")).toBe("a");
    expect(navigate(tree(), "a", "left")).toBe("root");
  });

  it("up/down move between siblings and clamp at the ends", () => {
    expect(navigate(tree(), "a1", "down")).toBe("a2");
    expect(navigate(tree(), "a2", "up")).toBe("a1");
    expect(navigate(tree(), "a1", "up")).toBe("a1"); // first sibling: no move
    expect(navigate(tree(), "a2", "down")).toBe("a2"); // last sibling: no move
  });

  it("does not descend into a collapsed node", () => {
    const collapsed = node(
      "root",
      [node("a", [node("a1", [], { id: "a1" })], { id: "a", collapsed: true })],
      {
        id: "root",
      },
    );
    expect(navigate(collapsed, "a", "right")).toBe("a");
  });

  it("returns the same id for the root going up or left", () => {
    expect(navigate(tree(), "root", "left")).toBe("root");
    expect(navigate(tree(), "root", "up")).toBe("root");
  });
});
