/**
 * <MindMap /> — an interactive, keyboard-first mind-map view.
 *
 * Rendering: topic nodes are real DOM elements (crisp text, inline editing,
 * accessibility); connectors are SVG. Nodes are positioned with a CSS transform
 * that transitions, so the map *glides* when the layout changes instead of
 * teleporting. Pan by dragging the background, zoom with the wheel.
 *
 * Keyboard model (when a node is selected and you're not editing):
 *   Tab           add a child and edit it
 *   Enter         add a sibling and edit it
 *   F2 / typing   edit the selected node
 *   Delete/Backspace   remove the selected node
 *   ↑ ↓ ← →       move selection (up/down siblings, left parent, right child)
 *   Space         toggle collapse
 *   ⌘/Ctrl+Z      undo   ·   ⌘/Ctrl+Shift+Z or ⌘/Ctrl+Y   redo
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  findNode,
  findParent,
  layout,
  type Box,
  type MindMapStore,
  type MindNode,
  type Size,
} from "clarity-mind";
import { useMindMap } from "./useMindMap.js";
import { navigate, type Direction } from "./navigation.js";

export interface MindMapProps {
  store: MindMapStore;
  className?: string;
  style?: CSSProperties;
}

const measure = (n: MindNode): Size => ({
  width: Math.min(260, Math.max(72, n.text.length * 8 + 30)),
  height: 38,
});

const BRANCH_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];
const colorFor = (b: Box): string =>
  b.side === "root"
    ? "#111827"
    : (BRANCH_COLORS[b.depth % BRANCH_COLORS.length] ?? "#6366f1");

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

interface View {
  x: number;
  y: number;
  zoom: number;
}

/** SVG path for a curved connector between two boxes. */
function connector(from: Box, to: Box): string {
  const leftSide = to.side === "left";
  const x1 = leftSide ? from.x : from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = leftSide ? to.x + to.width : to.x;
  const y2 = to.y + to.height / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export function MindMap({ store, className, style }: MindMapProps) {
  const map = useMindMap(store);
  const containerRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<string>(map.root.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const centeredRef = useRef(false);
  // Mirror `editing` synchronously so the keydown guard is correct even before
  // React flushes state between rapid keystrokes.
  const editingRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { boxes, edges, bounds } = useMemo(
    () => layout(map.root, { measure }),
    [map],
  );

  // Keep the selection valid if its node disappears (e.g. undo/remove).
  useEffect(() => {
    if (!findNode(map.root, selected)) setSelected(map.root.id);
  }, [map, selected]);

  // Center the map in the viewport once, on first layout.
  useLayoutEffect(() => {
    if (centeredRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    setView({
      x: el.clientWidth / 2 - cx,
      y: el.clientHeight / 2 - cy,
      zoom: 1,
    });
    centeredRef.current = true;
  }, [bounds]);

  // Focus (and select) the edit input as soon as it appears — synchronously,
  // before the browser processes the next keystroke.
  useLayoutEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = useCallback(
    (id: string, initial?: string) => {
      // When `initial` is given (e.g. a just-added node) we must NOT require the
      // node to exist in the current `map` closure — that snapshot is stale
      // immediately after an add, so the lookup would wrongly bail and the
      // editor would never open. Only look up existing text when needed.
      let text = initial;
      if (text === undefined) {
        const n = findNode(map.root, id);
        if (!n) return;
        text = n.text;
      }
      editingRef.current = id;
      setSelected(id);
      setEditText(text);
      setEditing(id);
    },
    [map],
  );

  const stopEditing = useCallback(() => {
    editingRef.current = null;
    setEditing(null);
  }, []);

  const commitEdit = useCallback(() => {
    if (editing) store.setText(editing, editText.trim());
    stopEditing();
  }, [editing, editText, store, stopEditing]);

  const addChild = useCallback(
    (parentId: string) => {
      const id = store.addChild(parentId, "");
      startEdit(id, "");
    },
    [store, startEdit],
  );

  const addSibling = useCallback(
    (siblingId: string) => {
      if (siblingId === map.root.id) {
        addChild(map.root.id);
        return;
      }
      const id = store.addSibling(siblingId, "");
      startEdit(id, "");
    },
    [store, map, startEdit, addChild],
  );

  const removeSelected = useCallback(() => {
    if (selected === map.root.id) return;
    const parent = findParent(map.root, selected);
    store.remove(selected);
    setSelected(parent?.id ?? map.root.id);
  }, [selected, map, store]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (editingRef.current) return; // the editing input handles its own keys
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
        return;
      }
      if (meta) return;

      switch (e.key) {
        case "Tab":
          e.preventDefault();
          addChild(selected);
          return;
        case "Enter":
          e.preventDefault();
          addSibling(selected);
          return;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          removeSelected();
          return;
        case "F2":
          e.preventDefault();
          startEdit(selected);
          return;
        case " ":
          e.preventDefault();
          store.toggleCollapse(selected);
          return;
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          const dir = e.key.replace("Arrow", "").toLowerCase() as Direction;
          setSelected(navigate(map.root, selected, dir));
          return;
        }
        default:
          // A printable character starts editing, replacing the text.
          if (e.key.length === 1) {
            e.preventDefault();
            startEdit(selected, e.key);
          }
      }
    },
    [
      editing,
      selected,
      map,
      store,
      addChild,
      addSibling,
      removeSelected,
      startEdit,
    ],
  );

  // --- Pan & zoom ---------------------------------------------------------
  const panRef = useRef<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Only pan when the background (not a node) is grabbed.
      if ((e.target as HTMLElement).closest("[data-node]")) return;
      containerRef.current?.focus();
      setSelected(map.root.id);
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        ox: view.x,
        oy: view.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [view, map],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const p = panRef.current;
    if (!p) return;
    setView((v) => ({
      ...v,
      x: p.ox + (e.clientX - p.startX),
      y: p.oy + (e.clientY - p.startY),
    }));
  }, []);

  const endPan = useCallback(() => {
    panRef.current = null;
  }, []);

  const onWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const zoom = clamp(v.zoom * factor, 0.3, 2.5);
      const k = zoom / v.zoom;
      return { zoom, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      tabIndex={0}
      role="tree"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onWheel={onWheel}
      style={{
        position: "relative",
        overflow: "hidden",
        outline: "none",
        background: "#f8fafc",
        cursor: panRef.current ? "grabbing" : "grab",
        touchAction: "none",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          width={Math.max(1, bounds.width)}
          height={Math.max(1, bounds.height)}
          style={{
            position: "absolute",
            left: bounds.x,
            top: bounds.y,
            overflow: "visible",
          }}
        >
          <g transform={`translate(${-bounds.x}, ${-bounds.y})`}>
            {edges.map((e) => {
              const from = boxes.get(e.from);
              const to = boxes.get(e.to);
              if (!from || !to) return null;
              return (
                <path
                  key={`${e.from}->${e.to}`}
                  d={connector(from, to)}
                  fill="none"
                  stroke={colorFor(to)}
                  strokeWidth={2}
                  opacity={0.55}
                />
              );
            })}
          </g>
        </svg>

        {[...boxes.values()].map((b) => {
          const n = findNode(map.root, b.id);
          if (!n) return null;
          const isSelected = b.id === selected;
          const isRoot = b.side === "root";
          const accent = colorFor(b);
          return (
            <div
              key={b.id}
              data-node={b.id}
              role="treeitem"
              aria-selected={isSelected}
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={() => {
                setSelected(b.id);
                containerRef.current?.focus();
              }}
              onDoubleClick={() => startEdit(b.id)}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: b.width,
                height: b.height,
                transform: `translate(${b.x}px, ${b.y}px)`,
                transition: "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                padding: "0 12px",
                borderRadius: 9,
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                fontSize: 14,
                fontWeight: isRoot ? 700 : 500,
                color: isRoot ? "#fff" : "#111827",
                background: isRoot ? "#111827" : "#fff",
                border: `2px solid ${isSelected ? accent : isRoot ? "#111827" : "#e5e7eb"}`,
                boxShadow: isSelected
                  ? `0 0 0 3px ${accent}33, 0 4px 12px rgba(0,0,0,0.12)`
                  : "0 1px 3px rgba(0,0,0,0.08)",
                cursor: "pointer",
                userSelect: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {editing === b.id ? (
                <input
                  ref={inputRef}
                  value={editText}
                  onChange={(ev) => setEditText(ev.target.value)}
                  onBlur={commitEdit}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      const id = editing;
                      commitEdit();
                      if (id && id !== map.root.id) addSibling(id);
                      else addChild(map.root.id);
                    } else if (ev.key === "Tab") {
                      ev.preventDefault();
                      const id = editing;
                      commitEdit();
                      if (id) addChild(id);
                    } else if (ev.key === "Escape") {
                      ev.preventDefault();
                      stopEditing();
                    }
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    textAlign: "center",
                    font: "inherit",
                    color: "inherit",
                  }}
                />
              ) : (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {n.text || <span style={{ opacity: 0.4 }}>Untitled</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
