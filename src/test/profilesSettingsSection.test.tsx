import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProfilesSettingsSection } from '../components/settings/sections/ProfilesSettingsSection';

describe('ProfilesSettingsSection', () => {
  it('explains usr shared-root and profile-overlay lane resolution', () => {
    render(
      <ProfilesSettingsSection
        detail="Shared-root usr plus profile-local overlays."
        accent="#7c3aed"
        usrProfileRuntimeSnapshot={{
          activeProfileId: 'default',
          profilesRoot: 'C:\\Dev\\GreebleFS\\usr\\profiles',
          sharedSettingsPath: 'C:\\Dev\\GreebleFS\\usr\\profiles\\shared\\settings.json',
          sharedSettingsJson: '{}',
          activeProfileSettingsPath: 'C:\\Dev\\GreebleFS\\usr\\profiles\\default\\settings.json',
          activeProfileSettingsJson: '{}',
          effectiveSettingsJson: '{}',
          profiles: [
            {
              id: 'default',
              name: 'Default',
              overrideSlices: ['explorer'],
              createdAtMs: 1,
              updatedAtMs: 2,
              directoryPath: 'C:\\Dev\\GreebleFS\\usr\\profiles\\default',
              settingsPath: 'C:\\Dev\\GreebleFS\\usr\\profiles\\default\\settings.json',
              isActive: true,
            },
          ],
          managedContentDirectoryStacks: [
            {
              laneId: 'themes',
              profileMode: 'profile-overlay',
              directories: [
                'C:\\Dev\\GreebleFS\\usr\\profiles\\default\\themes',
                'C:\\Dev\\GreebleFS\\usr\\themes',
                'C:\\Dev\\GreebleFS\\themes',
              ],
              sharedRootDirectory: 'C:\\Dev\\GreebleFS\\usr\\themes',
              bundledDirectory: 'C:\\Dev\\GreebleFS\\themes',
              profileDirectory: 'C:\\Dev\\GreebleFS\\usr\\profiles\\default\\themes',
              writableDirectory: 'C:\\Dev\\GreebleFS\\usr\\profiles\\default\\themes',
            },
          ],
        }}
        usrProfileSettingSliceKeys={['explorer']}
        usrProfileSharedSettingSliceKeys={['python']}
        usrProfileSettingsVariants={[]}
        onSwitchUsrProfile={vi.fn()}
        onCreateUsrProfile={vi.fn()}
        onCreateUsrProfileFromVariant={vi.fn()}
        onDuplicateUsrProfile={vi.fn()}
        onRenameUsrProfile={vi.fn()}
        onDeleteUsrProfile={vi.fn()}
        onOpenUsrProfilesRootFolder={vi.fn()}
        onOpenUsrProfileFolder={vi.fn()}
      />,
    );

    expect(screen.getByText('Effective Lane Stack')).toBeInTheDocument();
    expect(screen.getAllByText('profile-overlay').length).toBeGreaterThan(0);
    expect(screen.getAllByText('shared-root').length).toBeGreaterThan(0);
    expect(screen.getByText('bundled-default')).toBeInTheDocument();
    expect(screen.getByText(/Writable:/)).toBeInTheDocument();
  });

  it('creates a profile from a named canonical variation', async () => {
    const user = userEvent.setup();
    const createFromVariant = vi.fn(async () => {});
    const promptMock = vi.spyOn(window, 'prompt').mockImplementation(() => 'Quiet Review');

    try {
      render(
        <ProfilesSettingsSection
          detail="Shared-root usr plus profile-local overlays."
          accent="#7c3aed"
          usrProfileRuntimeSnapshot={null}
          usrProfileSettingSliceKeys={['explorer']}
          usrProfileSharedSettingSliceKeys={['python']}
          usrProfileSettingsVariants={[
            {
              id: 'minimal-low-motion',
              name: 'Minimal Low Motion',
              description: 'Reduced shell motion and sound.',
              tags: ['quiet', 'accessibility'],
              sharedSettings: {},
              profileSettings: {},
            },
          ]}
          onSwitchUsrProfile={vi.fn()}
          onCreateUsrProfile={vi.fn()}
          onCreateUsrProfileFromVariant={createFromVariant}
          onDuplicateUsrProfile={vi.fn()}
          onRenameUsrProfile={vi.fn()}
          onDeleteUsrProfile={vi.fn()}
          onOpenUsrProfilesRootFolder={vi.fn()}
          onOpenUsrProfileFolder={vi.fn()}
        />,
      );

      const variantCard = screen.getByText('Minimal Low Motion').closest('[data-settings-catalog-card]');
      expect(variantCard).not.toBeNull();

      await user.click(
        within(variantCard as HTMLElement).getByRole('button', { name: /create profile/i }),
      );

      expect(createFromVariant).toHaveBeenCalledWith(
        'minimal-low-motion',
        'Quiet Review',
      );
    } finally {
      promptMock.mockRestore();
    }
  });
});
