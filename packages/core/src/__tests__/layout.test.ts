import { describe, it, expect } from "vitest";
import { layout, type Box } from "../layout.js";
import { n } from "./helpers.js";

const fixed = () => ({ width: 100, height: 40 });

/** Do two boxes overlap vertically? */
function vOverlap(a: Box, b: Box): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("layout", () => {
  it("positions every node exactly once", () => {
    const root = n("root", [n("a"), n("b"), n("c")]);
    const { boxes } = layout(root, { measure: fixed });
    expect(boxes.size).toBe(4);
    expect(boxes.has("root")).toBe(true);
  });

  it("emits an edge from each parent to each child", () => {
    const root = n("root", [n("a", [n("a1")]), n("b")]);
    const { edges } = layout(root, { measure: fixed });
    expect(edges).toContainEqual({ from: "root", to: "a" });
    expect(edges).toContainEqual({ from: "root", to: "b" });
    expect(edges).toContainEqual({ from: "a", to: "a1" });
    expect(edges).toHaveLength(3);
  });

  it("splits first-level children onto both sides when two-sided", () => {
    const root = n("root", [n("a"), n("b"), n("c"), n("d")]);
    const { boxes } = layout(root, { measure: fixed, twoSided: true });
    const sides = ["a", "b", "c", "d"].map((id) => boxes.get(id)!.side);
    expect(sides.filter((s) => s === "right")).toHaveLength(2);
    expect(sides.filter((s) => s === "left")).toHaveLength(2);
  });

  it("keeps everything on the right when not two-sided", () => {
    const root = n("root", [n("a"), n("b")]);
    const { boxes } = layout(root, { measure: fixed, twoSided: false });
    expect(boxes.get("a")!.side).toBe("right");
    expect(boxes.get("b")!.side).toBe("right");
    // Right-side children sit to the right of the root's right edge.
    const rootBox = boxes.get("root")!;
    expect(boxes.get("a")!.x).toBeGreaterThan(rootBox.x + rootBox.width);
  });

  it("places left-side children to the left of the root", () => {
    const root = n("root", [n("a"), n("b")]);
    const { boxes } = layout(root, { measure: fixed, twoSided: true });
    const left = [...boxes.values()].find((b) => b.side === "left")!;
    const rootBox = boxes.get("root")!;
    expect(left.x + left.width).toBeLessThan(rootBox.x);
  });

  it("does not vertically overlap siblings", () => {
    const root = n("root", [n("a"), n("b"), n("c"), n("d"), n("e")]);
    const { boxes } = layout(root, {
      measure: fixed,
      twoSided: false,
      vGap: 10,
    });
    const kids = ["a", "b", "c", "d", "e"].map((id) => boxes.get(id)!);
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        expect(vOverlap(kids[i]!, kids[j]!)).toBe(false);
      }
    }
  });

  it("hides children of a collapsed node", () => {
    const root = n("root", [n("a", [n("a1"), n("a2")], { collapsed: true })]);
    const { boxes } = layout(root, { measure: fixed });
    expect(boxes.has("a")).toBe(true);
    expect(boxes.has("a1")).toBe(false);
    expect(boxes.has("a2")).toBe(false);
  });

  it("centers a parent vertically on its children", () => {
    const root = n("p", [n("c1"), n("c2"), n("c3")]);
    const { boxes } = layout(root, { measure: fixed, twoSided: false });
    const p = boxes.get("p")!;
    const c1 = boxes.get("c1")!;
    const c3 = boxes.get("c3")!;
    const pCenter = p.y + p.height / 2;
    const childrenCenter = (c1.y + c1.height / 2 + (c3.y + c3.height / 2)) / 2;
    expect(pCenter).toBeCloseTo(childrenCenter, 5);
  });

  it("reports sensible bounds", () => {
    const root = n("root", [n("a"), n("b")]);
    const { bounds, boxes } = layout(root, { measure: fixed });
    for (const b of boxes.values()) {
      expect(b.x).toBeGreaterThanOrEqual(bounds.x - 0.001);
      expect(b.y).toBeGreaterThanOrEqual(bounds.y - 0.001);
      expect(b.x + b.width).toBeLessThanOrEqual(
        bounds.x + bounds.width + 0.001,
      );
      expect(b.y + b.height).toBeLessThanOrEqual(
        bounds.y + bounds.height + 0.001,
      );
    }
  });
});
