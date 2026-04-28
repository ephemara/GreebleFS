package runtime

import "encoding/json"

type ExtensionHostAPISchema struct {
	APIVersion string                          `json:"apiVersion"`
	Transport  string                          `json:"transport"`
	Methods    []ExtensionHostMethodDescriptor `json:"methods"`
}

type ExtensionHostMethodDescriptor struct {
	MethodID            string   `json:"methodId"`
	Namespace           string   `json:"namespace"`
	Summary             string   `json:"summary"`
	RequiredPermissions []string `json:"requiredPermissions"`
}

type ExecutionContextSnapshot struct {
	Roots           []ExecutionContextRoot          `json:"roots"`
	ActiveDirectory *string                         `json:"activeDirectory,omitempty"`
	CWD             *string                         `json:"cwd,omitempty"`
	FocusedEntry    *ExecutionContextEntry          `json:"focusedEntry,omitempty"`
	SelectedEntries []ExecutionContextEntry         `json:"selectedEntries"`
	PreviewSession  *ExecutionContextPreviewSession `json:"previewSession,omitempty"`
	PaneID          *string                         `json:"paneId,omitempty"`
	WorkspaceTabID  *string                         `json:"workspaceTabId,omitempty"`
	RepoContext     *ExecutionContextRepoContext    `json:"repoContext,omitempty"`
	ActiveFileType  *FileTypeDescriptor             `json:"activeFileType,omitempty"`
	Revision        string                          `json:"revision"`
}

type ExecutionContextRoot struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Path  string `json:"path"`
	Kind  string `json:"kind"`
}

type ExecutionContextEntry struct {
	Path        string  `json:"path"`
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	Extension   *string `json:"extension,omitempty"`
	IsDirectory bool    `json:"isDirectory"`
}

type ExecutionContextPreviewSession struct {
	LaneID        *string `json:"laneId,omitempty"`
	LaneType      string  `json:"laneType"`
	ViewMode      *string `json:"viewMode,omitempty"`
	WorkflowTabID *string `json:"workflowTabId,omitempty"`
	FilePath      *string `json:"filePath,omitempty"`
	ResolvedPath  *string `json:"resolvedPath,omitempty"`
}

type ExecutionContextRepoContext struct {
	RootPath string  `json:"rootPath"`
	HeadRef  *string `json:"headRef,omitempty"`
	IsDirty  *bool   `json:"isDirty,omitempty"`
}

type FileTypeDescriptor struct {
	ID              string   `json:"id"`
	Extensions      []string `json:"extensions"`
	FileNames       []string `json:"fileNames"`
	LanguageID      *string  `json:"languageId,omitempty"`
	IconKey         *string  `json:"iconKey,omitempty"`
	OpenBehavior    string   `json:"openBehavior"`
	PreviewOwner    *string  `json:"previewOwner,omitempty"`
	RuntimeAffinity *string  `json:"runtimeAffinity,omitempty"`
	Editable        bool     `json:"editable"`
}

type HostTopicDescriptor struct {
	Topic              string   `json:"topic"`
	Delivery           string   `json:"delivery"`
	DefaultScope       string   `json:"defaultScope"`
	SupportsSnapshot   bool     `json:"supportsSnapshot"`
	ReplayDepth        uint32   `json:"replayDepth"`
	ActivationTriggers []string `json:"activationTriggers"`
}

type HostEventFilter struct {
	PaneID         *string `json:"paneId,omitempty"`
	WorkspaceTabID *string `json:"workspaceTabId,omitempty"`
	PathPrefix     *string `json:"pathPrefix,omitempty"`
	TaskID         *string `json:"taskId,omitempty"`
	RuntimeID      *string `json:"runtimeId,omitempty"`
	TopicPrefix    *string `json:"topicPrefix,omitempty"`
}

type HostSubscriptionRequest struct {
	Topics           []string         `json:"topics,omitempty"`
	Filters          *HostEventFilter `json:"filters,omitempty"`
	IncludeSnapshot  bool             `json:"includeSnapshot"`
	ReplayFrom       *uint64          `json:"replayFrom,omitempty"`
	DeliveryOverride *string          `json:"deliveryOverride,omitempty"`
}

