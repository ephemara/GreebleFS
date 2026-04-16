import {
  transpileRuntimeModuleGraph,
  transpileRuntimeModuleSource,
} from '../runtime/moduleRuntime';
import {
  readFrontendWorkerTelemetrySnapshot,
  resetFrontendWorkerTelemetryForTests,
} from '../runtime/workerHost';

describe('moduleRuntime worker bridge', () => {
  beforeEach(() => {
    resetFrontendWorkerTelemetryForTests();
  });

  it('transpiles runtime module source through the worker bridge fallback path', async () => {
    const output = await transpileRuntimeModuleSource(
      'export default function Example() { return <div>ok</div>; }',
      'const React = require("react");\n',
    );

    expect(output).toContain('const React = require("react");');
    expect(output).toContain('exports.default');

    const telemetry = readFrontendWorkerTelemetrySnapshot();
    expect(telemetry.lanes['runtime-module'].fallbackCount).toBeGreaterThan(0);
  });

  it('transpiles runtime module graphs while preserving relative module resolutions', async () => {
    const graph = await transpileRuntimeModuleGraph({
      entryModulePath: '/virtual/entry.tsx',
      entrySource: 'import helper from "./helper"; export default helper;',
      prependCode: 'const React = require("react");\n',
      resolveRelativeModuleSource: async ({ specifier }) => {
        if (specifier === './helper') {
          return {
            modulePath: '/virtual/helper.ts',
            source: 'export default function helper() { return "ok"; }',
          };
        }
        return null;
      },
    });

    expect(graph.entryModulePath).toBe('/virtual/entry.tsx');
    expect(graph.moduleCodeByPath['/virtual/entry.tsx']).toContain('require("./helper")');
    expect(graph.relativeSpecifierResolutionsByModulePath['/virtual/entry.tsx']?.['./helper']).toBe('/virtual/helper.ts');

    const telemetry = readFrontendWorkerTelemetrySnapshot();
    expect(telemetry.lanes['runtime-module'].fallbackCount).toBeGreaterThan(0);
  });
});
