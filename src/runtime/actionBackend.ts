import type {
  ActionExecutionRequest,
  ActionExecutionResult,
  ActionInvocationContext,
  ActionInvocationEntry,
  ActionMenuContextKind,
  ActionOutputTarget,
  ActionRunnerKind,
} from "../generated/tauri";
import type { ExplorerActionOutputTarget } from "../config/actionPacks";
import { commands, unwrapTauriResult } from "./tauriClient";

export type ExplorerActionExecutionInput = ActionExecutionRequest;
export type ExplorerActionExecutionOutput = ActionExecutionResult;
export type ExplorerActionInvocationContext = ActionInvocationContext;
export type ExplorerActionInvocationEntry = ActionInvocationEntry;
export type ExplorerActionMenuContextKind = ActionMenuContextKind;
export type ExplorerActionRunnerKind = ActionRunnerKind;
export type ExplorerActionBackendOutputTarget = ActionOutputTarget;

export function normalizeExplorerActionOutputTarget(
  target: ExplorerActionOutputTarget,
): ExplorerActionBackendOutputTarget {
  switch (target) {
    case "preview-terminal":
      return "previewTerminal";
    case "native-terminal":
      return "nativeTerminal";
    case "silent":
      return "silent";
    case "task-center":
    default:
      return "taskCenter";
  }
}

export async function executeExplorerAction(
  request: ExplorerActionExecutionInput,
): Promise<ExplorerActionExecutionOutput> {
  return unwrapTauriResult(await commands.actionExecute(request));
}
