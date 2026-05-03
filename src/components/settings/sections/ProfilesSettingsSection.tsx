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
import type { UsrProfileRuntimeSnapshot } from '../../../runtime/usrProfiles';
import {
  SettingsActionButton,
  SettingsActionStrip,
  SettingsCatalogCard,
  SettingsCatalogGrid,
  SettingsInspectorPanel,
  SettingsSectionBlock,
  SettingsSectionHeader,
  SettingsStatusPill,
} from '../SettingsPrimitives';

export function ProfilesSettingsSection({
  detail,
  accent,
  usrProfileRuntimeSnapshot,
  usrProfileSettingSliceKeys,
  usrProfileSharedSettingSliceKeys,
  onSwitchUsrProfile,
  onCreateUsrProfile,
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
  onSwitchUsrProfile: (profileId: string) => Promise<void> | void;
  onCreateUsrProfile: (name: string) => Promise<void> | void;
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
  const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(null);
  const selectedProfile =
    profiles.find((profile) => profile.id === selectedProfileId) ?? activeProfile;

  useEffect(() => {
    if (selectedProfileId && profiles.some((profile) => profile.id === selectedProfileId)) {
      return;
    }
    setSelectedProfileId(activeProfile?.id ?? null);
  }, [activeProfile?.id, profiles, selectedProfileId]);

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

  const handleDuplicateProfile = async () => {
    if (!selectedProfile) {
      return;
    }
    const name = promptForProfileName(
      `Duplicate ${selectedProfile.name}`,
      `${selectedProfile.name} Copy`,
    );
    if (!name) {
      return;
    }
    await runProfileAction('Duplicating profile…', () =>
      onDuplicateUsrProfile(selectedProfile.id, name),
    );
  };

  const handleRenameProfile = async () => {
    if (!selectedProfile) {
      return;
    }
    const name = promptForProfileName(
      `Rename ${selectedProfile.name}`,
      selectedProfile.name,
    );
    if (!name || name === selectedProfile.name) {
      return;
    }
    await runProfileAction('Renaming profile…', () =>
      onRenameUsrProfile(selectedProfile.id, name),
    );
  };

  const handleDeleteProfile = async () => {
    if (!selectedProfile) {
      return;
    }
    const confirmed = window.confirm(
      `Delete profile "${selectedProfile.name}"? Shared usr content stays intact, but this profile folder will be removed.`,
    );
    if (!confirmed) {
      return;
    }
    await runProfileAction('Deleting profile…', () =>
      onDeleteUsrProfile(selectedProfile.id),
    );
  };

  return (
    <section className="space-y-4" data-settings-section="profiles">
      <SettingsSectionHeader
        icon={<Layers3 size={12} />}
        title="Profiles"
        subtitle={detail}
        badges={
          activeProfile
            ? [
                `${profiles.length} profile${profiles.length === 1 ? '' : 's'}`,
                `${activeProfile.overrideSlices.length} override slice${
                  activeProfile.overrideSlices.length === 1 ? '' : 's'
                }`,
              ]
            : undefined
        }
        actions={
          <SettingsActionStrip>
            <SettingsActionButton
              accent={accent}
              onClick={() => void handleCreateProfile()}
              disabled={pendingActionLabel != null}
            >
              <Plus size={11} />
              <span>Create From Current</span>
            </SettingsActionButton>
            <SettingsActionButton
              onClick={() => void runProfileAction('Opening profiles root…', onOpenUsrProfilesRootFolder)}
              disabled={pendingActionLabel != null}
            >
              <FolderOpen size={11} />
              <span>Open Profiles Root</span>
            </SettingsActionButton>
          </SettingsActionStrip>
        }
      />

      {pendingActionLabel ? (
        <SettingsSectionBlock tone="accent" accent={accent}>
          <div className="flex items-center gap-2 text-[11px]">
            <RefreshCw size={11} className="animate-spin" />
            <span>{pendingActionLabel}</span>
          </div>
        </SettingsSectionBlock>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <SettingsSectionBlock
          title="Profile Catalog"
          subtitle="Each profile overlays workbench-facing usr lanes and settings slices on top of the shared root."
          accent={accent}
        >
          <SettingsCatalogGrid className="md:grid-cols-2">
            {profiles.map((profile) => {
              const isActive = profile.isActive;
              const isSelected = selectedProfile?.id === profile.id;
              return (
                <SettingsCatalogCard
                  key={profile.id}
                  active={isSelected}
                  accent={accent}
                  onClick={() => setSelectedProfileId(profile.id)}
                  title={profile.name}
                  subtitle={profile.id}
                  badges={
                    <div className="flex flex-wrap gap-1">
                      {isActive ? (
                        <SettingsStatusPill active style={{ color: accent }}>
                          Active
                        </SettingsStatusPill>
                      ) : null}
                      <SettingsStatusPill>
                        {profile.overrideSlices.length} slice
                        {profile.overrideSlices.length === 1 ? '' : 's'}
                      </SettingsStatusPill>
                    </div>
                  }
                  description={profile.settingsPath}
                  metadata={
                    <div className="space-y-1 text-[10px] opacity-60">
                      <div>{new Date(profile.updatedAtMs).toLocaleString()}</div>
                      <div>{profile.directoryPath}</div>
                    </div>
                  }
                  footer={
                    <div className="flex flex-wrap gap-2">
                      <SettingsActionButton
                        active={isActive}
                        accent={accent}
                        disabled={isActive || pendingActionLabel != null}
                        onClick={() =>
                          void runProfileAction('Switching profile…', () =>
                            onSwitchUsrProfile(profile.id),
                          )
                        }
                      >
                        <Layers3 size={11} />
                        <span>{isActive ? 'Current' : 'Switch'}</span>
                      </SettingsActionButton>
                      <SettingsActionButton
                        disabled={pendingActionLabel != null}
                        onClick={() =>
                          void runProfileAction('Opening profile folder…', () =>
                            onOpenUsrProfileFolder(profile.id),
                          )
                        }
                      >
                        <FolderOpen size={11} />
                        <span>Open Folder</span>
                      </SettingsActionButton>
                    </div>
                  }
                />
              );
            })}
          </SettingsCatalogGrid>
        </SettingsSectionBlock>

        <div className="space-y-4">
          <SettingsInspectorPanel
            title={selectedProfile ? selectedProfile.name : 'No Profile Selected'}
            subtitle={
              selectedProfile
                ? `Profile-owned settings live at ${selectedProfile.settingsPath}`
                : 'Select a profile to inspect its override slices and folder targets.'
            }
            badges={
              selectedProfile
                ? [
                    selectedProfile.isActive ? 'Active' : 'Inactive',
                    `${selectedProfile.overrideSlices.length} override slice${
                      selectedProfile.overrideSlices.length === 1 ? '' : 's'
                    }`,
                  ]
                : undefined
            }
            tone="accent"
            accent={accent}
          >
            {selectedProfile ? (
              <div className="space-y-4">
                <SettingsActionStrip>
                  <SettingsActionButton
                    active={selectedProfile.isActive}
                    accent={accent}
                    disabled={selectedProfile.isActive || pendingActionLabel != null}
                    onClick={() =>
                      void runProfileAction('Switching profile…', () =>
                        onSwitchUsrProfile(selectedProfile.id),
                      )
                    }
                  >
                    <Layers3 size={11} />
                    <span>
                      {selectedProfile.isActive ? 'Active Profile' : 'Switch To Profile'}
                    </span>
                  </SettingsActionButton>
                  <SettingsActionButton
                    disabled={pendingActionLabel != null}
                    onClick={() =>
                      void runProfileAction('Opening profile folder…', () =>
                        onOpenUsrProfileFolder(selectedProfile.id),
                      )
                    }
                  >
                    <FolderOpen size={11} />
                    <span>Open Profile Folder</span>
                  </SettingsActionButton>
                  <SettingsActionButton
                    disabled={pendingActionLabel != null}
                    onClick={() => void handleDuplicateProfile()}
                  >
                    <Copy size={11} />
                    <span>Duplicate</span>
                  </SettingsActionButton>
                  <SettingsActionButton
                    disabled={pendingActionLabel != null}
                    onClick={() => void handleRenameProfile()}
                  >
                    <Pencil size={11} />
                    <span>Rename</span>
                  </SettingsActionButton>
                  <SettingsActionButton
                    disabled={profiles.length <= 1 || pendingActionLabel != null}
                    onClick={() => void handleDeleteProfile()}
                  >
                    <Trash2 size={11} />
                    <span>Delete</span>
                  </SettingsActionButton>
                </SettingsActionStrip>

                <div className="space-y-2 text-[11px] opacity-70">
                  <div>{selectedProfile.directoryPath}</div>
                  <div>{selectedProfile.settingsPath}</div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] opacity-55">
                No usr profiles are available yet.
              </div>
            )}
          </SettingsInspectorPanel>

          <SettingsInspectorPanel
            title="Shared Root Slices"
            subtitle={`These ${usrProfileSharedSettingSliceKeys.length} settings slices stay global across every profile.`}
            badges={['shared-root']}
          >
            <div className="flex flex-wrap gap-2">
              {usrProfileSharedSettingSliceKeys.map((sliceKey) => (
                <SettingsStatusPill key={sliceKey}>{sliceKey}</SettingsStatusPill>
              ))}
            </div>
          </SettingsInspectorPanel>

          <SettingsInspectorPanel
            title="Active Profile Ownership"
            subtitle="Workbench-facing slices can stay inherited or be explicitly overridden by the selected profile."
            badges={['profile-overlay']}
          >
            <div className="flex flex-wrap gap-2">
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
          </SettingsInspectorPanel>

          {usrProfileRuntimeSnapshot ? (
            <SettingsInspectorPanel
              title="Runtime Paths"
              subtitle="The active profile overlay writes into its own lane folders while shared settings stay rooted under the shared usr profile workspace."
              badges={['runtime']}
              actions={
                <SettingsActionStrip>
                  <SettingsActionButton
                    disabled={pendingActionLabel != null}
                    onClick={() =>
                      void runProfileAction('Opening profiles root…', onOpenUsrProfilesRootFolder)
                    }
                  >
                    <FolderOpen size={11} />
                    <span>Profiles Root</span>
                  </SettingsActionButton>
                  {activeProfile ? (
                    <SettingsActionButton
                      disabled={pendingActionLabel != null}
                      onClick={() =>
                        void runProfileAction('Opening active profile…', () =>
                          onOpenUsrProfileFolder(activeProfile.id),
                        )
                      }
                    >
                      <FolderOpen size={11} />
                      <span>Active Overlay</span>
                    </SettingsActionButton>
                  ) : null}
                </SettingsActionStrip>
              }
            >
              <div className="space-y-2 text-[11px] opacity-65">
                <div className="min-w-0 break-all">
                  <span className="font-semibold opacity-80">Profiles root: </span>
                  {usrProfileRuntimeSnapshot.profilesRoot}
                </div>
                <div className="min-w-0 break-all">
                  <span className="font-semibold opacity-80">Shared settings: </span>
                  {usrProfileRuntimeSnapshot.sharedSettingsPath}
                </div>
                <div className="min-w-0 break-all">
                  <span className="font-semibold opacity-80">Active overlay: </span>
                  {usrProfileRuntimeSnapshot.activeProfileSettingsPath}
                </div>
              </div>
            </SettingsInspectorPanel>
          ) : null}

          {managedContentStacks.length > 0 ? (
            <SettingsInspectorPanel
              title="Effective Lane Stack"
              subtitle="Lane content resolves from profile overlay, shared root, then bundled defaults. Writes go to the declared writable directory."
              badges={[`${managedContentStacks.length} lanes`, 'stack order']}
            >
              <div className="space-y-3">
                {managedContentStacks.map((stack) => (
                  <div
                    key={stack.laneId}
                    className="min-w-0 rounded border p-3 text-[11px]"
                    style={{
                      borderColor: 'var(--overlay-workbench-settings-card-border)',
                      background: 'var(--overlay-workbench-settings-card-bg)',
                    }}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-semibold">{stack.laneId}</span>
                      <SettingsStatusPill active={stack.profileMode === 'profile-overlay'}>
                        {stack.profileMode}
                      </SettingsStatusPill>
                    </div>
                    <div className="mt-2 min-w-0 break-all opacity-65">
                      <span className="font-semibold opacity-80">Writable: </span>
                      {stack.writableDirectory}
                    </div>
                    <div className="mt-3 space-y-2">
                      {stack.directories.map((directory, index) => {
                        const sourceLabel =
                          directory === stack.profileDirectory
                            ? 'profile-overlay'
                            : directory === stack.sharedRootDirectory
                              ? 'shared-root'
                              : directory === stack.bundledDirectory
                                ? 'bundled-default'
                                : 'effective-source';
                        return (
                          <div
                            key={`${stack.laneId}:${directory}:${index}`}
                            className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-2"
                          >
                            <SettingsStatusPill>{index + 1}</SettingsStatusPill>
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-55">
                                {sourceLabel}
                              </div>
                              <div className="min-w-0 break-all opacity-70">{directory}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SettingsInspectorPanel>
          ) : null}
        </div>
      </div>
    </section>
  );
}
