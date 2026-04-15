export function MonolithScopedStyles() {
  return (
    <style>{`
      @keyframes vector-monolith-explorer-drift {
        0%, 100% { transform: translate3d(0, 0, 24px); }
        50% { transform: translate3d(0, -4px, 36px); }
      }

      [data-vector-monolith-shell] {
        isolation: isolate;
      }

      [data-vector-monolith-shell] [data-overlay-explorer] {
        position: relative;
        overflow: visible !important;
        perspective: 2400px;
        transform-style: preserve-3d;
        background:
          radial-gradient(circle at 18% 14%, rgba(255, 156, 88, 0.12), transparent 18%),
          radial-gradient(circle at 76% 0%, rgba(100, 244, 215, 0.14), transparent 24%),
          linear-gradient(180deg, rgba(6, 16, 22, 0.94), rgba(4, 10, 14, 0.98));
        box-shadow:
          inset 0 0 0 1px rgba(118, 212, 196, 0.1),
          inset 0 28px 72px rgba(0, 0, 0, 0.28);
      }

      [data-vector-monolith-shell] [data-overlay-explorer]::before {
        content: '';
        position: absolute;
        inset: 8px;
        border-radius: calc(var(--overlay-explorer-panel-radius) + 6px);
        border: 1px solid rgba(100, 244, 215, 0.12);
        box-shadow: 0 24px 72px rgba(0, 0, 0, 0.34);
        transform: translateZ(18px);
        pointer-events: none;
      }

      [data-vector-monolith-shell] [data-overlay-explorer]::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0) 14%),
          repeating-linear-gradient(90deg, rgba(100, 244, 215, 0.04) 0 1px, transparent 1px 136px);
        opacity: 0.56;
        mix-blend-mode: screen;
        pointer-events: none;
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="rail"],
      [data-vector-monolith-shell] [data-overlay-explorer-plane="main"],
      [data-vector-monolith-shell] [data-overlay-explorer-plane="toolbar"],
      [data-vector-monolith-shell] [data-overlay-explorer-plane="file-area"],
      [data-vector-monolith-shell] [data-overlay-explorer-plane="preview"],
      [data-vector-monolith-shell] [data-overlay-explorer-plane="status"],
      [data-vector-monolith-shell] [data-overlay-explorer-plane="content-viewport"] {
        position: relative;
        overflow: visible !important;
        transform-style: preserve-3d;
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="rail"] {
        z-index: 4;
        transform: translate3d(0, 0, 54px);
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="main"] {
        z-index: 3;
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="toolbar"] {
        z-index: 7;
        transform: translate3d(0, 0, 80px);
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="file-area"] {
        z-index: 4;
        transform: translate3d(0, 0, 28px);
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="content-viewport"] {
        z-index: 4;
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="status"] {
        z-index: 6;
        transform: translate3d(0, 0, 56px);
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="preview"] {
        z-index: 5;
        transform: translate3d(0, 0, 64px);
      }

      [data-vector-monolith-shell] [data-overlay-explorer-surface="explorerTopbar"],
      [data-vector-monolith-shell] [data-overlay-explorer-surface="explorerToolbar"],
      [data-vector-monolith-shell] [data-overlay-explorer-surface="previewHeader"] {
        position: relative;
        overflow: visible;
        transform: translateZ(12px);
        transform-style: preserve-3d;
      }

      [data-vector-monolith-shell] [data-overlay-explorer-row] {
        position: relative;
        transform-style: preserve-3d;
      }

      [data-vector-monolith-shell] [data-overlay-explorer-zone] {
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(9, 24, 31, 0.84), rgba(4, 10, 14, 0.9));
        border: 1px solid rgba(118, 212, 196, 0.14);
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.18);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
      }

      [data-vector-monolith-shell] [data-overlay-explorer-control] {
        position: relative;
        z-index: 1;
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="content-viewport"] [data-overlay-drag-source="file"] {
        transform-style: preserve-3d;
        transition: filter 160ms ease;
      }

      [data-vector-monolith-shell] [data-overlay-explorer-plane="content-viewport"] [data-overlay-drag-source="file"]:hover {
        filter: drop-shadow(0 18px 22px rgba(0, 0, 0, 0.28));
      }

      [data-vector-monolith-shell] [data-overlay-explorer-experimental-mode="constellation"] [data-overlay-explorer-plane="content-viewport"] {
        animation: vector-monolith-explorer-drift 18s ease-in-out infinite;
      }

      [data-vector-monolith-shell][data-vector-monolith-mode="dock"] [data-overlay-explorer-plane="toolbar"] {
        transform: translate3d(0, 0, 62px);
      }

      [data-vector-monolith-shell][data-vector-monolith-mode="dock"] [data-overlay-explorer-plane="file-area"] {
        transform: translate3d(0, 0, 22px);
      }

      [data-vector-monolith-shell][data-vector-monolith-mode="dock"] [data-overlay-explorer-plane="preview"] {
        transform: translate3d(0, 0, 48px);
      }
    `}</style>
  );
}
