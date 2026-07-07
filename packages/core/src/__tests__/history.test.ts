import { describe, it, expect } from "vitest";
import { History } from "../history.js";

describe("History", () => {
  it("undoes and redoes", () => {
    const h = new History(0);
    h.push(1);
    h.push(2);
    expect(h.current).toBe(2);
    expect(h.undo()).toBe(1);
    expect(h.undo()).toBe(0);
    expect(h.canUndo()).toBe(false);
    expect(h.undo()).toBe(0); // no-op past the start
    expect(h.redo()).toBe(1);
    expect(h.redo()).toBe(2);
    expect(h.canRedo()).toBe(false);
  });

  it("drops the redo branch after a new push", () => {
    const h = new History("a");
    h.push("b");
    h.push("c");
    h.undo(); // back to "b"
    h.push("d"); // new branch
    expect(h.current).toBe("d");
    expect(h.canRedo()).toBe(false);
    expect(h.undo()).toBe("b");
  });

  it("ignores a push equal to the current state", () => {
    const h = new History(1);
    h.push(1);
    expect(h.canUndo()).toBe(false);
  });

  it("trims to the history limit", () => {
    const h = new History(0, 3);
    h.push(1);
    h.push(2);
    h.push(3); // stack now [1,2,3], "0" trimmed
    expect(h.current).toBe(3);
    h.undo();
    h.undo();
    expect(h.current).toBe(1);
    expect(h.canUndo()).toBe(false);
  });
});