type HostSubscription struct {
	SubscriptionID string   `json:"subscriptionId"`
	Topics         []string `json:"topics"`
	Transport      string   `json:"transport"`
	Supported      bool     `json:"supported"`
}

type HostEventScope struct {
	PaneID         *string `json:"paneId,omitempty"`
	WorkspaceTabID *string `json:"workspaceTabId,omitempty"`
	Path           *string `json:"path,omitempty"`
	TaskID         *string `json:"taskId,omitempty"`
	RuntimeID      *string `json:"runtimeId,omitempty"`
	ExtensionID    *string `json:"extensionId,omitempty"`
}

type HostEventEnvelope struct {
	EventID          string                    `json:"eventId"`
	SubscriptionID   *string                   `json:"subscriptionId,omitempty"`
	Topic            string                    `json:"topic"`
	Sequence         uint64                    `json:"sequence"`
	EmittedAtMS      uint64                    `json:"emittedAtMs"`
	Delivery         string                    `json:"delivery"`
	Scope            HostEventScope            `json:"scope"`
	PayloadJSON      *string                   `json:"payloadJson,omitempty"`
	ExecutionContext *ExecutionContextSnapshot `json:"executionContext,omitempty"`
	Snapshot         bool                      `json:"snapshot"`
}

type HostContextSyncRequest struct {
	Snapshot ExecutionContextSnapshot `json:"snapshot"`
	IsActive bool                     `json:"isActive"`
}

type HostPublishEventRequest struct {
	Topic       string  `json:"topic"`
	PayloadJSON *string `json:"payloadJson,omitempty"`
}

type HostEventHandler func(HostEventEnvelope)

type HostFileStat struct {
	Path        string  `json:"path"`
	Exists      bool    `json:"exists"`
	IsDirectory bool    `json:"isDirectory"`
	Size        uint64  `json:"size"`
	ModifiedMS  *uint64 `json:"modifiedMs,omitempty"`
	Extension   *string `json:"extension,omitempty"`
}

type HostExplorerBreadcrumb struct {
	Label string `json:"label"`
	Path  string `json:"path"`
}

type HostExplorerLocationListing struct {
	Kind        string                   `json:"kind"`
	Path        string                   `json:"path"`
	ParentPath  *string                  `json:"parentPath,omitempty"`
	Breadcrumbs []HostExplorerBreadcrumb `json:"breadcrumbs"`
	Entries     []map[string]any         `json:"entries"`
}

type HostTaskRunCommandRequest struct {
	Program          string            `json:"program"`
	Args             []string          `json:"args,omitempty"`
	WorkingDirectory *string           `json:"workingDirectory,omitempty"`
	Environment      map[string]string `json:"environment,omitempty"`
	TimeoutSecs      *uint64           `json:"timeoutSecs,omitempty"`
}

type HostTaskRunCommandResult struct {
	Status int    `json:"status"`
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
}

type HostTaskStartProcessRequest struct {
	Program          string            `json:"program"`
	Args             []string          `json:"args,omitempty"`
	WorkingDirectory *string           `json:"workingDirectory,omitempty"`
	Environment      map[string]string `json:"environment,omitempty"`
}

type HostTaskHandle struct {
	TaskID           string `json:"taskId"`
	Program          string `json:"program"`
	WorkingDirectory string `json:"workingDirectory"`
}

type HostTaskOutputEvent struct {
	TaskID string `json:"taskId"`
	Stream string `json:"stream"`
	Chunk  string `json:"chunk"`
}

type HostTaskProgressEvent struct {
	TaskID           string  `json:"taskId"`
	Phase            string  `json:"phase"`
	Program          *string `json:"program,omitempty"`
	WorkingDirectory *string `json:"workingDirectory,omitempty"`
	ExitCode         *int    `json:"exitCode,omitempty"`
	Stream           *string `json:"stream,omitempty"`
	Error            *string `json:"error,omitempty"`
}

