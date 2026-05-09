import { describe, expect, it } from "vitest";
import {
  DEFAULT_GREEBLE_NATIVE_LANE_FEATURE_FLAGS,
  GREEBLE_NATIVE_LANE_SYSTEM_PLANS,
  getGreebleNativeLaneSystemPlan,
  resolveGreebleNativeLaneSelection,
  type GreebleNativeLaneFeatureFlags,
  type GreebleNativeLaneSystemId,
} from "../config/nativeLaneMigration";

describe("native lane migration planning", () => {
  it("keeps every future native lane disabled by default", () => {
    expect(DEFAULT_GREEBLE_NATIVE_LANE_FEATURE_FLAGS).toEqual({
      thumbnailGenerationNativeBufferPool: false,
      previewByteReadsNativeBufferPool: false,
      directoryListingNativeControl: false,
      searchResultsNativeRing: false,
      taskOutputNativeRing: false,
      terminalOutputNativeRingComparison: false,
    });
  });

  it("falls back to current invoke or transport behavior without flags and capabilities", () => {
    for (const plan of GREEBLE_NATIVE_LANE_SYSTEM_PLANS) {
      expect(resolveGreebleNativeLaneSelection(plan.systemId)).toMatchObject({
        systemId: plan.systemId,
        activeLane: plan.fallbackLane,
        fallbackLane: plan.fallbackLane,
        nativeRequested: false,
        nativeAvailable: false,
      });
    }
  });

  it("does not select a native lane when a feature flag is enabled before runtime support exists", () => {
    const selected = resolveGreebleNativeLaneSelection("previewByteReads", {
      previewByteReadsNativeBufferPool: true,
    });

    expect(selected).toMatchObject({
      activeLane: "invoke",
      recommendedLane: "native_buffer_pool",
      fallbackLane: "invoke",
      nativeRequested: true,
      nativeAvailable: false,
    });
  });

  it("selects the recommended native lane only when both the flag and capability are present", () => {
    const selected = resolveGreebleNativeLaneSelection(
      "taskOutputStreams",
      { taskOutputNativeRing: true },
      { nativeRing: true },
    );

    expect(selected).toMatchObject({
      activeLane: "native_ring",
      recommendedLane: "native_ring",
      fallbackLane: "transport_fallback_replay",
      nativeRequested: true,
      nativeAvailable: true,
    });
  });

  it("keeps terminal output marked as comparison-only", () => {
    expect(getGreebleNativeLaneSystemPlan("terminalOutputComparison")).toMatchObject({
      recommendedLane: "native_ring",
      fallbackLane: "transport_fallback_replay",
      migrationState: "comparison-only",
    });
  });

  it.each([
    ["thumbnailGeneration", "thumbnailGenerationNativeBufferPool"],
    ["previewByteReads", "previewByteReadsNativeBufferPool"],
    ["directoryListingSnapshots", "directoryListingNativeControl"],
    ["searchResultStreams", "searchResultsNativeRing"],
    ["taskOutputStreams", "taskOutputNativeRing"],
    ["terminalOutputComparison", "terminalOutputNativeRingComparison"],
  ] satisfies Array<[GreebleNativeLaneSystemId, keyof GreebleNativeLaneFeatureFlags]>)(
    "keeps %s behind the %s switch",
    (systemId, featureFlag) => {
      expect(getGreebleNativeLaneSystemPlan(systemId).featureFlag).toBe(featureFlag);
    },
  );
});
