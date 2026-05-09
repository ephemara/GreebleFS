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
  it("enables proven finite-payload pool lanes by default and keeps future stream lanes off", () => {
    expect(DEFAULT_GREEBLE_NATIVE_LANE_FEATURE_FLAGS).toEqual({
      thumbnailGenerationNativeBufferPool: false,
      previewByteReadsNativeBufferPool: true,
      directoryListingNativeBufferPool: true,
      searchResultsNativeRing: false,
      taskOutputNativeRing: false,
      terminalOutputNativeRingComparison: false,
    });
  });

  it("falls back to current invoke or transport behavior without runtime capabilities", () => {
    for (const plan of GREEBLE_NATIVE_LANE_SYSTEM_PLANS) {
      expect(resolveGreebleNativeLaneSelection(plan.systemId)).toMatchObject({
        systemId: plan.systemId,
        activeLane: plan.fallbackLane,
        fallbackLane: plan.fallbackLane,
        nativeRequested:
          plan.systemId === "previewByteReads" ||
          plan.systemId === "directoryListingSnapshots",
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

  it("treats directory listing snapshots as shared-buffer payload candidates", () => {
    const selected = resolveGreebleNativeLaneSelection(
      "directoryListingSnapshots",
      { directoryListingNativeBufferPool: true },
      { nativeBufferPool: true },
    );

    expect(selected).toMatchObject({
      activeLane: "native_buffer_pool",
      recommendedLane: "native_buffer_pool",
      fallbackLane: "invoke",
      nativeRequested: true,
      nativeAvailable: true,
    });
    expect(getGreebleNativeLaneSystemPlan("directoryListingSnapshots")).toMatchObject({
      migrationState: "candidate",
      requiredCapability: "nativeBufferPool",
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
    ["directoryListingSnapshots", "directoryListingNativeBufferPool"],
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
