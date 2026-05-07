import { defineExplorerWidget } from "overlayterm-explorer-widget";

export default defineExplorerWidget({
  component({ session, placement }) {
    const sizeVariant = placement?.sizeVariant ?? "regular";
    const fontSize = sizeVariant === "compact" ? 9 : sizeVariant === "wide" ? 11 : 10;
    const value = `${Math.round(session.currentDensity * 100)}%`;

    return (
      <div
        title={`Explorer size: ${value}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 0,
          width: "100%",
          height: "100%",
          padding: "0 8px",
          borderRadius: 999,
          border: "1px solid var(--overlay-explorer-chip-border)",
          background: "var(--overlay-explorer-chip-bg)",
          color: "var(--overlay-explorer-text)",
          fontSize,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        Size {value}
      </div>
    );
  },
});