type HostFileWatchRequest struct {
	Path      string `json:"path"`
	Recursive bool   `json:"recursive"`
}

type HostFileWatchHandle struct {
	WatchID   string `json:"watchId"`
	Path      string `json:"path"`
	Recursive bool   `json:"recursive"`
}

type HostFileWatchEvent struct {
	WatchID string   `json:"watchId"`
	Kind    string   `json:"kind"`
	Paths   []string `json:"paths"`
	Error   *string  `json:"error,omitempty"`
}

type HostExternalTerminalRequest struct {
	WorkingDir string   `json:"workingDir"`
	Profile    *string  `json:"profile,omitempty"`
	Executable *string  `json:"executable,omitempty"`
	Args       []string `json:"args,omitempty"`
	Shell      *string  `json:"shell,omitempty"`
}

type HostServiceClients struct {
	Context   *ContextServiceClient
	Host      *HostServiceClient
	Selection *SelectionServiceClient
	Preview   *PreviewServiceClient
	Events    *EventsServiceClient
	Files     *FilesServiceClient
	Explorer  *ExplorerServiceClient
	Repo      *RepoServiceClient
	Tasks     *TasksServiceClient
	Terminal  *TerminalServiceClient
}

type ContextServiceClient struct{ bridge *HostBridgeClient }
type HostServiceClient struct{ bridge *HostBridgeClient }
type SelectionServiceClient struct{ bridge *HostBridgeClient }
type PreviewServiceClient struct{ bridge *HostBridgeClient }
type EventsServiceClient struct{ bridge *HostBridgeClient }
type FilesServiceClient struct{ bridge *HostBridgeClient }
type ExplorerServiceClient struct{ bridge *HostBridgeClient }
type RepoServiceClient struct{ bridge *HostBridgeClient }
type TasksServiceClient struct{ bridge *HostBridgeClient }
type TerminalServiceClient struct{ bridge *HostBridgeClient }

func (h *HostBridgeClient) Services() *HostServiceClients {
	return &HostServiceClients{
		Context:   &ContextServiceClient{bridge: h},
		Host:      &HostServiceClient{bridge: h},
		Selection: &SelectionServiceClient{bridge: h},
		Preview:   &PreviewServiceClient{bridge: h},
		Events:    &EventsServiceClient{bridge: h},
		Files:     &FilesServiceClient{bridge: h},
		Explorer:  &ExplorerServiceClient{bridge: h},
		Repo:      &RepoServiceClient{bridge: h},
		Tasks:     &TasksServiceClient{bridge: h},
		Terminal:  &TerminalServiceClient{bridge: h},
	}
}

func (c *ContextServiceClient) SyncSnapshot(request HostContextSyncRequest) error {
	_, err := decodeHostCall[any](c.bridge, "context.sync_snapshot", request)
	return err
}

func (c *HostServiceClient) GetAPISchema() (ExtensionHostAPISchema, error) {
	return decodeHostCall[ExtensionHostAPISchema](c.bridge, "host.get_api_schema", nil)
}

func (c *SelectionServiceClient) GetSnapshot() (ExecutionContextSnapshot, error) {
	return decodeHostCall[ExecutionContextSnapshot](c.bridge, "selection.get_snapshot", nil)
}

func (c *PreviewServiceClient) GetSession() (*ExecutionContextPreviewSession, error) {
	return decodeHostCall[*ExecutionContextPreviewSession](c.bridge, "preview.get_session", nil)
}

func (c *EventsServiceClient) DescribeTopics() ([]HostTopicDescriptor, error) {
	return decodeHostCall[[]HostTopicDescriptor](c.bridge, "events.describe_topics", nil)
}

func (c *EventsServiceClient) Subscribe(
	request HostSubscriptionRequest,
	handler HostEventHandler,
) (HostSubscription, error) {
	return c.bridge.sidecar.subscribeHostEvents(request, handler)
}

func (c *EventsServiceClient) Unsubscribe(subscriptionID string) (*HostSubscription, error) {
	return c.bridge.sidecar.unsubscribeHostEvents(subscriptionID)
}

