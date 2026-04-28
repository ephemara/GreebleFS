package main

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"sync"

	greeblefsRuntime "greeblefs.dev/sdk/greeblefs-go/runtime"
)

const explorerHomePath = "greeblefs://home"
const explorerArchiveVirtualScheme = "greeblefs://archive"

var archiveSuffixes = []string{
	".tar.gz",
	".tgz",
	".tar.bz2",
	".tbz2",
	".tar.xz",
	".txz",
	".7z",
	".zip",
	".cbz",
	".jar",
	".apk",
	".tar",
	".gz",
	".bz2",
	".xz",
}

var executableBinaryExtensions = map[string]struct{}{
	"exe": {},
	"msi": {},
	"com": {},
	"app": {},
	"dmg": {},
}

type explorerPolicyService struct {
	mu       sync.Mutex
	sessions map[string]explorerPolicySessionSnapshot
}

type explorerPolicySessionSnapshot struct {
	CurrentPath string   `json:"currentPath"`
	History     []string `json:"history"`
	HistoryIdx  int      `json:"historyIdx"`
}

type explorerPolicyBootstrapRequest struct {
	SessionID string                        `json:"sessionId"`
	Session   explorerPolicySessionSnapshot `json:"session"`
}

type explorerPolicyBootstrapResult struct {
	Snapshot explorerPolicySessionSnapshot `json:"snapshot"`
}

type explorerPolicyNavigateRequest struct {
	SessionID    string `json:"sessionId"`
	Path         string `json:"path"`
	PushHistory  bool   `json:"pushHistory"`
	HistoryIndex *int   `json:"historyIndex,omitempty"`
	ShowHidden   bool   `json:"showHidden"`
}

type explorerPolicyNavigateResult struct {
	Snapshot       explorerPolicySessionSnapshot  `json:"snapshot"`
	Listing        *explorerPolicyLocationListing `json:"listing,omitempty"`
	IsHome         bool                           `json:"isHome"`
	ClearSelection bool                           `json:"clearSelection"`
}

type explorerPolicyResolveOpenEntryRequest struct {
	SessionID      string                  `json:"sessionId"`
	Entry          explorerPolicyFileEntry `json:"entry"`
	PreviewEnabled bool                    `json:"previewEnabled"`
	CompactDock    bool                    `json:"compactDock"`
	ShowHidden     bool                    `json:"showHidden"`
}

type explorerPolicyResolveOpenEntryResult struct {
	Effect                     string                         `json:"effect"`
	Snapshot                   *explorerPolicySessionSnapshot `json:"snapshot,omitempty"`
	Listing                    *explorerPolicyLocationListing `json:"listing,omitempty"`
	TargetPath                 string                         `json:"targetPath,omitempty"`
	RequiresArchiveMaterialize bool                           `json:"requiresArchiveMaterialize,omitempty"`
	ClearSelection             bool                           `json:"clearSelection,omitempty"`
}

type explorerPolicyBreadcrumb struct {
	Label string `json:"label"`
	Path  string `json:"path"`
}

type explorerPolicyFileEntry struct {
	Name            string `json:"name"`
	Path            string `json:"path"`
	IsDir           bool   `json:"is_dir"`
	Size            uint64 `json:"size"`
	Modified        uint64 `json:"modified"`
	Extension       string `json:"extension"`
	IsHidden        bool   `json:"is_hidden"`
	IsSymlink       bool   `json:"is_symlink"`
	EntityID        string `json:"entityId"`
	IdentityKind    string `json:"identityKind"`
	ContentRevision string `json:"contentRevision"`
}

type explorerPolicyLocationListing struct {
	Kind        string                     `json:"kind"`
	Path        string                     `json:"path"`
	ParentPath  *string                    `json:"parentPath"`
	Breadcrumbs []explorerPolicyBreadcrumb `json:"breadcrumbs"`
	Entries     []explorerPolicyFileEntry  `json:"entries"`
}

type explorerPolicyListLocationHostRequest struct {
	Path       string `json:"path"`
	ShowHidden bool   `json:"showHidden"`
}

