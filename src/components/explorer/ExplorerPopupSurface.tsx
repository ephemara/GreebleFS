import { type CSSProperties, type ComponentProps } from "react";

import { ExplorerFloatingSurface } from "./ExplorerFloatingSurface";
import {
  resolveExplorerPopupSurfaceStyle,
  type ExplorerPopupSurfaceTone,
} from "./explorerPopupStyles";

type ExplorerPopupSurfaceProps = Omit<
  ComponentProps<typeof ExplorerFloatingSurface>,
  "style"
> & {
  tone?: ExplorerPopupSurfaceTone;
  minWidth?: CSSProperties["minWidth"];
  maxWidth?: CSSProperties["maxWidth"];
  maxHeight?: CSSProperties["maxHeight"];
  padding?: CSSProperties["padding"];
  overflowY?: CSSProperties["overflowY"];
  style?: CSSProperties;
};

export function ExplorerPopupSurface({
  tone = "menu",
  minWidth,
  maxWidth,
  maxHeight,
  padding,
  overflowY,
  style,
  ...surfaceProps
}: ExplorerPopupSurfaceProps) {
  return (
    <ExplorerFloatingSurface
      {...surfaceProps}
      style={{
        ...resolveExplorerPopupSurfaceStyle({
          tone,
          minWidth,
          maxWidth,
          maxHeight,
          padding,
          overflowY,
        }),
        ...style,
      }}
    />
  );
}
