import type { ExplorerWorkflowLaunchRequest } from "../components/explorer/explorerWorkflowContracts";

export type ExplorerWorkflowBridgeRequest =
  | ({
      kind: "open";
    } & ExplorerWorkflowLaunchRequest)
  | {
      kind: "close";
      targetPaneId?: string | null;
      workspaceTabId?: string | null;
    };

const EXPLORER_WORKFLOW_REQUEST_EVENT =
  "greeblefs:explorer-workflow-request";

export function dispatchExplorerWorkflowRequest(
  request: ExplorerWorkflowBridgeRequest,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ExplorerWorkflowBridgeRequest>(
      EXPLORER_WORKFLOW_REQUEST_EVENT,
      {
        detail: request,
      },
    ),
  );
}

export function subscribeToExplorerWorkflowRequests(
  listener: (request: ExplorerWorkflowBridgeRequest) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleEvent = (event: Event) => {
    const customEvent =
      event as CustomEvent<ExplorerWorkflowBridgeRequest>;
    if (!customEvent.detail) {
      return;
    }
    listener(customEvent.detail);
  };

  window.addEventListener(
    EXPLORER_WORKFLOW_REQUEST_EVENT,
    handleEvent as EventListener,
  );
  return () => {
    window.removeEventListener(
      EXPLORER_WORKFLOW_REQUEST_EVENT,
      handleEvent as EventListener,
    );
  };
}
