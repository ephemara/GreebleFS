export const LOOKDEV_OPEN_OVERLAY_EVENT = "greeblefs:open-lookdev-overlay";
export const LOOKDEV_TOGGLE_OVERLAY_EVENT = "greeblefs:toggle-lookdev-overlay";
export const LOOKDEV_APPLY_PRESET_EVENT = "greeblefs:apply-lookdev-preset";
export const LOOKDEV_REFRESH_PRESETS_EVENT = "greeblefs:refresh-lookdev-presets";

export interface LookdevApplyPresetEventDetail {
  presetId?: string | null;
}
