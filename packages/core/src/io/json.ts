/**
 * JSON import/export with validation.
 *
 * The on-disk shape is versioned so future changes can migrate old files.
 */
import type { MindMap, MindNode } from "../model.js";

export const FORMAT_VERSION = 1 as const;

interface SerializedMap {
  version: number;
  root: MindNode;
}

/** Serialize a map to a JSON string. */
export function toJSON(map: MindMap, pretty = true): string {
  const payload: SerializedMap = { version: FORMAT_VERSION, root: map.root };
  return JSON.stringify(payload, null, pretty ? 2 : undefined);
}

function validateNode(value: unknown, path: string): MindNode {
  if (typeof value !== "object" || value === null) {
    throw new Error(`clarity: ${path} must be an object`);
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.id !== "string" || obj.id.length === 0) {
    throw new Error(`clarity: ${path}.id must be a non-empty string`);
  }
  if (typeof obj.text !== "string") {
    throw new Error(`clarity: ${path}.text must be a string`);
  }
  if (!Array.isArray(obj.children)) {
    throw new Error(`clarity: ${path}.children must be an array`);
  }
  const children = obj.children.map((c, i) =>
    validateNode(c, `${path}.children[${i}]`),
  );
  const result: MindNode = { id: obj.id, text: obj.text, children };
  if (typeof obj.collapsed === "boolean") result.collapsed = obj.collapsed;
  if (typeof obj.note === "string") result.note = obj.note;
  return result;
}

/** Parse and validate a JSON string into a map. Throws on malformed input. */
export function fromJSON(text: string): MindMap {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("clarity: invalid JSON");
  }
  if (typeof data !== "object" || data === null) {
    throw new Error("clarity: expected an object at the top level");
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== FORMAT_VERSION) {
    throw new Error(
      `clarity: unsupported format version ${String(obj.version)}`,
    );
  }
  return { root: validateNode(obj.root, "root") };
}
