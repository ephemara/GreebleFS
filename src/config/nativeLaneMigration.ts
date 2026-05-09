export type GreebleNativeLaneKind =
  | "native_control"
  | "native_ring"
  | "native_buffer_pool"
  | "transport_fallback_replay"
  | "invoke";

export type GreebleNativeLaneSystemId =
  | "thumbnailGeneration"
  | "previewByteReads"
  | "directoryListingSnapshots"
  | "searchResultStreams"
  | "taskOutputStreams"
  | "terminalOutputComparison";

export interface GreebleNativeLaneFeatureFlags {
  thumbnailGenerationNativeBufferPool: boolean;
  previewByteReadsNativeBufferPool: boolean;
  directoryListingNativeControl: boolean;
  searchResultsNativeRing: boolean;
  taskOutputNativeRing: boolean;
  terminalOutputNativeRingComparison: boolean;
}

export interface GreebleNativeLaneRuntimeCapabilities {
  nativeControl: boolean;
  nativeRing: boolean;
  nativeBufferPool: boolean;
}

export interface GreebleNativeLaneSystemPlan {
  systemId: GreebleNativeLaneSystemId;
  currentLane: GreebleNativeLaneKind;
  recommendedLane: GreebleNativeLaneKind;
  fallbackLane: GreebleNativeLaneKind;
  featureFlag: keyof GreebleNativeLaneFeatureFlags | null;
  requiredCapability: keyof GreebleNativeLaneRuntimeCapabilities | null;
  migrationState: "candidate" | "comparison-only" | "leave-on-invoke";
}

export interface GreebleNativeLaneSelection {
  systemId: GreebleNativeLaneSystemId;
  activeLane: GreebleNativeLaneKind;
  recommendedLane: GreebleNativeLaneKind;
  fallbackLane: GreebleNativeLaneKind;
  nativeRequested: boolean;
  nativeAvailable: boolean;
}

export const DEFAULT_GREEBLE_NATIVE_LANE_FEATURE_FLAGS: GreebleNativeLaneFeatureFlags = Object.freeze({
  thumbnailGenerationNativeBufferPool: false,
  previewByteReadsNativeBufferPool: false,
  directoryListingNativeControl: false,
  searchResultsNativeRing: false,
  taskOutputNativeRing: false,
  terminalOutputNativeRingComparison: false,
});

export const DEFAULT_GREEBLE_NATIVE_LANE_RUNTIME_CAPABILITIES: GreebleNativeLaneRuntimeCapabilities = Object.freeze({
  nativeControl: false,
  nativeRing: false,
  nativeBufferPool: false,
});

export const GREEBLE_NATIVE_LANE_SYSTEM_PLANS: readonly GreebleNativeLaneSystemPlan[] = Object.freeze([
  {
    systemId: "thumbnailGeneration",
    currentLane: "transport_fallback_replay",
    recommendedLane: "native_buffer_pool",
    fallbackLane: "transport_fallback_replay",
    featureFlag: "thumbnailGenerationNativeBufferPool",
    requiredCapability: "nativeBufferPool",
    migrationState: "candidate",
  },
  {
    systemId: "previewByteReads",
    currentLane: "invoke",
    recommendedLane: "native_buffer_pool",
    fallbackLane: "invoke",
    featureFlag: "previewByteReadsNativeBufferPool",
    requiredCapability: "nativeBufferPool",
    migrationState: "candidate",
  },
  {
    systemId: "directoryListingSnapshots",
    currentLane: "invoke",
    recommendedLane: "native_control",
    fallbackLane: "invoke",
    featureFlag: "directoryListingNativeControl",
    requiredCapability: "nativeControl",
    migrationState: "leave-on-invoke",
  },
  {
    systemId: "searchResultStreams",
    currentLane: "invoke",
    recommendedLane: "native_ring",
    fallbackLane: "invoke",
    featureFlag: "searchResultsNativeRing",
    requiredCapability: "nativeRing",
    migrationState: "candidate",
  },
  {
    systemId: "taskOutputStreams",
    currentLane: "transport_fallback_replay",
    recommendedLane: "native_ring",
    fallbackLane: "transport_fallback_replay",
    featureFlag: "taskOutputNativeRing",
    requiredCapability: "nativeRing",
    migrationState: "candidate",
  },
  {
    systemId: "terminalOutputComparison",
    currentLane: "transport_fallback_replay",
    recommendedLane: "native_ring",
    fallbackLane: "transport_fallback_replay",
    featureFlag: "terminalOutputNativeRingComparison",
    requiredCapability: "nativeRing",
    migrationState: "comparison-only",
  },
]);

export function getGreebleNativeLaneSystemPlan(
  systemId: GreebleNativeLaneSystemId,
): GreebleNativeLaneSystemPlan {
  const plan = GREEBLE_NATIVE_LANE_SYSTEM_PLANS.find(
    (candidate) => candidate.systemId === systemId,
  );
  if (!plan) {
    throw new Error(`Unknown GreebleFS native lane system: ${systemId}`);
  }
  return plan;
}

export function resolveGreebleNativeLaneSelection(
  systemId: GreebleNativeLaneSystemId,
  flags: Partial<GreebleNativeLaneFeatureFlags> = {},
  capabilities: Partial<GreebleNativeLaneRuntimeCapabilities> = {},
): GreebleNativeLaneSelection {
  const plan = getGreebleNativeLaneSystemPlan(systemId);
  const resolvedFlags = {
    ...DEFAULT_GREEBLE_NATIVE_LANE_FEATURE_FLAGS,
    ...flags,
  };
  const resolvedCapabilities = {
    ...DEFAULT_GREEBLE_NATIVE_LANE_RUNTIME_CAPABILITIES,
    ...capabilities,
  };
  const nativeRequested = plan.featureFlag ? resolvedFlags[plan.featureFlag] : false;
  const nativeAvailable = plan.requiredCapability
    ? resolvedCapabilities[plan.requiredCapability]
    : true;
  const activeLane = nativeRequested && nativeAvailable
    ? plan.recommendedLane
    : plan.fallbackLane;

  return {
    systemId,
    activeLane,
    recommendedLane: plan.recommendedLane,
    fallbackLane: plan.fallbackLane,
    nativeRequested,
    nativeAvailable,
  };
}