func (c *EventsServiceClient) GetSnapshot(
	request HostSubscriptionRequest,
) ([]HostEventEnvelope, error) {
	return decodeHostCall[[]HostEventEnvelope](c.bridge, "events.get_snapshot", request)
}

func (c *EventsServiceClient) Publish(topic string, payload any) (HostEventEnvelope, error) {
	payloadJSON, err := encodeOptionalPayload(payload)
	if err != nil {
		return HostEventEnvelope{}, err
	}
	return c.bridge.sidecar.publishHostEvent(HostPublishEventRequest{
		Topic:       topic,
		PayloadJSON: payloadJSON,
	})
}

func (c *FilesServiceClient) ReadText(path string) (string, error) {
	return decodeHostCall[string](c.bridge, "files.read_text", map[string]any{
		"path": path,
	})
}

func (c *FilesServiceClient) WriteText(path string, content string) error {
	_, err := decodeHostCall[any](c.bridge, "files.write_text", map[string]any{
		"path":    path,
		"content": content,
	})
	return err
}

func (c *FilesServiceClient) ListDirectory(path string, showHidden bool) (HostExplorerLocationListing, error) {
	return decodeHostCall[HostExplorerLocationListing](c.bridge, "files.list_directory", map[string]any{
		"path":       path,
		"showHidden": showHidden,
	})
}

func (c *FilesServiceClient) Stat(path string) (HostFileStat, error) {
	return decodeHostCall[HostFileStat](c.bridge, "files.stat", map[string]any{
		"path": path,
	})
}

func (c *FilesServiceClient) Watch(request HostFileWatchRequest) (HostFileWatchHandle, error) {
	return decodeHostCall[HostFileWatchHandle](c.bridge, "files.watch", request)
}

func (c *FilesServiceClient) Unwatch(watchID string) (*HostFileWatchHandle, error) {
	return decodeHostCall[*HostFileWatchHandle](c.bridge, "files.unwatch", map[string]any{
		"watchId": watchID,
	})
}

func (c *ExplorerServiceClient) ListLocation(path string, showHidden bool) (HostExplorerLocationListing, error) {
	return decodeHostCall[HostExplorerLocationListing](c.bridge, "explorer.list_location", map[string]any{
		"path":       path,
		"showHidden": showHidden,
	})
}

func (c *ExplorerServiceClient) OpenPath(path string) error {
	_, err := decodeHostCall[any](c.bridge, "explorer.open_path", map[string]any{
		"path": path,
	})
	return err
}

func (c *RepoServiceClient) Exec(repoPath *string, args []string) (string, error) {
	payload := map[string]any{
		"args": args,
	}
	if repoPath != nil && *repoPath != "" {
		payload["repoPath"] = *repoPath
	}
	return decodeHostCall[string](c.bridge, "repo.exec", payload)
}

func (c *TasksServiceClient) RunCommand(request HostTaskRunCommandRequest) (HostTaskRunCommandResult, error) {
	return decodeHostCall[HostTaskRunCommandResult](c.bridge, "tasks.run_command", request)
}

func (c *TasksServiceClient) StartProcess(request HostTaskStartProcessRequest) (HostTaskHandle, error) {
	return decodeHostCall[HostTaskHandle](c.bridge, "tasks.start_process", request)
}

func (c *TasksServiceClient) StopProcess(taskID string) (bool, error) {
	return decodeHostCall[bool](c.bridge, "tasks.stop_process", map[string]any{
		"taskId": taskID,
	})
}

func (c *TerminalServiceClient) OpenExternal(request HostExternalTerminalRequest) error {
	_, err := decodeHostCall[any](c.bridge, "terminal.open_external", request)
	return err
}

func decodeHostCall[T any](bridge *HostBridgeClient, methodID string, payload any) (T, error) {
	var zero T
	raw, err := bridge.Call(methodID, payload)
	if err != nil {
		return zero, err
	}
	if len(raw) == 0 {
		return zero, nil
	}
	if err := json.Unmarshal(raw, &zero); err != nil {
		return zero, err
	}
	return zero, nil
}
