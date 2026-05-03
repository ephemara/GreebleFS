package main

import "testing"

func TestApplyNavigationHistoryPushesAndTruncatesForwardBranch(t *testing.T) {
	history, historyIdx := applyNavigationHistory(
		explorerPolicySessionSnapshot{
			CurrentPath: "/Users/alice",
			History:     []string{"/", "/Users", "/Users/alice", "/Users/alice/Documents"},
			HistoryIdx:  2,
		},
		"/Users/alice/Desktop",
		true,
		nil,
	)

	if historyIdx != 3 {
		t.Fatalf("expected history index 3, got %d", historyIdx)
	}
	if got, want := len(history), 4; got != want {
		t.Fatalf("expected history length %d, got %d", want, got)
	}
	if got, want := history[3], "/Users/alice/Desktop"; got != want {
		t.Fatalf("expected final history entry %q, got %q", want, got)
	}
}

func TestResolveOpenEntryPrefersPreviewForInlineFiles(t *testing.T) {
	service := newExplorerPolicyService()
	result, err := service.resolveOpenEntry(nil, explorerPolicyResolveOpenEntryRequest{
		SessionID:      "pane-1",
		PreviewEnabled: true,
		CompactDock:    false,
		ShowHidden:     false,
		Entry: explorerPolicyFileEntry{
			Name:      "notes.txt",
			Path:      "/tmp/notes.txt",
			IsDir:     false,
			Extension: "txt",
		},
	})
	if err != nil {
		t.Fatalf("resolveOpenEntry returned error: %v", err)
	}
	if got, want := result.Effect, "preview"; got != want {
		t.Fatalf("expected effect %q, got %q", want, got)
	}
}

func TestNavigateRollsBackSessionWhenHostListingFails(t *testing.T) {
	service := newExplorerPolicyService()
	sessionID := "pane-1"
	startingSession := explorerPolicySessionSnapshot{
		CurrentPath: "/Users/alice",
		History:     []string{"/", "/Users/alice"},
		HistoryIdx:  1,
	}
	service.bootstrap(explorerPolicyBootstrapRequest{
		SessionID: sessionID,
		Session:   startingSession,
	})

	_, err := service.navigate(nil, explorerPolicyNavigateRequest{
		SessionID:   sessionID,
		Path:        "/Users/alice/LockedFolder",
		PushHistory: true,
		ShowHidden:  false,
	})
	if err == nil {
		t.Fatalf("expected missing host bridge to fail navigation")
	}

	service.mu.Lock()
	storedSession := clonePolicySessionSnapshot(service.sessions[sessionID])
	service.mu.Unlock()

	if !samePolicySessionSnapshot(storedSession, startingSession) {
		t.Fatalf("expected failed navigation to preserve %#v, got %#v", startingSession, storedSession)
	}
}

func TestResolveOpenEntryMarksArchiveVirtualOpenForMaterialization(t *testing.T) {
	service := newExplorerPolicyService()
	result, err := service.resolveOpenEntry(nil, explorerPolicyResolveOpenEntryRequest{
		SessionID:      "pane-1",
		PreviewEnabled: false,
		CompactDock:    false,
		ShowHidden:     false,
		Entry: explorerPolicyFileEntry{
			Name:      "binary.exe",
			Path:      buildArchiveVirtualPath("/tmp/tools.zip", "binary.exe"),
			IsDir:     false,
			Extension: "exe",
		},
	})
	if err != nil {
		t.Fatalf("resolveOpenEntry returned error: %v", err)
	}
	if got, want := result.Effect, "openPath"; got != want {
		t.Fatalf("expected effect %q, got %q", want, got)
	}
	if !result.RequiresArchiveMaterialize {
		t.Fatalf("expected archive virtual open to require materialization")
	}
}

func TestApplyNavigationHistoryUsesExplicitHistoryIndexForBackForwardNavigation(t *testing.T) {
	targetHistoryIndex := 1
	history, historyIdx := applyNavigationHistory(
		explorerPolicySessionSnapshot{
			CurrentPath: "/Users/alice/Documents",
			History:     []string{"/", "/Users", "/Users/alice", "/Users/alice/Documents"},
			HistoryIdx:  3,
		},
		"/Users",
		false,
		&targetHistoryIndex,
	)

	if got, want := historyIdx, 1; got != want {
		t.Fatalf("expected history index %d, got %d", want, got)
	}
	if got, want := len(history), 4; got != want {
		t.Fatalf("expected history length %d, got %d", want, got)
	}
	if got, want := history[historyIdx], "/Users"; got != want {
		t.Fatalf("expected history[%d] to be %q, got %q", historyIdx, want, got)
	}
}

func TestResolveOpenEntryKeepsExecutableFilesOnOpenPathEvenWithPreviewEnabled(t *testing.T) {
	service := newExplorerPolicyService()
	result, err := service.resolveOpenEntry(nil, explorerPolicyResolveOpenEntryRequest{
		SessionID:      "pane-1",
		PreviewEnabled: true,
		CompactDock:    false,
		ShowHidden:     false,
		Entry: explorerPolicyFileEntry{
			Name:      "installer.exe",
			Path:      "/tmp/installer.exe",
			IsDir:     false,
			Extension: "exe",
		},
	})
	if err != nil {
		t.Fatalf("resolveOpenEntry returned error: %v", err)
	}
	if got, want := result.Effect, "openPath"; got != want {
		t.Fatalf("expected effect %q, got %q", want, got)
	}
}

func TestBuildArchiveVirtualPathNormalizesNestedEntrySeparators(t *testing.T) {
	virtualPath := buildArchiveVirtualPath(`C:\tmp\assets.zip`, `\nested\frames\hero.png\`)
	if !isArchiveVirtualPath(virtualPath) {
		t.Fatalf("expected %q to be recognized as an archive virtual path", virtualPath)
	}
	if got, want := normalizeArchiveEntryPath(`\nested\frames\hero.png\`), "nested/frames/hero.png"; got != want {
		t.Fatalf("expected normalized archive entry path %q, got %q", want, got)
	}
}

func TestNormalizePolicySessionSnapshotTrimsHistoryAndClampsIndex(t *testing.T) {
	snapshot := normalizePolicySessionSnapshot(explorerPolicySessionSnapshot{
		CurrentPath: " /Users/alice/Documents ",
		History: []string{
			" / ",
			"",
			" /Users ",
			" /Users/alice/Documents ",
		},
		HistoryIdx: 99,
	})

	if got, want := snapshot.CurrentPath, "/Users/alice/Documents"; got != want {
		t.Fatalf("expected current path %q, got %q", want, got)
	}
	if got, want := len(snapshot.History), 3; got != want {
		t.Fatalf("expected trimmed history length %d, got %d", want, got)
	}
	if got, want := snapshot.HistoryIdx, 2; got != want {
		t.Fatalf("expected clamped history index %d, got %d", want, got)
	}
}
