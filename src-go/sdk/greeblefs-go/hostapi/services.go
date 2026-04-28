//go:build js && wasm
// +build js,wasm

package hostapi

import (
	"encoding/json"
	"errors"
	"syscall/js"
)

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
	SubscriptionID string           `json:"subscriptionId"`
	Topics         []string         `json:"topics"`
	Transport      string           `json:"transport"`
	Supported      bool             `json:"supported"`
	StreamHandle   *IpcStreamHandle `json:"streamHandle,omitempty"`
}

type IpcStreamHandle struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	EventName string `json:"eventName"`
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

type HostTerminalSpawnRequest struct {
	ID         string  `json:"id"`
	WorkingDir *string `json:"workingDir,omitempty"`
	Shell      *string `json:"shell,omitempty"`
	Rows       *uint16 `json:"rows,omitempty"`
	Cols       *uint16 `json:"cols,omitempty"`
}

type HostTerminalWriteRequest struct {
	ID   string `json:"id"`
	Data string `json:"data"`
}

type HostTerminalResizeRequest struct {
	ID   string `json:"id"`
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

type HostTerminalKillRequest struct {
	ID string `json:"id"`
}

type HostTerminalOpenOutputStreamRequest struct {
	ID string `json:"id"`
}

type HostTerminalSyncCwdRequest struct {
	ID  string `json:"id"`
	CWD string `json:"cwd"`
}

type HostTerminalSetPromptStateRequest struct {
	ID          string  `json:"id"`
	AtPrompt    bool    `json:"atPrompt"`
	ReportedCWD *string `json:"reportedCwd,omitempty"`
}

type HostTerminalShellIntegrationRequest struct {
	ID             string  `json:"id"`
	ShellKind      *string `json:"shellKind,omitempty"`
	SupportsAutoCD *bool   `json:"supportsAutoCd,omitempty"`
	AtPrompt       *bool   `json:"atPrompt,omitempty"`
	ReportedCWD    *string `json:"reportedCwd,omitempty"`
}

type HostTerminalShellIntegrationState struct {
	ShellKind      string  `json:"shellKind"`
	SupportsAutoCD bool    `json:"supportsAutoCd"`
	AtPrompt       bool    `json:"atPrompt"`
	ReportedCWD    *string `json:"reportedCwd,omitempty"`
	PendingCWD     *string `json:"pendingCwd,omitempty"`
	LastSyncedCWD  *string `json:"lastSyncedCwd,omitempty"`
}

type HostIpcStreamHandle struct {
	ID        string `json:"id"`
	EventName string `json:"eventName"`
}

type ServiceClients struct {
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

type ContextServiceClient struct{ bridge *Bridge }
type HostServiceClient struct{ bridge *Bridge }
type SelectionServiceClient struct{ bridge *Bridge }
type PreviewServiceClient struct{ bridge *Bridge }
type EventsServiceClient struct{ bridge *Bridge }
type FilesServiceClient struct{ bridge *Bridge }
type ExplorerServiceClient struct{ bridge *Bridge }
type RepoServiceClient struct{ bridge *Bridge }
type TasksServiceClient struct{ bridge *Bridge }
type TerminalServiceClient struct{ bridge *Bridge }

func (b *Bridge) Services() *ServiceClients {
	return &ServiceClients{
		Context:   &ContextServiceClient{bridge: b},
		Host:      &HostServiceClient{bridge: b},
		Selection: &SelectionServiceClient{bridge: b},
		Preview:   &PreviewServiceClient{bridge: b},
		Events:    &EventsServiceClient{bridge: b},
		Files:     &FilesServiceClient{bridge: b},
		Explorer:  &ExplorerServiceClient{bridge: b},
		Repo:      &RepoServiceClient{bridge: b},
		Tasks:     &TasksServiceClient{bridge: b},
		Terminal:  &TerminalServiceClient{bridge: b},
	}
}

func (b *Bridge) CallHostMethodJSON(methodID string, payload any) (json.RawMessage, error) {
	if methodID == "" {
		return nil, errors.New("greeblefs hostapi: methodID is required")
	}
	promise := b.value.Call("callHostMethod", methodID, toJSValue(payload))
	value, err := awaitPromise(promise)
	if err != nil {
		return nil, err
	}
	if value.IsNull() || value.IsUndefined() {
		return json.RawMessage("null"), nil
	}
	return json.RawMessage(value.String()), nil
}

func (b *Bridge) CallHostMethodValue(methodID string, payload any) (js.Value, error) {
	if methodID == "" {
		return js.Undefined(), errors.New("greeblefs hostapi: methodID is required")
	}
	promise := b.value.Call("callHostMethod", methodID, toJSValue(payload))
	return awaitPromise(promise)
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
	if handler == nil {
		return HostSubscription{}, errors.New("greeblefs hostapi: events.Subscribe requires a handler")
	}
	callback := js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) == 0 {
			return nil
		}
		var envelope HostEventEnvelope
		if err := json.Unmarshal([]byte(args[0].String()), &envelope); err == nil {
			go handler(envelope)
		}
		return nil
	})
	promise := c.bridge.value.Call("subscribeHostEvents", toJSValue(request), callback)
	value, err := awaitPromise(promise)
	if err != nil {
		callback.Release()
		return HostSubscription{}, err
	}
	var subscription HostSubscription
	if err := json.Unmarshal([]byte(value.String()), &subscription); err != nil {
		callback.Release()
		return HostSubscription{}, err
	}
	c.bridge.eventCallbacks[subscription.SubscriptionID] = callback
	return subscription, nil
}

