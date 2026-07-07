/**
 * A tiny generic undo/redo stack.
 *
 * Because every model operation returns a new immutable tree, "undo" is just
 * "point back at the previous snapshot" — no inverse commands needed.
 */
export class History<T> {
  private stack: T[];
  private index: number;
  private readonly limit: number;

  constructor(initial: T, limit = 200) {
    this.stack = [initial];
    this.index = 0;
    this.limit = Math.max(1, limit);
  }

  /** The current state. */
  get current(): T {
    return this.stack[this.index]!;
  }

  /** Push a new state, discarding any redo history beyond the current point. */
  push(state: T): void {
    if (state === this.current) return;
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(state);
    this.index += 1;
    // Trim from the front if we exceed the limit.
    if (this.stack.length > this.limit) {
      const overflow = this.stack.length - this.limit;
      this.stack = this.stack.slice(overflow);
      this.index -= overflow;
    }
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  /** Step back one state (no-op if none). Returns the new current state. */
  undo(): T {
    if (this.canUndo()) this.index -= 1;
    return this.current;
  }

  /** Step forward one state (no-op if none). Returns the new current state. */
  redo(): T {
    if (this.canRedo()) this.index += 1;
    return this.current;
  }
}
