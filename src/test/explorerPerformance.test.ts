import { describe, expect, it } from "vitest";

import {
  EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS,
  EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION,
  EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED,
  explorerPerformance,
} from "../config/explorerPerformance";

describe("explorerPerformance", () => {
  it("loads folder activation speed policy from the shipped /usr config", () => {
    expect(explorerPerformance.id).toBe("greeblefs-core-explorer-performance");
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_PREVIEW_DELAY_MS).toBe(180);
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_SECOND_CLICK_IMMEDIATE_NAVIGATION).toBe(true);
    expect(EXPLORER_FOLDER_DOUBLE_CLICK_DEDUPE_WINDOW_MS).toBe(96);
    expect(EXPLORER_POINTER_DOWN_DIRECTORY_WARM_ENABLED).toBe(true);
    expect(EXPLORER_DOUBLE_CLICK_SECOND_CLICK_TO_NAVIGATE_DISPATCH_BUDGET_MS).toBe(1);
  });
});