func (c *EventsServiceClient) Unsubscribe(subscriptionID string) error {
	if subscriptionID == "" {
		return errors.New("greeblefs hostapi: events.Unsubscribe requires a subscription id")
	}
	promise := c.bridge.value.Call("unsubscribeHostEvents", subscriptionID)
	if _, err := awaitPromise(promise); err != nil {
		return err
	}
	if callback, ok := c.bridge.eventCallbacks[subscriptionID]; ok {
		callback.Release()
		delete(c.bridge.eventCallbacks, subscriptionID)
	}
	return nil
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
	return decodeHostCall[HostEventEnvelope](c.bridge, "events.publish", HostPublishEventRequest{
		Topic:       topic,
		PayloadJSON: payloadJSON,
	})
}

func (c *FilesServiceClient) ReadText(path string) (string, error) {
	return decodeHostCall[string](c.bridge, "files.read_text", map[string]any{
		"path": path,
	})
}

func (c *FilesServiceClient) WriteText(path, content string) error {
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

func (c *TerminalServiceClient) Spawn(request HostTerminalSpawnRequest) error {
	_, err := decodeHostCall[any](c.bridge, "terminal.spawn", request)
	return err
}

func (c *TerminalServiceClient) Write(request HostTerminalWriteRequest) error {
	_, err := decodeHostCall[any](c.bridge, "terminal.write", request)
	return err
}

func (c *TerminalServiceClient) WriteMany(requests []HostTerminalWriteRequest) error {
	_, err := decodeHostCall[any](c.bridge, "terminal.write_many", requests)
	return err
}

func (c *TerminalServiceClient) Resize(request HostTerminalResizeRequest) error {
	_, err := decodeHostCall[any](c.bridge, "terminal.resize", request)
	return err
}

func (c *TerminalServiceClient) Kill(id string) error {
	_, err := decodeHostCall[any](c.bridge, "terminal.kill", HostTerminalKillRequest{ID: id})
	return err
}

func (c *TerminalServiceClient) OpenOutputStream(id string) (HostIpcStreamHandle, error) {
	return decodeHostCall[HostIpcStreamHandle](
		c.bridge,
		"terminal.open_output_stream",
		HostTerminalOpenOutputStreamRequest{ID: id},
	)
}

func (c *TerminalServiceClient) RegisterShellIntegration(
	request HostTerminalShellIntegrationRequest,
) (HostTerminalShellIntegrationState, error) {
	return decodeHostCall[HostTerminalShellIntegrationState](
		c.bridge,
		"terminal.register_shell_integration",
		request,
	)
}

func (c *TerminalServiceClient) SyncCWD(
	request HostTerminalSyncCwdRequest,
) (HostTerminalShellIntegrationState, error) {
	return decodeHostCall[HostTerminalShellIntegrationState](c.bridge, "terminal.sync_cwd", request)
}

func (c *TerminalServiceClient) SetPromptState(
	request HostTerminalSetPromptStateRequest,
) (HostTerminalShellIntegrationState, error) {
	return decodeHostCall[HostTerminalShellIntegrationState](
		c.bridge,
		"terminal.set_prompt_state",
		request,
	)
}

func decodeHostCall[T any](bridge *Bridge, methodID string, payload any) (T, error) {
	var zero T
	raw, err := bridge.CallHostMethodJSON(methodID, payload)
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

func encodeOptionalPayload(payload any) (*string, error) {
	if payload == nil {
		return nil, nil
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	payloadJSON := string(encoded)
	return &payloadJSON, nil
}
