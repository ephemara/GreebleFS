import type { LoadedLookdevPreset } from '../config/lookdevPresets';
import type {
  SecondaryWindowDescriptor,
  SecondaryWindowOpenRequest,
} from '../generated/tauri';
import {
  createSecondaryWindowOpenRequest,
  parseSecondaryWindowPayload,
} from './secondaryWindows';

export const LOOKDEV_SECONDARY_WINDOW_ID = 'lookdev';

export interface LookdevSecondaryWindowPayload {
  presetId?: string | null;
  preset?: LoadedLookdevPreset | null;
}

export function createLookdevSecondaryWindowOpenRequest(args: {
  presetId?: string | null;
  preset?: LoadedLookdevPreset | null;
} = {}): SecondaryWindowOpenRequest {
  return createSecondaryWindowOpenRequest({
    windowId: LOOKDEV_SECONDARY_WINDOW_ID,
    surfaceKind: 'lookdev',
    presentation: 'tool-window',
    title: 'Global Lookdev',
    initialSize: {
      width: 1240,
      height: 860,
    },
    minSize: {
      width: 760,
      height: 560,
    },
    payload: {
      presetId: args.presetId ?? args.preset?.id ?? null,
      preset: args.preset ?? null,
    } satisfies LookdevSecondaryWindowPayload,
  });
}

export function isLookdevSecondaryWindowDescriptor(
  descriptor: SecondaryWindowDescriptor | null | undefined,
): descriptor is SecondaryWindowDescriptor {
  return descriptor?.surfaceKind === 'lookdev';
}

export function parseLookdevSecondaryWindowPayload(
  payloadJson: string | null | undefined,
): LookdevSecondaryWindowPayload | null {
  return parseSecondaryWindowPayload<LookdevSecondaryWindowPayload>(payloadJson);
}
