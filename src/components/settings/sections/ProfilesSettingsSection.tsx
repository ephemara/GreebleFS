import { useEffect, useMemo, useState } from 'react';

import {
  Copy,
  FolderOpen,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from '@/components/AppIcons';
import type { UsrProfileSettingsVariantDefinition } from '../../../config/usrProfileSettingsVariants';
import type {
  UsrProfileRuntimeSnapshot,
  UsrProfileSummary,
} from '../../../runtime/usrProfiles';
import {
  SettingsCompactActionButton,
  SettingsCompactPath,
  SettingsCompactSection,
  SettingsControlRow,
  SettingsIconActionButton,
  SettingsInlineNotice,
  SettingsKeyValueRow,
  SettingsMetricStrip,
  SettingsOverflowMenu,
  SettingsSectionScaffold,
  SettingsSelect,
  SettingsStatusPill,
} from '../SettingsPrimitives';

function buildManagedContentDirectorySourceBadges(
  stack: UsrProfileRuntimeSnapshot['managedContentDirectoryStacks'][number],
  directory: string,
): string[] {
  const badges: string[] = [];
  if (directory === stack.activeProfileDirectory) {
    badges.push('active-profile');
  }
  if (directory === stack.defaultProfileDirectory) {
    badges.push('default-profile-baseline');
  }
  if (directory === stack.sharedRootDirectory) {
    badges.push('shared-root');
  }
  if (directory === stack.baselineDirectory) {
    badges.push('baseline');
  }
  if (directory === stack.bundledDirectory) {
    badges.push('bundled-default');
  }
  if (badges.length === 0) {
    badges.push('effective-source');
  }
  return badges;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatProfileTimestamp(updatedAtMs: number): string {
  if (!Number.isFinite(updatedAtMs) || updatedAtMs <= 0) {
    return 'never';
  }
  return new Date(updatedAtMs).toLocaleString();
}

export function ProfilesSettingsSection({
  detail,
  accent,
  usrProfileRuntimeSnapshot,
  usrProfileSettingSliceKeys,
  usrProfileSharedSettingSliceKeys,
  usrProfileSettingsVariants = [],
  onSwitchUsrProfile,
  onCreateUsrProfile,
  onCreateUsrProfileFromVariant = () => {},
  onDuplicateUsrProfile,
  onRenameUsrProfile,
  onDeleteUsrProfile,
  onOpenUsrProfilesRootFolder,
  onOpenUsrProfileFolder,
}: {
  detail: string;
  accent: string;
  usrProfileRuntimeSnapshot: UsrProfileRuntimeSnapshot | null;
  usrProfileSettingSliceKeys: readonly string[];
  usrProfileSharedSettingSliceKeys: readonly string[];
  usrProfileSettingsVariants: readonly UsrProfileSettingsVariantDefinition[];
  onSwitchUsrProfile: (profileId: string) => Promise<void> | void;
  onCreateUsrProfile: (name: string, seedSettingsJson?: string | null) => Promise<void> | void;
  onCreateUsrProfileFromVariant: (variantId: string, name: string) => Promise<void> | void;
  onDuplicateUsrProfile: (profileId: string, name: string) => Promise<void> | void;
  onRenameUsrProfile: (profileId: string, name: string) => Promise<void> | void;
  onDeleteUsrProfile: (profileId: string) => Promise<void> | void;
  onOpenUsrProfilesRootFolder: () => Promise<void> | void;
  onOpenUsrProfileFolder: (profileId: string) => Promise<void> | void;
}) {
  const profiles = usrProfileRuntimeSnapshot?.profiles ?? [];
  const activeProfile =
    profiles.find((profile) => profile.isActive) ??
    profiles.find((profile) => profile.id === usrProfileRuntimeSnapshot?.activeProfileId) ??
    profiles[0] ??
    null;
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    activeProfile?.id ?? null,
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    usrProfileSettingsVariants[0]?.id ?? '',
  );
  const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(null);
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? activeProfile;
  const selectedVariant =
    usrProfileSettingsVariants.find((variant) => variant.id === selectedVariantId) ??
    usrProfileSettingsVariants[0] ??
    null;

  useEffect(() => {
    if (selectedProfileId && profiles.some((profile) => profile.id === selectedProfileId)) {
      return;
    }
    setSelectedProfileId(activeProfile?.id ?? null);
  }, [activeProfile?.id, profiles, selectedProfileId]);

  useEffect(() => {
    if (usrProfileSettingsVariants.length === 0) {
      if (selectedVariantId) {
        setSelectedVariantId('');
      }
      return;
    }
    if (!usrProfileSettingsVariants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(usrProfileSettingsVariants[0]?.id ?? '');
    }
  }, [selectedVariantId, usrProfileSettingsVariants]);

  const activeProfileOverrideSliceSet = useMemo(
    () => new Set(activeProfile?.overrideSlices ?? []),
    [activeProfile?.overrideSlices],
  );
  const managedContentStacks =
    usrProfileRuntimeSnapshot?.managedContentDirectoryStacks ?? [];

  const runProfileAction = async (
    actionLabel: string,
    action: () => Promise<void> | void,
  ) => {
    try {
      setPendingActionLabel(actionLabel);
      await action();
    } finally {
      setPendingActionLabel(null);
    }
  };

  const promptForProfileName = (label: string, suggestedValue: string): string | null => {
    const value = window.prompt(label, suggestedValue)?.trim() ?? '';
    return value.length > 0 ? value : null;
  };

  const handleCreateProfile = async () => {
    const suggestedName = `Profile ${profiles.length + 1}`;
    const name = promptForProfileName('Create profile from current settings', suggestedName);
    if (!name) {
      return;
    }
    await runProfileAction('Creating profile…', () => onCreateUsrProfile(name));
  };

  const handleCreateProfileFromVariant = async (
    variant: UsrProfileSettingsVariantDefinition,
  ) => {
    const name = promptForProfileName(
      `Create profile from ${variant.name}`,
      variant.name,
    );
    if (!name) {
      return;
    }
    await runProfileAction('Creating profile from variation…', () =>
      onCreateUsrProfileFromVariant(variant.id, name),
    );
  };

  const handleCreateSelectedVariantProfile = async () => {
    if (!selectedVariant) {
      return;
    }
    await handleCreateProfileFromVariant(selectedVariant);
  };

  const handleDuplicateProfile = async (
    profile: UsrProfileSummary | null | undefined = selectedProfile,
  ) => {
    if (!profile) {
      return;
    }
    const name = promptForProfileName(
      `Duplicate ${profile.name}`,
      `${profile.name} Copy`,
    );
    if (!name) {
      return;
    }
    await runProfileAction('Duplicating profile…', () =>
      onDuplicateUsrProfile(profile.id, name),
    );
  };

  const handleRenameProfile = async (
    profile: UsrProfileSummary | null | undefined = selectedProfile,
  ) => {
    if (!profile) {
      return;
    }
    const name = promptForProfileName(
      `Rename ${profile.name}`,
      profile.name,
    );
    if (!name || name === profile.name) {
      return;
    }
    await runProfileAction('Renaming profile…', () =>
      onRenameUsrProfile(profile.id, name),
    );
  };

  const handleDeleteProfile = async (
    profile: UsrProfileSummary | null | undefined = selectedProfile,
  ) => {
    if (!profile) {
      return;
    }
    const confirmed = window.confirm(
      `Delete profile "${profile.name}"? Shared usr content stays intact, but this profile folder will be removed.`,
    );
    if (!confirmed) {
      return;
    }
    await runProfileAction('Deleting profile…', () =>
      onDeleteUsrProfile(profile.id),
    );
  };

  const renderProfileOverflowMenu = (profile: UsrProfileSummary) => (
    <SettingsOverflowMenu label="...">
      <div className="grid gap-1">
        <SettingsCompactActionButton
          className="w-full justify-start"
          disabled={pendingActionLabel != null}
          onClick={() => {
            setSelectedProfileId(profile.id);
            void handleDuplicateProfile(profile);
          }}
        >
          <Copy size={11} />
          <span>Duplicate</span>
        </SettingsCompactActionButton>
        <SettingsCompactActionButton
          className="w-full justify-start"
          disabled={pendingActionLabel != null}
          onClick={() => {
            setSelectedProfileId(profile.id);
            void handleRenameProfile(profile);
          }}
        >
          <Pencil size={11} />
          <span>Rename</span>
        </SettingsCompactActionButton>
        <SettingsCompactActionButton
          className="w-full justify-start"
          disabled={profiles.length <= 1 || pendingActionLabel != null}
          onClick={() => {
            setSelectedProfileId(profile.id);
            void handleDeleteProfile(profile);
          }}
        >
          <Trash2 size={11} />
          <span>Delete</span>
        </SettingsCompactActionButton>
      </div>
    </SettingsOverflowMenu>
  );

  const renderProfileActions = (profile: UsrProfileSummary) => {
    const isActive = profile.isActive;
    return (
      <div className="flex shrink-0 items-center gap-1">
        <SettingsIconActionButton
          active={isActive}
          accent={accent}
          disabled={isActive || pendingActionLabel != null}
          aria-label={isActive ? 'Current' : 'Switch'}
          title={isActive ? 'Current Profile' : `Switch To ${profile.name}`}
          onClick={() => {
            setSelectedProfileId(profile.id);
            void runProfileAction('Switching profile…', () =>
              onSwitchUsrProfile(profile.id),
            );
          }}
        >
          <Layers3 size={12} />
        </SettingsIconActionButton>
        <SettingsIconActionButton
          disabled={pendingActionLabel != null}
          aria-label={`Open ${profile.name} Folder`}
          title={`Open ${profile.name} Folder`}
          onClick={() => {
            setSelectedProfileId(profile.id);
            void runProfileAction('Opening profile folder…', () =>
              onOpenUsrProfileFolder(profile.id),
            );
          }}
        >
          <FolderOpen size={12} />
        </SettingsIconActionButton>
        {renderProfileOverflowMenu(profile)}
      </div>
    );
  };

  return (
    <SettingsSectionScaffold
      sectionKey="profiles"
      icon={<Layers3 size={12} />}
      title="Profiles"
      subtitle={detail}
      badges={
        activeProfile
          ? [
              pluralize(profiles.length, 'profile'),
              pluralize(activeProfile.overrideSlices.length, 'override slice'),
            ]
          : undefined
      }
      actions={(
        <SettingsIconActionButton
          onClick={() =>
            void runProfileAction('Opening profiles root…', onOpenUsrProfilesRootFolder)
          }
          disabled={pendingActionLabel != null}
          aria-label="Open Profiles Root"
          title="Open Profiles Root"
        >
          <FolderOpen size={12} />
        </SettingsIconActionButton>
      )}
    >
      <SettingsMetricStrip
        items={[
          {
            id: 'profiles',
            label: 'Profiles',
            value: profiles.length,
          },
          {
            id: 'active',
            label: 'Active',
            value: activeProfile?.name ?? 'none',
            tone: activeProfile ? 'accent' : 'default',
          },
          {
            id: 'overrides',
            label: 'Overrides',
            value: activeProfile?.overrideSlices.length ?? 0,
          },
          {
            id: 'lanes',
            label: 'Lanes',
            value: managedContentStacks.length,
          },
        ]}
      />

      {pendingActionLabel ? (
        <SettingsInlineNotice tone="info">
          <span className="inline-flex min-w-0 items-center gap-2">
            <RefreshCw size={11} className="animate-spin" />
            <span className="truncate">{pendingActionLabel}</span>
          </span>
        </SettingsInlineNotice>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-2.5 xl:grid-cols-[minmax(0,1.18fr)_minmax(300px,0.82fr)]">
        <div className="min-w-0 space-y-2.5">
          <SettingsCompactSection title="Create" subtitle="Current state or variant seed">
            <SettingsControlRow
              label="Current"
              detail={activeProfile?.name ?? 'runtime state'}
              control={(
                <span className="block truncate text-[11px] opacity-70">
                  {activeProfile?.settingsPath ?? 'No active profile'}
                </span>
              )}
              action={(
                <SettingsCompactActionButton
                  accent={accent}
                  disabled={pendingActionLabel != null}
                  aria-label="Create From Current"
                  onClick={() => void handleCreateProfile()}
                >
                  <Plus size={11} />
                  <span>Create Profile</span>
                </SettingsCompactActionButton>
              )}
            />
            {usrProfileSettingsVariants.length > 0 ? (
              <div data-settings-catalog-card={selectedVariant?.name ?? 'Canonical Variation'}>
                <SettingsControlRow
                  label="Variant"
                  detail={selectedVariant?.tags.join(' · ') || selectedVariant?.id}
                  control={(
                    <SettingsSelect
                      aria-label="Profile Variant"
                      className="w-full"
                      value={selectedVariant?.id ?? ''}
                      onChange={(event) => setSelectedVariantId(event.target.value)}
                    >
                      {usrProfileSettingsVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name}
                        </option>
                      ))}
                    </SettingsSelect>
                  )}
                  action={(
                    <SettingsCompactActionButton
                      accent={accent}
                      disabled={selectedVariant == null || pendingActionLabel != null}
                      aria-label="Create Profile"
                      onClick={() => void handleCreateSelectedVariantProfile()}
                    >
                      <Plus size={11} />
                      <span>Create Profile</span>
                    </SettingsCompactActionButton>
                  )}
                />
              </div>
            ) : null}
          </SettingsCompactSection>

          <SettingsCompactSection
            title="Profile Catalog"
            subtitle={pluralize(profiles.length, 'profile')}
            className="overflow-visible"
          >
            {profiles.length === 0 ? (
              <SettingsInlineNotice tone="muted">
                No usr profiles are available yet.
              </SettingsInlineNotice>
            ) : (
              profiles.map((profile) => {
                const isActive = profile.isActive;
                const isSelected = selectedProfile?.id === profile.id;
                return (
                  <div key={profile.id} data-settings-catalog-card={profile.name}>
                    <SettingsKeyValueRow
                      label={(
                        <button
                          type="button"
                          className="block min-w-0 text-left normal-case"
                          style={{ color: isSelected ? accent : undefined }}
                          onClick={() => setSelectedProfileId(profile.id)}
                        >
                          <span className="block truncate text-[11px] font-semibold">
                            {profile.name}
                          </span>
                          <span className="block truncate text-[9px] opacity-50">
                            {profile.id}
                          </span>
                        </button>
                      )}
                      value={(
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex min-w-0 items-center gap-1.5 text-[10px]">
                            {isActive ? (
                              <SettingsStatusPill active style={{ color: accent }}>
                                Active
                              </SettingsStatusPill>
                            ) : null}
                            <span className="truncate opacity-65">
                              {pluralize(profile.overrideSlices.length, 'slice')}
                            </span>
                            <span className="truncate opacity-45">
                              {formatProfileTimestamp(profile.updatedAtMs)}
                            </span>
                          </div>
                          <SettingsCompactPath
                            value={profile.directoryPath}
                            title={profile.directoryPath}
                          />
                        </div>
                      )}
                      action={renderProfileActions(profile)}
                    />
                  </div>
                );
              })
            )}
          </SettingsCompactSection>

          {selectedProfile ? (
            <SettingsCompactSection
              title="Selected Profile"
              subtitle={selectedProfile.name}
              actions={renderProfileActions(selectedProfile)}
              className="overflow-visible"
            >
              <SettingsKeyValueRow
                label="Profile:"
                value={selectedProfile.name}
              />
              <SettingsKeyValueRow
                label="Directory:"
                value={(
                  <SettingsCompactPath
                    value={selectedProfile.directoryPath}
                    title={selectedProfile.directoryPath}
                  />
                )}
                action={(
                  <SettingsIconActionButton
                    disabled={pendingActionLabel != null}
                    aria-label="Open Selected Profile Folder"
                    title="Open Selected Profile Folder"
                    onClick={() =>
                      void runProfileAction('Opening profile folder…', () =>
                        onOpenUsrProfileFolder(selectedProfile.id),
                      )
                    }
                  >
                    <FolderOpen size={12} />
                  </SettingsIconActionButton>
                )}
              />
              <SettingsKeyValueRow
                label="Settings:"
                value={(
                  <SettingsCompactPath
                    value={selectedProfile.settingsPath}
                    title={selectedProfile.settingsPath}
                  />
                )}
              />
              <SettingsKeyValueRow
                label="Updated:"
                value={formatProfileTimestamp(selectedProfile.updatedAtMs)}
              />
            </SettingsCompactSection>
          ) : null}
        </div>

        <div className="min-w-0 space-y-2.5">
          <SettingsCompactSection
            title="Shared Root Slices"
            subtitle={`${usrProfileSettingSliceKeys.length} overlay / ${usrProfileSharedSettingSliceKeys.length} shared`}
          >
            <SettingsKeyValueRow
              label="Shared Root:"
              value={(
                <div className="flex min-w-0 flex-wrap gap-1">
                  {usrProfileSharedSettingSliceKeys.map((sliceKey) => (
                    <SettingsStatusPill key={sliceKey}>{sliceKey}</SettingsStatusPill>
                  ))}
                </div>
              )}
            />
            <SettingsKeyValueRow
              label="Profile Overlay:"
              value={(
                <div className="flex min-w-0 flex-wrap gap-1">
                  {usrProfileSettingSliceKeys.map((sliceKey) => {
                    const overridden = activeProfileOverrideSliceSet.has(sliceKey);
                    return (
                      <SettingsStatusPill
                        key={sliceKey}
                        active={overridden}
                        style={overridden ? { color: accent } : undefined}
                      >
                        {sliceKey} · {overridden ? 'overridden' : 'inherited'}
                      </SettingsStatusPill>
                    );
                  })}
                </div>
              )}
            />
          </SettingsCompactSection>

          {usrProfileRuntimeSnapshot ? (
            <SettingsCompactSection
              title="Runtime Paths"
              subtitle="Profiles root and active settings files"
              actions={(
                <>
                  <SettingsIconActionButton
                    disabled={pendingActionLabel != null}
                    aria-label="Open Profiles Root"
                    title="Open Profiles Root"
                    onClick={() =>
                      void runProfileAction('Opening profiles root…', onOpenUsrProfilesRootFolder)
                    }
                  >
                    <FolderOpen size={12} />
                  </SettingsIconActionButton>
                  {activeProfile ? (
                    <SettingsIconActionButton
                      disabled={pendingActionLabel != null}
                      aria-label="Open Active Profile"
                      title="Open Active Profile"
                      onClick={() =>
                        void runProfileAction('Opening active profile…', () =>
                          onOpenUsrProfileFolder(activeProfile.id),
                        )
                      }
                    >
                      <Layers3 size={12} />
                    </SettingsIconActionButton>
                  ) : null}
                </>
              )}
            >
              <SettingsKeyValueRow
                label="Profiles Root:"
                value={(
                  <SettingsCompactPath
                    value={usrProfileRuntimeSnapshot.profilesRoot}
                    title={usrProfileRuntimeSnapshot.profilesRoot}
                  />
                )}
              />
              <SettingsKeyValueRow
                label="Shared Settings:"
                value={(
                  <SettingsCompactPath
                    value={usrProfileRuntimeSnapshot.sharedSettingsPath}
                    title={usrProfileRuntimeSnapshot.sharedSettingsPath}
                  />
                )}
              />
              <SettingsKeyValueRow
                label="Active Overlay:"
                value={(
                  <SettingsCompactPath
                    value={usrProfileRuntimeSnapshot.activeProfileSettingsPath}
                    title={usrProfileRuntimeSnapshot.activeProfileSettingsPath}
                  />
                )}
              />
            </SettingsCompactSection>
          ) : null}

          {managedContentStacks.length > 0 ? (
            <SettingsCompactSection
              title="Effective Lane Stack"
              subtitle={pluralize(managedContentStacks.length, 'lane')}
            >
              {managedContentStacks.map((stack) => (
                <div
                  key={stack.laneId}
                  className="border-t first:border-t-0"
                  style={{ borderColor: 'var(--overlay-workbench-settings-card-border)' }}
                >
                  <SettingsKeyValueRow
                    label={(
                      <span className="normal-case">{stack.laneId}</span>
                    )}
                    value={(
                      <div className="flex min-w-0 items-center gap-1.5">
                        <SettingsStatusPill active={stack.profileMode === 'profile-overlay'}>
                          {stack.profileMode}
                        </SettingsStatusPill>
                        <span className="truncate opacity-55">
                          {pluralize(stack.directories.length, 'source')}
                        </span>
                      </div>
                    )}
                  />
                  <SettingsKeyValueRow
                    label="Baseline:"
                    value={(
                      <SettingsCompactPath
                        value={stack.baselineDirectory}
                        title={stack.baselineDirectory}
                      />
                    )}
                  />
                  <SettingsKeyValueRow
                    label="Writable:"
                    value={(
                      <SettingsCompactPath
                        value={stack.writableDirectory}
                        title={stack.writableDirectory}
                      />
                    )}
                  />
                  {stack.directories.map((directory, index) => {
                    const sourceBadges = buildManagedContentDirectorySourceBadges(
                      stack,
                      directory,
                    );
                    return (
                      <SettingsKeyValueRow
                        key={`${stack.laneId}:${directory}:${index}`}
                        label={`Source ${index + 1}:`}
                        value={(
                          <div className="flex min-w-0 items-center gap-1.5">
                            <div className="flex shrink-0 flex-wrap gap-1">
                              {sourceBadges.map((sourceBadge) => (
                                <SettingsStatusPill
                                  key={`${stack.laneId}:${directory}:${sourceBadge}`}
                                  active={sourceBadge === 'baseline' || sourceBadge === 'active-profile'}
                                >
                                  {sourceBadge}
                                </SettingsStatusPill>
                              ))}
                            </div>
                            <SettingsCompactPath value={directory} title={directory} />
                          </div>
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </SettingsCompactSection>
          ) : null}
        </div>
      </div>
    </SettingsSectionScaffold>
  );
}