func newExplorerPolicyService() *explorerPolicyService {
	return &explorerPolicyService{
		sessions: make(map[string]explorerPolicySessionSnapshot),
	}
}

func (service *explorerPolicyService) bootstrap(request explorerPolicyBootstrapRequest) explorerPolicyBootstrapResult {
	service.mu.Lock()
	defer service.mu.Unlock()

	normalized := normalizePolicySessionSnapshot(request.Session)
	service.sessions[strings.TrimSpace(request.SessionID)] = normalized
	return explorerPolicyBootstrapResult{Snapshot: clonePolicySessionSnapshot(normalized)}
}

func (service *explorerPolicyService) navigate(
	host *greeblefsRuntime.HostBridgeClient,
	request explorerPolicyNavigateRequest,
) (explorerPolicyNavigateResult, error) {
	sessionID := strings.TrimSpace(request.SessionID)
	if sessionID == "" {
		return explorerPolicyNavigateResult{}, fmt.Errorf("navigate requires a session id")
	}

	nextPath := strings.TrimSpace(request.Path)
	if nextPath == "" {
		return explorerPolicyNavigateResult{}, fmt.Errorf("navigate requires a target path")
	}

	service.mu.Lock()
	session := normalizePolicySessionSnapshot(service.sessions[sessionID])
	nextHistory, nextHistoryIdx := applyNavigationHistory(
		session,
		nextPath,
		request.PushHistory,
		request.HistoryIndex,
	)
	session.CurrentPath = nextPath
	session.History = nextHistory
	session.HistoryIdx = nextHistoryIdx
	service.sessions[sessionID] = session
	service.mu.Unlock()

	if nextPath == explorerHomePath {
		return explorerPolicyNavigateResult{
			Snapshot:       clonePolicySessionSnapshot(session),
			Listing:        nil,
			IsHome:         true,
			ClearSelection: true,
		}, nil
	}

	listing, err := callExplorerHost[explorerPolicyLocationListing](
		host,
		"explorer.list_location",
		explorerPolicyListLocationHostRequest{
			Path:       nextPath,
			ShowHidden: request.ShowHidden,
		},
	)
	if err != nil {
		return explorerPolicyNavigateResult{}, err
	}

	return explorerPolicyNavigateResult{
		Snapshot:       clonePolicySessionSnapshot(session),
		Listing:        &listing,
		IsHome:         false,
		ClearSelection: true,
	}, nil
}

func (service *explorerPolicyService) resolveOpenEntry(
	host *greeblefsRuntime.HostBridgeClient,
	request explorerPolicyResolveOpenEntryRequest,
) (explorerPolicyResolveOpenEntryResult, error) {
	entry := request.Entry
	if strings.TrimSpace(entry.Path) == "" {
		return explorerPolicyResolveOpenEntryResult{}, fmt.Errorf("resolve_open requires an entry path")
	}

	if entry.IsDir {
		return explorerPolicyResolveOpenEntryResult{
			Effect:     "navigate",
			TargetPath: entry.Path,
		}, nil
	}

	if isArchiveFileEntry(entry) {
		archiveRootPath := buildArchiveVirtualPath(entry.Path, "")
		return explorerPolicyResolveOpenEntryResult{
			Effect:     "navigate",
			TargetPath: archiveRootPath,
		}, nil
	}

	if request.PreviewEnabled && !request.CompactDock && !isExecutableBinaryExtension(entry.Extension) {
		return explorerPolicyResolveOpenEntryResult{
			Effect:     "preview",
			TargetPath: entry.Path,
		}, nil
	}

	return explorerPolicyResolveOpenEntryResult{
		Effect:                     "openPath",
		TargetPath:                 entry.Path,
		RequiresArchiveMaterialize: isArchiveVirtualPath(entry.Path),
	}, nil
}

