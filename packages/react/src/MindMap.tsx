/**
 * <MindMap /> — an interactive mind-map view, operable by mouse OR keyboard.
 *
 * Rendering: topic nodes are real DOM elements (crisp text, inline editing,
 * accessibility); connectors are SVG. Nodes are positioned with a CSS transform
 * that transitions, so the map *glides* when the layout changes.
 *
 * Mouse: click selects · double-click edits · hover shows a "+" (add child) and,
 * for parents, a collapse toggle · right-click ANY node for its action menu
 * (add · rename · recolor · delete) · drag a node onto another to re-parent ·
 * drag the background to pan · wheel to zoom · on-canvas buttons for zoom.
 *
 * Keyboard (node selected, not editing): Tab=child · Enter=sibling · F2/type=edit
 * · Delete=remove · ↑↓←→=move selection · Space=collapse · ⌘/Ctrl+Z=undo (+Shift/⌘Y=redo).
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
  isAncestor,
  layout,
  type Box,
  type MindMapStore,
  type MindNode,
  type Size,
} from "clarity-mind";
import { useMindMap } from "./useMindMap.js";
import { navigate, type Direction } from "./navigation.js";
import { ContextMenu, type MenuItem } from "./ContextMenu.js";

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

/** True for a 6-digit hex color, so an 8-bit alpha suffix is safe to append. */
const isHex6 = (c: string): boolean => /^#[0-9a-f]{6}$/i.test(c);

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const DRAG_THRESHOLD = 5;

interface View {
  x: number;
  y: number;
  zoom: number;
}

