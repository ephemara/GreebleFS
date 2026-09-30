import React from "react";

interface ShelfDropIndicatorProps {
  isHighlighted?: boolean;
}

export const ShelfDropIndicator: React.FC<ShelfDropIndicatorProps> = ({
  isHighlighted = true,
}) => {
  return (
    <div
      data-zbrush-drop-indicator="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 10,
        margin: "0 -5px",
        height: "100%",
        minHeight: 24,
        position: "relative",
        zIndex: 50,
        pointerEvents: "none",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 2,
          height: "80%",
          borderRadius: 2,
          background: isHighlighted
            ? "var(--overlay-accent, #ff8c00)"
            : "color-mix(in srgb, var(--overlay-accent, #ff8c00) 40%, transparent)",
          boxShadow: isHighlighted
            ? "0 0 8px 1px var(--overlay-accent, #ff8c00), 0 0 2px 0 #fff"
            : undefined,
          transition: "all 80ms ease-out",
        }}
      />
      {/* Top and bottom notch diamonds like ZBrush / DCC tools */}
      {isHighlighted && (
        <>
          <div
            style={{
              position: "absolute",
              top: 2,
              width: 6,
              height: 6,
              background: "var(--overlay-accent, #ff8c00)",
              transform: "rotate(45deg)",
              boxShadow: "0 0 4px var(--overlay-accent, #ff8c00)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 2,
              width: 6,
              height: 6,
              background: "var(--overlay-accent, #ff8c00)",
              transform: "rotate(45deg)",
              boxShadow: "0 0 4px var(--overlay-accent, #ff8c00)",
            }}
          />
        </>
      )}
    </div>
  );
};