func normalizePolicySessionSnapshot(snapshot explorerPolicySessionSnapshot) explorerPolicySessionSnapshot {
	history := make([]string, 0, len(snapshot.History))
	for _, entry := range snapshot.History {
		trimmed := strings.TrimSpace(entry)
		if trimmed != "" {
			history = append(history, trimmed)
		}
	}
	historyIdx := snapshot.HistoryIdx
	if historyIdx < -1 {
		historyIdx = -1
	}
	if historyIdx >= len(history) {
		historyIdx = len(history) - 1
	}
	return explorerPolicySessionSnapshot{
		CurrentPath: strings.TrimSpace(snapshot.CurrentPath),
		History:     history,
		HistoryIdx:  historyIdx,
	}
}

func clonePolicySessionSnapshot(snapshot explorerPolicySessionSnapshot) explorerPolicySessionSnapshot {
	return explorerPolicySessionSnapshot{
		CurrentPath: snapshot.CurrentPath,
		History:     append([]string(nil), snapshot.History...),
		HistoryIdx:  snapshot.HistoryIdx,
	}
}

func applyNavigationHistory(
	session explorerPolicySessionSnapshot,
	nextPath string,
	push bool,
	historyIndex *int,
) ([]string, int) {
	if !push {
		nextHistory := append([]string(nil), session.History...)
		nextHistoryIdx := session.HistoryIdx
		if historyIndex != nil {
			nextHistoryIdx = *historyIndex
			if nextHistoryIdx < -1 {
				nextHistoryIdx = -1
			}
			if nextHistoryIdx >= len(nextHistory) {
				nextHistoryIdx = len(nextHistory) - 1
			}
		}
		return nextHistory, nextHistoryIdx
	}
	baseHistory := session.History
	if session.HistoryIdx >= 0 && session.HistoryIdx < len(baseHistory)-1 {
		baseHistory = append([]string(nil), baseHistory[:session.HistoryIdx+1]...)
	} else {
		baseHistory = append([]string(nil), baseHistory...)
	}
	baseHistory = append(baseHistory, nextPath)
	return baseHistory, len(baseHistory) - 1
}

func isArchiveVirtualPath(path string) bool {
	parsed, err := url.Parse(strings.TrimSpace(path))
	if err != nil {
		return false
	}
	return fmt.Sprintf("%s://%s", parsed.Scheme, parsed.Host) == explorerArchiveVirtualScheme
}

func buildArchiveVirtualPath(archivePath string, entryPath string) string {
	parsed, _ := url.Parse(explorerArchiveVirtualScheme)
	query := parsed.Query()
	query.Set("archive", strings.TrimSpace(archivePath))
	normalizedEntryPath := normalizeArchiveEntryPath(entryPath)
	if normalizedEntryPath != "" {
		query.Set("entry", normalizedEntryPath)
	}
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func normalizeArchiveEntryPath(path string) string {
	return strings.Trim(strings.ReplaceAll(strings.TrimSpace(path), "\\", "/"), "/")
}

func isArchiveFileEntry(entry explorerPolicyFileEntry) bool {
	if entry.IsDir {
		return false
	}
	lowerName := strings.ToLower(strings.TrimSpace(entry.Name))
	if lowerName == "" {
		return false
	}
	for _, suffix := range archiveSuffixes {
		if strings.HasSuffix(lowerName, suffix) {
			return true
		}
	}
	return false
}

func isExecutableBinaryExtension(extension string) bool {
	normalized := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(extension)), ".")
	_, exists := executableBinaryExtensions[normalized]
	return exists
}

func callExplorerHost[T any](
	host *greeblefsRuntime.HostBridgeClient,
	methodID string,
	payload any,
) (T, error) {
	var zero T
	if host == nil {
		return zero, fmt.Errorf("host bridge is unavailable for %s", methodID)
	}
	resultJSON, err := host.Call(methodID, payload)
	if err != nil {
		return zero, err
	}
	if len(resultJSON) == 0 || string(resultJSON) == "null" {
		return zero, nil
	}
	var decoded T
	if err := json.Unmarshal(resultJSON, &decoded); err != nil {
		return zero, fmt.Errorf("failed to decode host response for %s: %w", methodID, err)
	}
	return decoded, nil
}
