export type { MobileShareThemeSnapshot } from "../src/config/mobileTheme";

export interface MobileShareEntry {
  name: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  extension: string;
  mimeType: string | null;
  modifiedMs: number | null;
}

export interface MobileShareListingResponse {
  currentPath: string;
  canGoUp: boolean;
  shareName: string;
  hubMode: boolean;
  totalCount: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  entries: MobileShareEntry[];
}
