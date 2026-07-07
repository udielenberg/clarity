import { describe, it, expect } from "vitest";
import { node } from "../model.js";
import { toMarkdown, fromMarkdown } from "../io/markdown.js";
import { toJSON, fromJSON } from "../io/json.js";
import { createMap } from "../model.js";

describe("markdown I/O", () => {
  it("serializes to an indented bullet list", () => {
    const root = node("root", [node("a", [node("a1")]), node("b")]);
    expect(toMarkdown(root)).toBe(
      ["- root", "  - a", "    - a1", "  - b"].join("\n"),
    );
  });

  it("round-trips structure (ids differ, shape matches)", () => {
    const root = node("Ideas", [node("One", [node("Detail")]), node("Two")]);
    const back = fromMarkdown(toMarkdown(root));
    expect(back.text).toBe("Ideas");
    expect(back.children.map((c) => c.text)).toEqual(["One", "Two"]);
    expect(back.children[0]!.children[0]!.text).toBe("Detail");
  });

  it("wraps multiple top-level bullets under a synthetic root", () => {
    const tree = fromMarkdown("- one\n- two", "Wrapper");
    expect(tree.text).toBe("Wrapper");
    expect(tree.children.map((c) => c.text)).toEqual(["one", "two"]);
  });

  it("accepts tabs and different bullet chars", () => {
    const tree = fromMarkdown("* root\n\t* child");
    expect(tree.text).toBe("root");
    expect(tree.children[0]!.text).toBe("child");
  });

  it("returns an empty-ish root for blank input", () => {
    expect(fromMarkdown("   ", "Empty").text).toBe("Empty");
  });
});

describe("json I/O", () => {
  it("round-trips exactly, ids included", () => {
    const map = createMap(
      node("root", [node("a", [], { id: "a", note: "n" })], { id: "root" }),
    );
    const back = fromJSON(toJSON(map));
    expect(back.root.id).toBe("root");
    expect(back.root.children[0]!.id).toBe("a");
    expect(back.root.children[0]!.note).toBe("n");
  });

  it("rejects invalid JSON", () => {
    expect(() => fromJSON("{not json")).toThrow(/invalid JSON/);
  });

  it("rejects an unsupported version", () => {
    expect(() => fromJSON(JSON.stringify({ version: 99, root: {} }))).toThrow(
      /version/,
    );
  });

  it("rejects a malformed node", () => {
    const bad = JSON.stringify({ version: 1, root: { id: "r", text: "t" } });
    expect(() => fromJSON(bad)).toThrow(/children/);
  });
});