interface DragState {
  id: string;
  dx: number;
  dy: number;
  targetId: string | null;
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
  const [hovered, setHovered] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const centeredRef = useRef(false);
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

  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pad = 96;
    const zoom = clamp(
      Math.min(
        (el.clientWidth - pad) / Math.max(1, bounds.width),
        (el.clientHeight - pad) / Math.max(1, bounds.height),
      ),
      0.3,
      1.5,
    );
    setView({
      zoom,
      x: el.clientWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
      y: el.clientHeight / 2 - (bounds.y + bounds.height / 2) * zoom,
    });
  }, [bounds]);

  // Center once, on first layout.
  useLayoutEffect(() => {
    if (centeredRef.current || !containerRef.current) return;
    fitView();
    centeredRef.current = true;
  }, [fitView]);

  // Focus the edit input as soon as it appears.
  useLayoutEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = useCallback(
    (id: string, initial?: string) => {
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
      store.toggleCollapse(parentId, false);
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

  const removeNodeById = useCallback(
    (id: string) => {
      if (id === map.root.id) return;
      const parent = findParent(map.root, id);
      store.remove(id);
      setSelected(parent?.id ?? map.root.id);
    },
    [map, store],
  );

  // A node's accent = its explicit color, else the depth-based palette color.
  const accentFor = useCallback(
    (box: Box): string => findNode(map.root, box.id)?.color ?? colorFor(box),
    [map],
  );

  // --- Keyboard ------------------------------------------------------------
  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (editingRef.current) return;
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
          removeNodeById(selected);
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
          if (e.key.length === 1) {
            e.preventDefault();
            startEdit(selected, e.key);
          }
      }
    },
    [selected, map, store, addChild, addSibling, removeNodeById, startEdit],
  );

  // --- Pan, zoom & node-drag ----------------------------------------------
  const panRef = useRef<{
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    pointerId: number;
    moved: boolean;
    targetId: string | null;
  } | null>(null);

  const onBackgroundPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("[data-node]")) return; // node handles its own
      if (e.button !== 0) return; // don't start a pan on right/middle click
      containerRef.current?.focus();
      setSelected(map.root.id);
      setMenu(null);
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

  const startNodeDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, id: string) => {
      e.stopPropagation();
      // Primary button only. A right/middle click must NOT capture the pointer,
      // or the follow-up `contextmenu` event gets retargeted off the node and
      // its menu never opens — the bug where only the root was right-clickable.
      if (e.button !== 0) return;
      setSelected(id);
      setMenu(null);
      containerRef.current?.focus();
      if (id === map.root.id) return; // root can't be moved
      dragRef.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        moved: false,
        targetId: null,
      };
      containerRef.current?.setPointerCapture(e.pointerId);
    },
    [map],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (d) {
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        d.moved = true;
        const under = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-node]");
        let tid = under?.getAttribute("data-node") ?? null;
        if (tid && (tid === d.id || isAncestor(map.root, d.id, tid)))
          tid = null;
        d.targetId = tid;
        setDrag({ id: d.id, dx, dy, targetId: tid });
        return;
      }
      const p = panRef.current;
      if (!p) return;
      setView((v) => ({
        ...v,
        x: p.ox + (e.clientX - p.startX),
        y: p.oy + (e.clientY - p.startY),
      }));
    },
    [map],
  );

  const endPointer = useCallback(() => {
    const d = dragRef.current;
    if (d) {
      if (d.moved && d.targetId) store.move(d.id, d.targetId);
      dragRef.current = null;
      setDrag(null);
    }
    panRef.current = null;
  }, [store]);

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

  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    const cx = el.clientWidth / 2;
    const cy = el.clientHeight / 2;
    setView((v) => {
      const zoom = clamp(v.zoom * factor, 0.3, 2.5);
      const k = zoom / v.zoom;
      return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, []);

  // --- Context menu items --------------------------------------------------
  const menuItems = useCallback(
    (id: string): MenuItem[] => {
      const n = findNode(map.root, id);
      const isRoot = id === map.root.id;
      const hasKids = !!n && n.children.length > 0;
      return [
        { label: "Add child", icon: "+", onClick: () => addChild(id) },
        {
          label: "Add sibling",
          icon: "↵",
          onClick: () => addSibling(id),
          disabled: isRoot,
        },
        { label: "Rename", icon: "✎", onClick: () => startEdit(id) },
        {
          label: n?.collapsed ? "Expand" : "Collapse",
          icon: n?.collapsed ? "▸" : "▾",
          onClick: () => store.toggleCollapse(id),
          disabled: !hasKids,
        },
        {
          label: "Delete",
          icon: "🗑",
          onClick: () => removeNodeById(id),
          danger: true,
          disabled: isRoot,
        },
      ];
    },
    [map, addChild, addSibling, startEdit, store, removeNodeById],
  );

  const ctrlBtn: CSSProperties = {
    width: 32,
    height: 32,
    display: "grid",
    placeItems: "center",
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    color: "#374151",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  };

  return (
    <div
      ref={containerRef}
      className={className}
      tabIndex={0}
      role="tree"
      onKeyDown={onKeyDown}
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
      onContextMenu={(e) => {
        // Right-click on empty canvas: no menu (nodes handle their own).
        if (!(e.target as HTMLElement).closest("[data-node]"))
          e.preventDefault();
      }}
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
                  stroke={accentFor(to)}
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
          const isEditing = editing === b.id;
          const isDragging = drag?.id === b.id;
          const isDropTarget = drag?.targetId === b.id;
          const isHovered = hovered === b.id;
          const accent = n.color ?? colorFor(b);
          const hasKids = n.children.length > 0;
          const outward = b.side === "left" ? -1 : 1; // +1 = grows right
          const dragOffX = isDragging && drag ? drag.dx / view.zoom : 0;
          const dragOffY = isDragging && drag ? drag.dy / view.zoom : 0;

          return (
            <div
              key={b.id}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: b.width,
                height: b.height,
                transform: `translate(${b.x + dragOffX}px, ${b.y + dragOffY}px)`,
                transition: isDragging
                  ? "none"
                  : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                zIndex: isDragging ? 20 : 1,
                // While dragging, the whole node is transparent to hit-testing so
                // elementFromPoint can find the drop target beneath the cursor.
                pointerEvents: isDragging ? "none" : "auto",
              }}
              onMouseEnter={() => setHovered(b.id)}
              onMouseLeave={() => setHovered((h) => (h === b.id ? null : h))}
            >
              {/* The visible pill */}
              <div
                data-node={b.id}
                role="treeitem"
                aria-selected={isSelected}
                onPointerDown={(ev) => startNodeDrag(ev, b.id)}
                onDoubleClick={() => startEdit(b.id)}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  const rect = containerRef.current?.getBoundingClientRect();
                  setSelected(b.id);
                  setMenu({
                    id: b.id,
                    x: ev.clientX - (rect?.left ?? 0),
                    y: ev.clientY - (rect?.top ?? 0),
                  });
                }}
                style={{
                  width: "100%",
                  height: "100%",
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
                  background: isRoot
                    ? (n.color ?? "#111827")
                    : n.color && isHex6(n.color)
                      ? `${n.color}14`
                      : "#fff",
                  border: `2px solid ${
                    isDropTarget
                      ? "#10b981"
                      : isSelected
                        ? accent
                        : isRoot
                          ? (n.color ?? "#111827")
                          : (n.color ?? "#e5e7eb")
                  }`,
                  boxShadow: isDropTarget
                    ? "0 0 0 3px #10b98155, 0 4px 12px rgba(0,0,0,0.15)"
                    : isSelected
                      ? `0 0 0 3px ${accent}33, 0 4px 12px rgba(0,0,0,0.12)`
                      : "0 1px 3px rgba(0,0,0,0.08)",
                  opacity: isDragging ? 0.65 : 1,
                  pointerEvents: isDragging ? "none" : "auto",
                  cursor: "grab",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {isEditing ? (
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
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {n.text || <span style={{ opacity: 0.4 }}>Untitled</span>}
                  </span>
                )}
              </div>

              {/* Collapse / expand toggle (parents only) */}
              {hasKids && !isEditing && (
                <button
                  title={n.collapsed ? "Expand" : "Collapse"}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    store.toggleCollapse(b.id);
                  }}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: outward > 0 ? "100%" : undefined,
                    right: outward < 0 ? "100%" : undefined,
                    transform: `translate(${outward > 0 ? "-50%" : "50%"}, -50%)`,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: `1.5px solid ${accent}`,
                    background: "#fff",
                    color: accent,
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {n.collapsed ? n.children.length : "–"}
                </button>
              )}

              {/* Add-child button (on hover / selection) */}
              {(isHovered || isSelected) && !isEditing && !isDragging && (
                <button
                  title="Add child"
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    addChild(b.id);
                  }}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: outward > 0 ? "100%" : undefined,
                    right: outward < 0 ? "100%" : undefined,
                    transform: `translate(${outward > 0 ? "10px" : "-10px"}, -50%)`,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: "none",
                    background: accent,
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    padding: 0,
                  }}
                >
                  +
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Zoom controls */}
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          zIndex: 15,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button title="Zoom in" style={ctrlBtn} onClick={() => zoomBy(1.2)}>
          +
        </button>
        <button
          title="Zoom out"
          style={ctrlBtn}
          onClick={() => zoomBy(1 / 1.2)}
        >
          –
        </button>
        <button
          title="Fit to screen"
          style={{ ...ctrlBtn, fontSize: 13 }}
          onClick={fitView}
        >
          ⤢
        </button>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.id)}
          onClose={() => setMenu(null)}
          swatches={{
            colors: BRANCH_COLORS,
            current: findNode(map.root, menu.id)?.color,
            onPick: (c) => store.setColor(menu.id, c),
          }}
        />
      )}
    </div>
  );
}
