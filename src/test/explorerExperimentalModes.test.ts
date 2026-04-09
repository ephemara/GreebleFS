import { describe, expect, it } from 'vitest';
import {
  getExplorerExperimentalDensityDescriptor,
  getExplorerExperimentalModeDefinition,
} from '../config/explorerExperimentalModes';

describe('explorerExperimentalModes', () => {
  it('marks shipped experimental modes as available', () => {
    expect(getExplorerExperimentalModeDefinition('adaptive-semantic-grid').available).toBe(true);
    expect(getExplorerExperimentalModeDefinition('constellation').available).toBe(true);
    expect(getExplorerExperimentalModeDefinition('timeline-surface').available).toBe(true);
  });

  it('exposes mode-specific density descriptors', () => {
    expect(getExplorerExperimentalDensityDescriptor('adaptive-semantic-grid', 0.6).label).toBe('Rich Cards');
    expect(getExplorerExperimentalDensityDescriptor('constellation', 0.8).label).toBe('Web');
    expect(getExplorerExperimentalDensityDescriptor('timeline-surface', 1).label).toBe('Days');
  });
});
