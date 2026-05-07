declare module "culori" {
  export interface CuloriColor {
    mode?: string;
    alpha?: number;
    r?: number;
    g?: number;
    b?: number;
  }

  export function parse(color: string): CuloriColor | undefined;
  export function converter(mode: "rgb"): (color: CuloriColor) => CuloriColor | undefined;
  export function formatHex(color: CuloriColor): string;
  export function formatHex8(color: CuloriColor): string;
}
