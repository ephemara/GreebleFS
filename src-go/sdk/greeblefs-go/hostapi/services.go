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
	RepoContext     *ExecutionContextRepoContext    `json:"repoContext,omitempty"`
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

type HostExternalTerminalRequest struct {
	WorkingDir string   `json:"workingDir"`
	Profile    *string  `json:"profile,omitempty"`
	Executable *string  `json:"executable,omitempty"`
	Args       []string `json:"args,omitempty"`
	Shell      *string  `json:"shell,omitempty"`
}

type ServiceClients struct {
	Host      *HostServiceClient
	Selection *SelectionServiceClient
	Preview   *PreviewServiceClient
	Files     *FilesServiceClient
	Explorer  *ExplorerServiceClient
	Repo      *RepoServiceClient
	Tasks     *TasksServiceClient
	Terminal  *TerminalServiceClient
}

type HostServiceClient struct{ bridge *Bridge }
type SelectionServiceClient struct{ bridge *Bridge }
type PreviewServiceClient struct{ bridge *Bridge }
type FilesServiceClient struct{ bridge *Bridge }
type ExplorerServiceClient struct{ bridge *Bridge }
type RepoServiceClient struct{ bridge *Bridge }
type TasksServiceClient struct{ bridge *Bridge }
type TerminalServiceClient struct{ bridge *Bridge }

func (b *Bridge) Services() *ServiceClients {
	return &ServiceClients{
		Host:      &HostServiceClient{bridge: b},
		Selection: &SelectionServiceClient{bridge: b},
		Preview:   &PreviewServiceClient{bridge: b},
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

func (c *HostServiceClient) GetAPISchema() (ExtensionHostAPISchema, error) {
	return decodeHostCall[ExtensionHostAPISchema](c.bridge, "host.get_api_schema", nil)
}

func (c *SelectionServiceClient) GetSnapshot() (ExecutionContextSnapshot, error) {
	return decodeHostCall[ExecutionContextSnapshot](c.bridge, "selection.get_snapshot", nil)
}

func (c *PreviewServiceClient) GetSession() (*ExecutionContextPreviewSession, error) {
	return decodeHostCall[*ExecutionContextPreviewSession](c.bridge, "preview.get_session", nil)
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

func (c *TerminalServiceClient) OpenExternal(request HostExternalTerminalRequest) error {
	_, err := decodeHostCall[any](c.bridge, "terminal.open_external", request)
	return err
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
