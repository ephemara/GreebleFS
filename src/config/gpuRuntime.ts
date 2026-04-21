export type GpuTierMode = 'auto' | 'safe' | 'integrated' | 'discrete';

export interface GpuRuntimeTierOption {
  id: GpuTierMode;
  label: string;
  description: string;
}

export const gpuRuntimeTierOptions: GpuRuntimeTierOption[] = [
  {
    id: 'auto',
    label: 'Auto',
    description: 'Choose a tier from the detected adapter and fall back to CPU if the adapter is software-backed or unsupported.',
  },
  {
    id: 'safe',
    label: 'Safe',
    description: 'Disable native GPU offload and force CPU fallback for explorer/media workloads.',
  },
  {
    id: 'integrated',
    label: 'Integrated',
    description: 'Enable bounded GPU work suitable for modern integrated GPUs and shared-memory adapters.',
  },
  {
    id: 'discrete',
    label: 'Discrete',
    description: 'Enable the heaviest native GPU budgets, larger caches, and more aggressive parallel offload.',
  },
];

export function normalizeGpuTierMode(value: unknown): GpuTierMode {
  return value === 'safe' || value === 'integrated' || value === 'discrete'
    ? value
    : 'auto';
}

export function getGpuTierModeLabel(value: GpuTierMode): string {
  return gpuRuntimeTierOptions.find(option => option.id === value)?.label ?? 'Auto';
}
