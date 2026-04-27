/**
 * Action catalog for the explorer `.go` workbench.
 *
 * The explorer preview lane composes these descriptors so context-menu and
 * preview-header actions on `.go` / `go.mod` / `go.sum` files (Run / Test /
 * Build / Fmt / Open REPL-like task console) route through the universal
 * runtime pipeline instead of shelling out from React.
 *
 * Each action is intentionally a thin wrapper over `goRuntimeBackend` so the
 * explorer surface only knows action ids and labels — execution semantics
 * stay in the shared backend layer.
 */

import type { ExternalRuntimeCommandResult } from './externalRuntimeBackend';
import { runGoCommand } from './goRuntimeBackend';

export type GoWorkbenchActionId =
  | 'go.run'
  | 'go.test'
  | 'go.build'
  | 'go.fmt'
  | 'go.openTaskConsole';

export interface GoWorkbenchAction {
  id: GoWorkbenchActionId;
  label: string;
  description: string;
  /**
   * Default arguments that the explorer surface forwards to the registered
   * Go runtime. The runtime is expected to be a `native-command` package
   * authored under `src-go/` or `runtimes/` that handles `go run`, `go test`,
   * `go build`, and `gofmt -l` flows.
   */
  defaultArgs: readonly string[];
}

/**
 * Canonical Go workbench actions. Surfaces should iterate this array rather
 * than inventing their own action shapes so the explorer keeps one source
 * of truth for menu/header copy and shortcut hints.
 */
export const goWorkbenchActions: readonly GoWorkbenchAction[] = [
  {
    id: 'go.run',
    label: 'Run',
    description: 'Run the Go module under the cursor.',
    defaultArgs: ['run'],
  },
  {
    id: 'go.test',
    label: 'Test',
    description: 'Run `go test` for the active module.',
    defaultArgs: ['test'],
  },
  {
    id: 'go.build',
    label: 'Build',
    description: 'Compile the active Go module.',
    defaultArgs: ['build'],
  },
  {
    id: 'go.fmt',
    label: 'Fmt',
    description: 'Run `gofmt -l` against the active module.',
    defaultArgs: ['fmt'],
  },
  {
    id: 'go.openTaskConsole',
    label: 'Open Task Console',
    description: 'Drop the integrated terminal into a REPL-style Go task console.',
    defaultArgs: ['repl'],
  },
];

export interface RunGoWorkbenchActionRequest {
  runtimeId: string;
  actionId: GoWorkbenchActionId;
  filePath: string;
  workingDirectory?: string | null;
  extraArgs?: readonly string[];
}

/**
 * Execute a Go workbench action through the shared runtime backend. The
 * configured runtime is the `native-command` package the user mapped to the
 * `.go` workbench (defaults to `runtimes/go-workbench-driver` when present).
 */
export async function runGoWorkbenchAction(
  request: RunGoWorkbenchActionRequest,
): Promise<ExternalRuntimeCommandResult> {
  const action = goWorkbenchActions.find(item => item.id === request.actionId);
  if (!action) {
    throw new Error(`Unknown Go workbench action: ${request.actionId}`);
  }
  return runGoCommand({
    runtimeId: request.runtimeId,
    args: [...action.defaultArgs, request.filePath, ...(request.extraArgs ?? [])],
    workingDirectory: request.workingDirectory ?? null,
  });
}
