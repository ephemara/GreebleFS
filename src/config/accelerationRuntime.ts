export type AccelerationRoutingMode =
  | "auto"
  | "preferNative"
  | "preferCuda"
  | "cpuOnly";

export type AccelerationProviderKind = "cpu" | "wgpu" | "cudaPython";

export type AccelerationWorkloadId =
  | "thumbnails"
  | "mediaPipelines"
  | "highVolumePreviews"
  | "aiIndexing"
  | "localInference"
  | "similaritySearch"
  | "directStorage"
  | "fileHashing";

export interface AccelerationRoutingModeOption {
  id: AccelerationRoutingMode;
  label: string;
  description: string;
}

export interface AccelerationWorkloadDefinition {
  id: AccelerationWorkloadId;
  label: string;
  description: string;
  defaultProviderOrder: AccelerationProviderKind[];
}

export interface AccelerationProviderStatusLike {
  providerKind: AccelerationProviderKind;
  label?: string;
  available: boolean;
  ready: boolean;
  supportedWorkloadIds: AccelerationWorkloadId[];
}

export interface AccelerationRuntimeSnapshotLike {
  providers: AccelerationProviderStatusLike[];
}

export interface AccelerationProviderResolution {
  providerKind: AccelerationProviderKind;
  provider: AccelerationProviderStatusLike | null;
  available: boolean;
  ready: boolean;
}

export const accelerationRoutingModeOptions: readonly AccelerationRoutingModeOption[] =
  [
    {
      id: "auto",
      label: "Auto",
      description:
        "Pick the best ready provider for each workload based on its default acceleration order and fall back cleanly when an accelerator lane is not justified.",
    },
    {
      id: "preferNative",
      label: "Prefer Native",
      description:
        "Bias toward the built-in native `wgpu` lane when it can handle the workload.",
    },
    {
      id: "preferCuda",
      label: "Prefer CUDA",
      description:
        "Bias toward the Python-sidecar CUDA/AI lane for batched search, inference, and media-heavy work.",
    },
    {
      id: "cpuOnly",
      label: "CPU Only",
      description:
        "Disable accelerator routing and force the CPU fallback provider for every workload.",
    },
  ] as const;

export const accelerationWorkloadCatalog: readonly AccelerationWorkloadDefinition[] =
  [
    {
      id: "thumbnails",
      label: "Thumbnails",
      description: "Image, texture, 3D model, and explorer poster generation.",
      defaultProviderOrder: ["wgpu", "cudaPython", "cpu"],
    },
    {
      id: "mediaPipelines",
      label: "Media Pipelines",
      description:
        "Decode, transcode, proxy generation, and other media-adjacent transforms.",
      defaultProviderOrder: ["cudaPython", "wgpu", "cpu"],
    },
    {
      id: "highVolumePreviews",
      label: "High-Volume Previews",
      description:
        "Preview surfaces that churn through many images, frames, or waveform-style reductions.",
      defaultProviderOrder: ["wgpu", "cudaPython", "cpu"],
    },
    {
      id: "aiIndexing",
      label: "AI Indexing",
      description:
        "Batched embedding generation and local corpus indexing for semantic search.",
      defaultProviderOrder: ["cudaPython", "cpu"],
    },
    {
      id: "localInference",
      label: "Local Inference",
      description: "Torch or ONNX Runtime execution for local AI features.",
      defaultProviderOrder: ["cudaPython", "cpu"],
    },
    {
      id: "similaritySearch",
      label: "Similarity Search",
      description:
        "Vector lookup, nearest-neighbor search, and perceptual comparison over prepared indices rather than filesystem metadata truth.",
      defaultProviderOrder: ["cudaPython", "cpu"],
    },
    {
      id: "directStorage",
      label: "Direct Storage",
      description:
        "Large storage-to-accelerator transfers and batched preview/model reads when the platform and provider support them, not tiny metadata lookups.",
      defaultProviderOrder: ["cudaPython", "cpu"],
    },
    {
      id: "fileHashing",
      label: "File Hashing",
      description:
        "Bulk hashing or hash-adjacent file processing when a provider is suitable for coarse-grained batches.",
      defaultProviderOrder: ["cudaPython", "cpu"],
    },
  ] as const;

export function normalizeAccelerationRoutingMode(
  value: unknown,
): AccelerationRoutingMode {
  return value === "preferNative" ||
    value === "preferCuda" ||
    value === "cpuOnly"
    ? value
    : "auto";
}

export function getAccelerationRoutingModeLabel(
  value: AccelerationRoutingMode,
): string {
  return (
    accelerationRoutingModeOptions.find((option) => option.id === value)
      ?.label ?? "Auto"
  );
}

export function getAccelerationWorkloadDefinition(
  workloadId: AccelerationWorkloadId,
): AccelerationWorkloadDefinition {
  return (
    accelerationWorkloadCatalog.find(
      (definition) => definition.id === workloadId,
    ) ?? accelerationWorkloadCatalog[0]
  );
}

export function findAccelerationProviderStatus(
  snapshot: AccelerationRuntimeSnapshotLike,
  providerKind: AccelerationProviderKind,
): AccelerationProviderStatusLike | null {
  return (
    snapshot.providers.find(
      (provider) => provider.providerKind === providerKind,
    ) ?? null
  );
}

function reorderProviderOrder(
  providerOrder: readonly AccelerationProviderKind[],
  mode: AccelerationRoutingMode,
): AccelerationProviderKind[] {
  if (mode === "cpuOnly") {
    return ["cpu"];
  }

  const nextOrder = [...providerOrder];
  const promote =
    mode === "preferNative"
      ? "wgpu"
      : mode === "preferCuda"
        ? "cudaPython"
        : null;
  if (!promote || !nextOrder.includes(promote)) {
    return nextOrder;
  }

  return [
    promote,
    ...nextOrder.filter((providerKind) => providerKind !== promote),
  ];
}

export function resolveAccelerationProviderForWorkload(
  snapshot: AccelerationRuntimeSnapshotLike,
  workloadId: AccelerationWorkloadId,
  mode: AccelerationRoutingMode,
): AccelerationProviderResolution {
  const definition = getAccelerationWorkloadDefinition(workloadId);
  const orderedProviders = reorderProviderOrder(
    definition.defaultProviderOrder,
    mode,
  );
  const candidateProviders = orderedProviders
    .map((providerKind) =>
      findAccelerationProviderStatus(snapshot, providerKind),
    )
    .filter(
      (provider): provider is AccelerationProviderStatusLike =>
        provider != null && provider.supportedWorkloadIds.includes(workloadId),
    );

  const readyProvider =
    candidateProviders.find((provider) => provider.ready) ??
    candidateProviders.find((provider) => provider.available) ??
    findAccelerationProviderStatus(snapshot, "cpu");

  return {
    providerKind: readyProvider?.providerKind ?? "cpu",
    provider: readyProvider ?? null,
    available: readyProvider?.available ?? false,
    ready: readyProvider?.ready ?? false,
  };
}
