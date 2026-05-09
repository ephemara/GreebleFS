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
  it("enables the native-first hot lanes by default and keeps runtime capability checks authoritative", () => {
    expect(DEFAULT_GREEBLE_NATIVE_LANE_FEATURE_FLAGS).toEqual({
      thumbnailGenerationNativeControl: true,
      previewByteReadsNativeBufferPool: true,
      directoryListingNativeBufferPool: true,
      searchResultsNativeRing: true,
      taskOutputNativeRing: true,
      terminalOutputNativeRingComparison: true,
      settingsButtonsNativeControl: true,
    });
  });

  it("falls back to current invoke or transport behavior without runtime capabilities", () => {
    for (const plan of GREEBLE_NATIVE_LANE_SYSTEM_PLANS) {
      expect(resolveGreebleNativeLaneSelection(plan.systemId)).toMatchObject({
        systemId: plan.systemId,
        activeLane: plan.fallbackLane,
        fallbackLane: plan.fallbackLane,
        nativeRequested: true,
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

  it("routes generated thumbnail artifacts through native control instead of data URL invoke", () => {
    const selected = resolveGreebleNativeLaneSelection(
      "thumbnailGeneration",
      { thumbnailGenerationNativeControl: true },
      { nativeControl: true },
    );

    expect(selected).toMatchObject({
      activeLane: "native_control",
      recommendedLane: "native_control",
      fallbackLane: "transport_fallback_replay",
      nativeRequested: true,
      nativeAvailable: true,
    });
  });

  it("tracks settings button actions as native-control candidates with invoke fallback", () => {
    expect(getGreebleNativeLaneSystemPlan("settingsButtonActions")).toMatchObject({
      recommendedLane: "native_control",
      fallbackLane: "invoke",
      requiredCapability: "nativeControl",
      migrationState: "candidate",
    });
  });

  it.each([
    ["thumbnailGeneration", "thumbnailGenerationNativeControl"],
    ["previewByteReads", "previewByteReadsNativeBufferPool"],
    ["directoryListingSnapshots", "directoryListingNativeBufferPool"],
    ["searchResultStreams", "searchResultsNativeRing"],
    ["taskOutputStreams", "taskOutputNativeRing"],
    ["terminalOutputComparison", "terminalOutputNativeRingComparison"],
    ["settingsButtonActions", "settingsButtonsNativeControl"],
  ] satisfies Array<[GreebleNativeLaneSystemId, keyof GreebleNativeLaneFeatureFlags]>)(
    "keeps %s behind the %s switch",
    (systemId, featureFlag) => {
      expect(getGreebleNativeLaneSystemPlan(systemId).featureFlag).toBe(featureFlag);
    },
  );
});
