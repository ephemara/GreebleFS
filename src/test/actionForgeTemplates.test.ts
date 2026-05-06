import { describe, expect, it } from 'vitest';

import {
  buildActionBlueprint,
  createDefaultActionForgeDraft,
  resolveActionsRoot,
  type ActionForgeDraft,
  type ActionPackSummary,
} from '../../usr/plugins/greeblefs-action-forge/templates';

const ACTIONS_ROOT = 'D:\\GreebleFS\\usr\\actions';
const PLUGIN_DIRECTORY = 'D:\\GreebleFS\\usr\\plugins\\greeblefs-action-forge';

function createExistingPackSummary(): ActionPackSummary {
  return {
    id: 'studio-pack',
    name: 'Studio Pack',
    path: `${ACTIONS_ROOT}\\studio-pack`,
    manifestPath: `${ACTIONS_ROOT}\\studio-pack\\action-pack.toml`,
    readmePath: `${ACTIONS_ROOT}\\studio-pack\\README.md`,
    actionsPath: `${ACTIONS_ROOT}\\studio-pack\\actions`,
    actionCount: 4,
    hasManifest: true,
    hasReadme: true,
    description: 'Existing action pack.',
  };
}

function createDraft(overrides: Partial<ActionForgeDraft> = {}): ActionForgeDraft {
  return {
    ...createDefaultActionForgeDraft(),
    ...overrides,
  };
}

describe('Action Forge templates', () => {
  it('resolves the usr/actions root from the plugin directory', () => {
    expect(resolveActionsRoot(PLUGIN_DIRECTORY)).toBe(ACTIONS_ROOT);
  });

  it('builds a full new-pack scaffold for a script action', () => {
    const blueprint = buildActionBlueprint({
      actionsRoot: ACTIONS_ROOT,
      draft: createDefaultActionForgeDraft(),
      selectedPack: null,
    });

    expect(blueprint.packId).toBe('custom-actions-pack');
    expect(blueprint.actionId).toBe('selection-snapshot');
    expect(blueprint.issues).toEqual([]);
    expect(blueprint.files.map((file) => file.label)).toEqual([
      'Pack Manifest',
      'Pack README',
      'PS1 Script',
      'Action Manifest',
    ]);
    expect(blueprint.files[2]?.path).toBe(
      'D:\\GreebleFS\\usr\\actions\\custom-actions-pack\\actions\\selection-snapshot\\powershell\\selection-snapshot.ps1',
    );
    expect(blueprint.files[3]?.content).toContain('runner = "interpreter"');
    expect(blueprint.files[3]?.content).toContain('entry = "powershell/selection-snapshot.ps1"');
  });

  it('emits only an action manifest for workflow actions in an existing pack', () => {
    const draft = createDraft({
      packMode: 'existing',
      selectedPackId: 'studio-pack',
      actionName: 'Workflow Bridge',
      actionId: 'workflow-bridge',
      mode: 'workflow',
      workflowId: 'studio.workflow-bridge',
      workflowPayloadText: '{\n  "source": "action-forge",\n  "variant": "workflow"\n}',
    });

    const blueprint = buildActionBlueprint({
      actionsRoot: ACTIONS_ROOT,
      draft,
      selectedPack: createExistingPackSummary(),
    });

    expect(blueprint.issues).toEqual([]);
    expect(blueprint.files.map((file) => file.label)).toEqual(['Action Manifest']);
    expect(blueprint.files[0]?.content).toContain('kind = "workflow"');
    expect(blueprint.files[0]?.content).toContain('workflowId = "studio.workflow-bridge"');
    expect(blueprint.files[0]?.content).not.toContain('[execution]');
  });
});
