/**
 * A small, self-contained right-click menu. Renders an invisible full-surface
 * backdrop that closes the menu on any outside interaction, plus the menu itself.
 */
import { useState, type CSSProperties } from "react";

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Optional leading glyph. */
  icon?: string;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const menuStyle: CSSProperties = {
  position: "absolute",
  zIndex: 30,
  minWidth: 176,
  padding: 6,
  borderRadius: 10,
  background: "#fff",
  border: "1px solid #e5e7eb",
  boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
  fontSize: 13,
};

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <>
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        style={{ position: "absolute", inset: 0, zIndex: 29 }}
      />
      <div
        style={{ ...menuStyle, left: x, top: y }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {items.map((item, i) => (
          <button
            key={i}
            disabled={item.disabled}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
              onClose();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "7px 10px",
              border: "none",
              borderRadius: 6,
              textAlign: "left",
              font: "inherit",
              cursor: item.disabled ? "default" : "pointer",
              color: item.disabled
                ? "#9ca3af"
                : item.danger
                  ? "#dc2626"
                  : "#111827",
              background:
                hovered === i && !item.disabled
                  ? item.danger
                    ? "#fef2f2"
                    : "#f3f4f6"
                  : "transparent",
            }}
          >
            <span style={{ width: 16, textAlign: "center", opacity: 0.8 }}>
              {item.icon ?? ""}
            </span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
