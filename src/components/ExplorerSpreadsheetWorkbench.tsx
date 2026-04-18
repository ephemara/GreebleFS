import {
  AlertTriangle,
  Loader2,
  Plus,
  Pencil,
  RefreshCcw,
  Save,
  Table2,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CompactSelection,
  DataEditor,
  GridCellKind,
  type DataEditorRef,
  type EditableGridCell,
  type EditListItem,
  type GridCell,
  type GridColumn,
  type GridSelection,
  type Item,
} from "@glideapps/glide-data-grid";
import XLSX from "xlsx";
import type { RawCellContent } from "hyperformula";
import { matchesKeybinding } from "../config/hotkeys";
import type { SpreadsheetFileKind } from "../config/spreadsheet";
import { AppConfirmDialog, AppDialogFrame, AppPromptDialog } from "./AppModal";
import {
  addSpreadsheetSheet,
  buildSpreadsheetWorkbookDocument,
  clearSpreadsheetSheet,
  deleteSpreadsheetSheet,
  exportSpreadsheetWorkbook,
  formatSpreadsheetCellDisplay,
  parseSpreadsheetInput,
  renameSpreadsheetSheet,
  serializeSpreadsheetCellForClipboard,
  type SpreadsheetWorkbookDocument,
} from "../runtime/spreadsheetWorkbook";
import {
  readExplorerFileBase64,
  readExplorerTextFile,
  writeExplorerFile,
} from "../runtime/explorerBackend";
import { useSettingsStore } from "../store/settingsStore";

type SpreadsheetCloseResolution = {
  resolve: (shouldClose: boolean) => void;
};

type SpreadsheetRenamePromptState = {
  sheetName: string;
  value: string;
};

type SpreadsheetDeletePromptState = {
  sheetName: string;
};

type SpreadsheetCellAddress = {
  col: number;
  row: number;
};

type ExplorerSpreadsheetWorkbenchProps = {
  path: string;
  name: string;
  sourceExtension: string;
  fileKind: SpreadsheetFileKind;
  onRefreshPreviewEntry?: () => void | Promise<void>;
  onRegisterCloseGuard?: (guard: (() => Promise<boolean>) | null) => void;
  onStatusChange?: (state: SpreadsheetWorkbenchStatus | null) => void;
};

type SpreadsheetWorkbenchStatus = {
  isDirty: boolean;
  isSaving: boolean;
};

const SPREADSHEET_MIN_COLUMNS = 26;
const SPREADSHEET_MIN_ROWS = 240;
const SPREADSHEET_COLUMN_WIDTH = 124;
const SPREADSHEET_HEADER_HEIGHT = 30;
const SPREADSHEET_ROW_HEIGHT = 28;
const SPREADSHEET_FORMULA_BAR_HEIGHT = 38;
const SPREADSHEET_GRID_THEME: Partial<import("@glideapps/glide-data-grid").Theme> = {
  accentColor: "#60a5fa",
  accentFg: "#020617",
  accentLight: "#3b82f6",
  bgBubble: "#111827",
  bgBubbleSelected: "#1d4ed8",
  bgCell: "rgba(15, 23, 42, 0.96)",
  bgCellMedium: "rgba(15, 23, 42, 0.90)",
  bgHeader: "rgba(15, 23, 42, 0.96)",
  bgHeaderHasFocus: "rgba(17, 24, 39, 0.98)",
  bgHeaderHovered: "rgba(30, 41, 59, 0.98)",
  bgIconHeader: "#cbd5e1",
  borderColor: "rgba(148, 163, 184, 0.16)",
  cellHorizontalPadding: 8,
  cellVerticalPadding: 5,
  drilldownBorder: "rgba(148, 163, 184, 0.2)",
  editorFontSize: "12px",
  fgIconHeader: "#e2e8f0",
  fontFamily: "Inter, system-ui, sans-serif",
  headerBottomBorderColor: "rgba(148, 163, 184, 0.18)",
  headerFontStyle: "600 11px Inter, system-ui, sans-serif",
  headerIconSize: 14,
  linkColor: "#93c5fd",
  lineHeight: 1.4,
  markerFontStyle: "600 11px Inter, system-ui, sans-serif",
  roundingRadius: 8,
  textBubble: "#e2e8f0",
  textDark: "#f8fafc",
  textGroupHeader: "#cbd5e1",
  textHeader: "#e2e8f0",
  textHeaderSelected: "#f8fafc",
  textLight: "#f8fafc",
  textMedium: "#cbd5e1",
};

export function ExplorerSpreadsheetWorkbench({
  path,
  name,
  sourceExtension,
  fileKind,
  onRefreshPreviewEntry,
  onRegisterCloseGuard,
  onStatusChange,
}: ExplorerSpreadsheetWorkbenchProps) {
  const keybindings = useSettingsStore((state) => state.settings.keybindings);
  const dataEditorRef = useRef<DataEditorRef | null>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const spreadsheetDocumentRef = useRef<SpreadsheetWorkbookDocument | null>(null);
  const loadSequenceRef = useRef(0);
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const selectedCellRef = useRef<SpreadsheetCellAddress>({ col: 0, row: 0 });
  const activeSheetNameRef = useRef<string>("");
  const pendingCloseResolutionRef = useRef<SpreadsheetCloseResolution | null>(null);

  const [spreadsheetDocument, setSpreadsheetDocument] =
    useState<SpreadsheetWorkbookDocument | null>(null);
  const [workbookVersion, setWorkbookVersion] = useState(0);
  const [activeSheetName, setActiveSheetName] = useState("");
  const [selectedCell, setSelectedCell] = useState<SpreadsheetCellAddress>({
    col: 0,
    row: 0,
  });
  const [gridSelection, setGridSelection] = useState<GridSelection>(() =>
    createSpreadsheetSelection({ col: 0, row: 0 }),
  );
  const [formulaBarValue, setFormulaBarValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [renamePrompt, setRenamePrompt] = useState<SpreadsheetRenamePromptState | null>(
    null,
  );
  const [deletePrompt, setDeletePrompt] = useState<SpreadsheetDeletePromptState | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [operationTone, setOperationTone] = useState<"muted" | "warning" | "error">(
    "muted",
  );

  const currentWorkbook = spreadsheetDocument?.workbook ?? null;
  const sheetNames = useMemo(
    () => currentWorkbook?.getSheetNames() ?? [],
    [currentWorkbook, workbookVersion],
  );

  const activeSheetId = useMemo(() => {
    if (!currentWorkbook) {
      return null;
    }

    try {
      return currentWorkbook.getSheetId(activeSheetName);
    } catch {
      return null;
    }
  }, [activeSheetName, currentWorkbook, workbookVersion]);

  const activeSheetDimensions = useMemo(() => {
    if (!currentWorkbook || activeSheetId == null) {
      return { width: 0, height: 0 };
    }
    return currentWorkbook.getSheetDimensions(activeSheetId);
  }, [activeSheetId, currentWorkbook, spreadsheetDocument, workbookVersion]);

  const activeSheetIndex = useMemo(
    () => sheetNames.indexOf(activeSheetName),
    [activeSheetName, sheetNames],
  );

  const activeCellLabel = useMemo(
    () => getSpreadsheetCellLabel(selectedCell),
    [selectedCell],
  );

  const activeSheetLabel = useMemo(() => {
    if (sheetNames.length === 0) {
      return "Sheet";
    }
    return `${activeSheetName || sheetNames[0] || "Sheet"} · ${activeSheetIndex + 1}/${sheetNames.length}`;
  }, [activeSheetIndex, activeSheetName, sheetNames]);

  const isWorkbookKind = fileKind === "workbook";
  const canAddSheet = isWorkbookKind;
  const canRenameSheet = isWorkbookKind && sheetNames.length > 0;
  const canDeleteSheet = sheetNames.length > 0;

  const viewColumnCount = Math.max(activeSheetDimensions.width + 6, SPREADSHEET_MIN_COLUMNS);
  const viewRowCount = Math.max(activeSheetDimensions.height + 24, SPREADSHEET_MIN_ROWS);

  useEffect(() => {
    const sequence = ++loadSequenceRef.current;
    setIsLoading(true);
    setLoadError(null);
    setOperationMessage(null);
    setOperationTone("muted");
    setShowCloseDialog(false);
    setRenamePrompt(null);
    setDeletePrompt(null);
    setIsSaving(false);
    setIsDirty(false);
    revisionRef.current = 0;
    savedRevisionRef.current = 0;

    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    pendingCloseResolutionRef.current?.resolve(false);
    pendingCloseResolutionRef.current = null;

    const previousDocument = spreadsheetDocumentRef.current;
    spreadsheetDocumentRef.current = null;
    previousDocument?.workbook.destroy();

    let cancelled = false;

    void (async () => {
      try {
        const workbook =
          fileKind === "tabular"
            ? XLSX.read(await readExplorerTextFile(path), {
                cellDates: true,
                type: "string",
              })
            : XLSX.read(stripDataUriPrefix(await readExplorerFileBase64(path)), {
                cellDates: true,
                type: "base64",
              });

        if (cancelled || sequence !== loadSequenceRef.current) {
          return;
        }

        const document = buildSpreadsheetWorkbookDocument(workbook, sourceExtension);
        if (cancelled || sequence !== loadSequenceRef.current) {
          document.workbook.destroy();
          return;
        }

        spreadsheetDocumentRef.current = document;
        setSpreadsheetDocument(document);
        const firstSheet = document.workbook.getSheetNames()[0] ?? "";
        activeSheetNameRef.current = firstSheet;
        selectedCellRef.current = { col: 0, row: 0 };
        setActiveSheetName(firstSheet);
        setSelectedCell({ col: 0, row: 0 });
        setGridSelection(createSpreadsheetSelection({ col: 0, row: 0 }));
        setFormulaBarValue("");
        setWorkbookVersion(0);
      } catch (error) {
        if (cancelled || sequence !== loadSequenceRef.current) {
          return;
        }
        setSpreadsheetDocument(null);
        setLoadError(String(error));
        setOperationMessage("Unable to load spreadsheet");
        setOperationTone("error");
      } finally {
        if (!cancelled && sequence === loadSequenceRef.current) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      const document = spreadsheetDocumentRef.current;
      spreadsheetDocumentRef.current = null;
      document?.workbook.destroy();
    };
  }, [fileKind, path, reloadToken, sourceExtension]);

  useEffect(() => {
    activeSheetNameRef.current = activeSheetName;
  }, [activeSheetName]);

  useEffect(() => {
    selectedCellRef.current = selectedCell;
  }, [selectedCell]);

  useEffect(() => {
    if (isLoading || loadError || !spreadsheetDocument) {
      onStatusChange?.(null);
      return;
    }

    onStatusChange?.({
      isDirty,
      isSaving,
    });
  }, [isDirty, isSaving, isLoading, loadError, onStatusChange, spreadsheetDocument]);

  useEffect(() => {
    return () => {
      onStatusChange?.(null);
    };
  }, [onStatusChange]);

  useEffect(() => {
    if (!currentWorkbook || activeSheetId == null) {
      return;
    }

    const clamped = clampSpreadsheetCell(selectedCellRef.current, {
      width: viewColumnCount,
      height: viewRowCount,
    });
    if (
      clamped.col !== selectedCellRef.current.col ||
      clamped.row !== selectedCellRef.current.row
    ) {
      selectSpreadsheetCell(clamped);
    }
  }, [
    activeSheetId,
    currentWorkbook,
    viewColumnCount,
    viewRowCount,
    workbookVersion,
  ]);

  useEffect(() => {
    if (!currentWorkbook || activeSheetId == null) {
      return;
    }

    const serializedValue = serializeSpreadsheetCellForClipboard(
      spreadsheetDocument!,
      activeSheetId,
      selectedCell.row,
      selectedCell.col,
    );
    setFormulaBarValue(serializedValue);
  }, [activeSheetId, selectedCell.col, selectedCell.row, spreadsheetDocument, workbookVersion]);

  const currentSheetName = useMemo(() => {
    if (activeSheetName) {
      return activeSheetName;
    }
    return sheetNames[0] ?? "";
  }, [activeSheetName, sheetNames]);

  const selectSpreadsheetCell = useCallback(
    (
      cell: SpreadsheetCellAddress,
      focusGrid = false,
      bounds: { width: number; height: number } = {
        width: viewColumnCount,
        height: viewRowCount,
      },
    ) => {
      const nextCell = clampSpreadsheetCell(cell, bounds);
      selectedCellRef.current = nextCell;
      setSelectedCell(nextCell);
      setGridSelection(createSpreadsheetSelection(nextCell));
      if (focusGrid) {
        dataEditorRef.current?.focus();
      }
    },
    [viewColumnCount, viewRowCount],
  );

  const queueSpreadsheetSave = useCallback(() => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void flushSpreadsheetSave();
    }, 700);
  }, []);

  const markSpreadsheetDirty = useCallback(() => {
    revisionRef.current += 1;
    setWorkbookVersion((value) => value + 1);
    setIsDirty(true);
    queueSpreadsheetSave();
  }, [queueSpreadsheetSave]);

  const applySpreadsheetMatrix = useCallback(
    (topLeft: Item, values: readonly (readonly RawCellContent[])[]) => {
      const document = spreadsheetDocumentRef.current;
      if (!document || activeSheetId == null) {
        return false;
      }

      document.workbook.setCellContents(
        { sheet: activeSheetId, row: topLeft[1], col: topLeft[0] },
        values as RawCellContent[][],
      );
      markSpreadsheetDirty();
      return true;
    },
    [activeSheetId, markSpreadsheetDirty],
  );

  const applySpreadsheetEditList = useCallback(
    (edits: readonly EditListItem[]) => {
      if (edits.length === 0) {
        return false;
      }

      if (edits.length === 1) {
        const edit = edits[0];
        return applySpreadsheetMatrix([edit.location[0], edit.location[1]], [[
          convertEditableGridCellToRawContent(edit.value),
        ]]);
      }

      const minCol = Math.min(...edits.map((edit) => edit.location[0]));
      const minRow = Math.min(...edits.map((edit) => edit.location[1]));
      const maxCol = Math.max(...edits.map((edit) => edit.location[0]));
      const maxRow = Math.max(...edits.map((edit) => edit.location[1]));
      const width = maxCol - minCol + 1;
      const height = maxRow - minRow + 1;

      if (width * height !== edits.length) {
        let applied = false;
        for (const edit of edits) {
          applied = applySpreadsheetMatrix(edit.location, [[
            convertEditableGridCellToRawContent(edit.value),
          ]]) || applied;
        }
        return applied;
      }

      const matrix: RawCellContent[][] = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => null),
      );

      for (const edit of edits) {
        const rowIndex = edit.location[1] - minRow;
        const colIndex = edit.location[0] - minCol;
        matrix[rowIndex]![colIndex] = convertEditableGridCellToRawContent(edit.value);
      }

      return applySpreadsheetMatrix([minCol, minRow], matrix);
    },
    [applySpreadsheetMatrix],
  );

  const saveSpreadsheetWorkbook = useCallback(async (): Promise<boolean> => {
    const document = spreadsheetDocumentRef.current;
    const sheetName = activeSheetNameRef.current || currentSheetName;
    if (!document || !sheetName) {
      return false;
    }

    if (saveInFlightRef.current) {
      await saveInFlightRef.current;
      return true;
    }

    const saveRevision = revisionRef.current;
    const savePromise = (async () => {
      setIsSaving(true);
      try {
        const content = exportSpreadsheetWorkbook(document, sheetName);
        await writeExplorerFile(path, content);
        savedRevisionRef.current = saveRevision;
        if (revisionRef.current === saveRevision) {
          setIsDirty(false);
        }
        setOperationMessage("Spreadsheet saved");
        setOperationTone("muted");
        setLoadError(null);
        await onRefreshPreviewEntry?.();
        return true;
      } catch (error) {
        setOperationMessage("Save failed");
        setOperationTone("error");
        return false;
      } finally {
        setIsSaving(false);
      }
    })();

    saveInFlightRef.current = savePromise;
    try {
      const result = await savePromise;
      return result;
    } finally {
      saveInFlightRef.current = null;
      if (revisionRef.current !== savedRevisionRef.current && !saveTimerRef.current) {
        queueSpreadsheetSave();
      }
    }
  }, [currentSheetName, onRefreshPreviewEntry, path, queueSpreadsheetSave]);

  const flushSpreadsheetSave = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    let attempts = 0;
    while (attempts < 3) {
      attempts += 1;
      const saved = await saveSpreadsheetWorkbook();
      if (!saved) {
        return false;
      }
      if (revisionRef.current === savedRevisionRef.current) {
        return true;
      }
    }
    return revisionRef.current === savedRevisionRef.current;
  }, [saveSpreadsheetWorkbook]);

  const requestCloseGuard = useCallback(async (): Promise<boolean> => {
    if (!isDirty && !isSaving) {
      return true;
    }

    return await new Promise<boolean>((resolve) => {
      pendingCloseResolutionRef.current?.resolve(false);
      pendingCloseResolutionRef.current = { resolve };
      setShowCloseDialog(true);
    });
  }, [isDirty, isSaving]);

  useEffect(() => {
    onRegisterCloseGuard?.(requestCloseGuard);
    return () => {
      onRegisterCloseGuard?.(null);
    };
  }, [onRegisterCloseGuard, requestCloseGuard]);

  const resolveCloseDialog = useCallback(
    (shouldClose: boolean) => {
      pendingCloseResolutionRef.current?.resolve(shouldClose);
      pendingCloseResolutionRef.current = null;
      setShowCloseDialog(false);
    },
    [],
  );

  const handleSelectionChange = useCallback(
    (selection: GridSelection) => {
      setGridSelection(selection);
      const cell = selection.current?.cell;
      if (!cell) {
        return;
      }
      selectSpreadsheetCell({ col: cell[0], row: cell[1] });
    },
    [selectSpreadsheetCell],
  );

  const handleCellEdit = useCallback(
    (edits: readonly EditListItem[]) => {
      return applySpreadsheetEditList(edits);
    },
    [applySpreadsheetEditList],
  );

  const handleDelete = useCallback(
    (selection: GridSelection) => {
      const range = selection.current?.range;
      if (!range || !currentWorkbook || activeSheetId == null) {
        return false;
      }

      const values: RawCellContent[][] = Array.from({ length: range.height }, () =>
        Array.from({ length: range.width }, () => null),
      );
      return applySpreadsheetMatrix([range.x, range.y], values);
    },
    [activeSheetId, applySpreadsheetMatrix, currentWorkbook],
  );

  const handlePaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      const parsedValues = values.map((row) => row.map((value) => parseSpreadsheetInput(value)));
      return applySpreadsheetMatrix(target, parsedValues);
    },
    [applySpreadsheetMatrix],
  );

  const handleFormulaBarCommit = useCallback(async () => {
    const document = spreadsheetDocumentRef.current;
    if (!document || activeSheetId == null) {
      return;
    }

    const nextValue = formulaBarValue;
    const currentValue = serializeSpreadsheetCellForClipboard(
      document,
      activeSheetId,
      selectedCell.row,
      selectedCell.col,
    );
    if (nextValue === currentValue) {
      return;
    }

    const rawValue = parseSpreadsheetInput(nextValue);
    const applied = applySpreadsheetMatrix(
      [selectedCell.col, selectedCell.row],
      [[rawValue]],
    );
    if (applied) {
      dataEditorRef.current?.focus();
    }
  }, [activeSheetId, applySpreadsheetMatrix, formulaBarValue, selectedCell.col, selectedCell.row]);

  const handleFormulaBarFocusFormula = useCallback(() => {
    const input = formulaInputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    input.select();
  }, []);

  const focusSpreadsheetGrid = useCallback(() => {
    dataEditorRef.current?.focus();
  }, []);

  const goToAdjacentSheet = useCallback(
    (offset: number) => {
      if (sheetNames.length <= 1) {
        return;
      }

      const currentIndex = Math.max(0, sheetNames.indexOf(activeSheetNameRef.current));
      const nextIndex =
        ((currentIndex + offset) % sheetNames.length + sheetNames.length) %
        sheetNames.length;
      const nextSheetName = sheetNames[nextIndex] ?? sheetNames[0];
      if (!nextSheetName || nextSheetName === activeSheetNameRef.current) {
        return;
      }

      const document = spreadsheetDocumentRef.current;
      if (!document) {
        return;
      }

      activeSheetNameRef.current = nextSheetName;
      setActiveSheetName(nextSheetName);
      const nextSheetId = document.workbook.getSheetId(nextSheetName);
      if (nextSheetId == null) {
        return;
      }
      const nextDimensions = document.workbook.getSheetDimensions(nextSheetId);
      const nextBounds = getSpreadsheetViewportBounds(nextDimensions);
      const nextCell = clampSpreadsheetCell(selectedCellRef.current, nextBounds);
      selectSpreadsheetCell(nextCell, false, nextBounds);
      focusSpreadsheetGrid();
    },
    [focusSpreadsheetGrid, selectSpreadsheetCell, sheetNames],
  );

  const createNewSheet = useCallback(() => {
    if (!isWorkbookKind) {
      setOperationMessage("CSV and TSV previews stay single-sheet");
      setOperationTone("warning");
      return;
    }

    const document = spreadsheetDocumentRef.current;
    if (!document) {
      return;
    }

    const nextSheetName = addSpreadsheetSheet(document);
    activeSheetNameRef.current = nextSheetName;
    setActiveSheetName(nextSheetName);
    selectedCellRef.current = { col: 0, row: 0 };
    setSelectedCell({ col: 0, row: 0 });
    setGridSelection(createSpreadsheetSelection({ col: 0, row: 0 }));
    revisionRef.current += 1;
    setWorkbookVersion((value) => value + 1);
    setIsDirty(true);
    queueSpreadsheetSave();
    setOperationMessage(`Added ${nextSheetName}`);
    setOperationTone("muted");
    focusSpreadsheetGrid();
  }, [focusSpreadsheetGrid, isWorkbookKind, queueSpreadsheetSave]);

  const openRenamePrompt = useCallback(() => {
    if (!canRenameSheet || !currentSheetName) {
      return;
    }
    setRenamePrompt({ sheetName: currentSheetName, value: currentSheetName });
  }, [canRenameSheet, currentSheetName]);

  const submitRenamePrompt = useCallback(() => {
    const document = spreadsheetDocumentRef.current;
    if (!document || !renamePrompt) {
      return;
    }

    const nextName = renamePrompt.value.trim();
    if (!nextName || nextName === renamePrompt.sheetName) {
      setRenamePrompt(null);
      return;
    }

    const nextSheetName = renameSpreadsheetSheet(
      document,
      renamePrompt.sheetName,
      nextName,
    );
    activeSheetNameRef.current = nextSheetName;
    setActiveSheetName(nextSheetName);
    setRenamePrompt(null);
    revisionRef.current += 1;
    setWorkbookVersion((value) => value + 1);
    setIsDirty(true);
    queueSpreadsheetSave();
    setOperationMessage(`Renamed to ${nextSheetName}`);
    setOperationTone("muted");
    focusSpreadsheetGrid();
  }, [focusSpreadsheetGrid, queueSpreadsheetSave, renamePrompt]);

  const openDeletePrompt = useCallback(() => {
    if (!canDeleteSheet || !currentSheetName) {
      return;
    }
    setDeletePrompt({ sheetName: currentSheetName });
  }, [canDeleteSheet, currentSheetName]);

  const submitDeletePrompt = useCallback(async () => {
    const document = spreadsheetDocumentRef.current;
    if (!document || !deletePrompt) {
      return;
    }

    const names = document.workbook.getSheetNames();
    if (names.length <= 1) {
      clearSpreadsheetSheet(document, deletePrompt.sheetName);
      selectedCellRef.current = { col: 0, row: 0 };
      setSelectedCell({ col: 0, row: 0 });
      setGridSelection(createSpreadsheetSelection({ col: 0, row: 0 }));
      setOperationMessage("Cleared the sheet");
    } else {
      const currentIndex = Math.max(0, names.indexOf(deletePrompt.sheetName));
      deleteSpreadsheetSheet(document, deletePrompt.sheetName);
      const nextNames = document.workbook.getSheetNames();
      const nextSheetName = nextNames[Math.min(currentIndex, nextNames.length - 1)] ?? nextNames[0];
      if (nextSheetName) {
        activeSheetNameRef.current = nextSheetName;
        setActiveSheetName(nextSheetName);
      }
      selectedCellRef.current = { col: 0, row: 0 };
      setSelectedCell({ col: 0, row: 0 });
      setGridSelection(createSpreadsheetSelection({ col: 0, row: 0 }));
      setOperationMessage(`Deleted ${deletePrompt.sheetName}`);
    }

    setDeletePrompt(null);
    revisionRef.current += 1;
    setWorkbookVersion((value) => value + 1);
    setIsDirty(true);
    queueSpreadsheetSave();
    setOperationTone("muted");
    focusSpreadsheetGrid();
    await Promise.resolve();
  }, [deletePrompt, focusSpreadsheetGrid, queueSpreadsheetSave]);

  const handleKeyDownCapture = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (showCloseDialog || renamePrompt || deletePrompt) {
        return;
      }

      if (matchesKeybinding(event.nativeEvent, keybindings.saveFile)) {
        event.preventDefault();
        void flushSpreadsheetSave();
        return;
      }

      if (
        matchesKeybinding(
          event.nativeEvent,
          keybindings.spreadsheetWorkbenchPreviousSheet,
        )
      ) {
        event.preventDefault();
        goToAdjacentSheet(-1);
        return;
      }

      if (matchesKeybinding(event.nativeEvent, keybindings.spreadsheetWorkbenchNextSheet)) {
        event.preventDefault();
        goToAdjacentSheet(1);
        return;
      }

      if (matchesKeybinding(event.nativeEvent, keybindings.spreadsheetWorkbenchNewSheet)) {
        event.preventDefault();
        createNewSheet();
        return;
      }

      if (
        matchesKeybinding(
          event.nativeEvent,
          keybindings.spreadsheetWorkbenchFocusFormulaBar,
        )
      ) {
        event.preventDefault();
        handleFormulaBarFocusFormula();
      }
    },
    [
      createNewSheet,
      deletePrompt,
      flushSpreadsheetSave,
      goToAdjacentSheet,
      handleFormulaBarFocusFormula,
      keybindings.saveFile,
      keybindings.spreadsheetWorkbenchFocusFormulaBar,
      keybindings.spreadsheetWorkbenchNewSheet,
      keybindings.spreadsheetWorkbenchNextSheet,
      keybindings.spreadsheetWorkbenchPreviousSheet,
      renamePrompt,
      showCloseDialog,
    ],
  );

  const columns = useMemo<GridColumn[]>(() => {
    return Array.from({ length: viewColumnCount }, (_, columnIndex) => ({
      id: `spreadsheet-col-${columnIndex}`,
      title: getSpreadsheetColumnLabel(columnIndex),
      width: SPREADSHEET_COLUMN_WIDTH,
    }));
  }, [viewColumnCount]);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      if (!spreadsheetDocument || activeSheetId == null) {
        return {
          allowOverlay: false,
          kind: GridCellKind.Loading,
          skeletonWidth: 48,
        };
      }

      const address = {
        sheet: activeSheetId,
        row: cell[1],
        col: cell[0],
      };
      const value = spreadsheetDocument.workbook.getCellValue(address);
      const detailedType = spreadsheetDocument.workbook.getCellValueDetailedType(address);
      const displayData = formatSpreadsheetCellDisplay(value, detailedType);
      const data = serializeSpreadsheetCellForClipboard(
        spreadsheetDocument,
        activeSheetId,
        cell[1],
        cell[0],
      );

      return {
        kind: GridCellKind.Text,
        allowOverlay: true,
        data,
        displayData,
        copyData: data,
        readonly: false,
        contentAlign: typeof value === "number" ? "right" : "left",
        allowWrapping: false,
      };
    },
    [activeSheetId, spreadsheetDocument, workbookVersion],
  );

  const handleReload = useCallback(() => {
    if (isDirty || isSaving) {
      setOperationMessage("Save or discard changes before reloading");
      setOperationTone("warning");
      return;
    }
    setReloadToken((current) => current + 1);
  }, [isDirty, isSaving]);

  const handleSaveClick = useCallback(() => {
    void flushSpreadsheetSave();
  }, [flushSpreadsheetSave]);

  const handleFormulaBarKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void handleFormulaBarCommit();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        const document = spreadsheetDocumentRef.current;
        if (!document || activeSheetId == null) {
          return;
        }
        setFormulaBarValue(
          serializeSpreadsheetCellForClipboard(
            document,
            activeSheetId,
            selectedCell.row,
            selectedCell.col,
          ),
        );
        focusSpreadsheetGrid();
      }
    },
    [activeSheetId, focusSpreadsheetGrid, handleFormulaBarCommit, selectedCell.col, selectedCell.row],
  );

  const activeSpreadsheetMessage = operationMessage ?? (isDirty ? "Unsaved changes" : "Saved");
  const activeSpreadsheetMessageTone =
    operationTone === "error"
      ? "#fca5a5"
      : operationTone === "warning"
        ? "#fbbf24"
        : isSaving
          ? "#f59e0b"
          : isDirty
            ? "#f97316"
            : "#34d399";

  if (isLoading) {
    return (
      <SpreadsheetShellFrame>
        <SpreadsheetStatusCard
          icon={<Loader2 size={18} />}
          title={`Opening ${name}`}
          detail={`Loading ${sourceExtension.toUpperCase()} spreadsheet preview...`}
        />
      </SpreadsheetShellFrame>
    );
  }

  if (loadError || !spreadsheetDocument) {
    return (
      <SpreadsheetShellFrame>
        <SpreadsheetStatusCard
          icon={<AlertTriangle size={18} />}
          title="Spreadsheet preview unavailable"
          detail={loadError ?? "Unable to build a spreadsheet session for this file."}
          actions={
            <>
        <button type="button" onClick={handleReload} style={spreadsheetSecondaryButtonStyle()}>
                <RefreshCcw size={14} />
                Retry
              </button>
            </>
          }
        />
      </SpreadsheetShellFrame>
    );
  }

  return (
    <div
      onKeyDownCapture={handleKeyDownCapture}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "100%",
        background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
        color: "var(--overlay-text-primary)",
      }}
    >
      <div style={spreadsheetHeaderStyle()}>
        <div style={spreadsheetHeaderIdentityStyle}>
          <Table2 size={15} />
          <div style={{ minWidth: 0 }}>
            <div style={spreadsheetHeaderTitleStyle}>{name}</div>
            <div style={spreadsheetHeaderSubtitleStyle}>
              {activeSheetLabel} · {sourceExtension.toUpperCase()}
            </div>
          </div>
        </div>
        <div style={spreadsheetToolbarStyle}>
          <StatusPill tone={isDirty ? "warning" : "success"}>
            {isSaving ? "Saving..." : isDirty ? "Unsaved" : "Saved"}
          </StatusPill>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={!isDirty || isSaving}
            style={spreadsheetPrimaryButtonStyle(!isDirty || isSaving)}
          >
            <Save size={14} />
            Save
          </button>
          <button type="button" onClick={handleReload} style={spreadsheetSecondaryButtonStyle()}>
            <RefreshCcw size={14} />
            Reload
          </button>
          <button
            type="button"
            onClick={createNewSheet}
            disabled={!canAddSheet}
            style={spreadsheetSecondaryButtonStyle(!canAddSheet)}
          >
            <Plus size={14} />
            New Sheet
          </button>
          <button
            type="button"
            onClick={openRenamePrompt}
            disabled={!canRenameSheet}
            style={spreadsheetSecondaryButtonStyle(!canRenameSheet)}
          >
            <Pencil size={14} />
            Rename
          </button>
          <button
            type="button"
            onClick={openDeletePrompt}
            disabled={!canDeleteSheet}
            style={spreadsheetDangerButtonStyle(!canDeleteSheet)}
          >
            <Trash2 size={14} />
            {sheetNames.length > 1 ? "Delete Sheet" : "Clear Sheet"}
          </button>
        </div>
      </div>

      <div style={spreadsheetFormulaBarStyle}>
        <div style={spreadsheetCellLabelStyle}>{activeCellLabel}</div>
        <div style={spreadsheetFormulaInputWrapStyle}>
          <span style={spreadsheetFormulaPrefixStyle}>fx</span>
          <input
            ref={formulaInputRef}
            value={formulaBarValue}
            onChange={(event) => setFormulaBarValue(event.target.value)}
            onBlur={() => {
              void handleFormulaBarCommit();
            }}
            onKeyDown={handleFormulaBarKeyDown}
            placeholder="Enter a value or formula"
            spellCheck={false}
            style={spreadsheetFormulaInputStyle}
          />
        </div>
      </div>

      <div style={spreadsheetTabBarStyle}>
        <div style={spreadsheetTabScrollerStyle}>
          {sheetNames.map((sheetName) => {
            const active = sheetName === activeSheetName;
            return (
              <button
                key={sheetName}
                type="button"
                onClick={() => {
                  if (sheetName === activeSheetName) {
                    focusSpreadsheetGrid();
                    return;
                  }
                  activeSheetNameRef.current = sheetName;
                  setActiveSheetName(sheetName);
                  const document = spreadsheetDocumentRef.current;
                  if (document) {
                    const nextSheetId = document.workbook.getSheetId(sheetName);
                    if (nextSheetId == null) {
                      focusSpreadsheetGrid();
                      return;
                    }
                    const nextDimensions = document.workbook.getSheetDimensions(nextSheetId);
                    const nextBounds = getSpreadsheetViewportBounds(nextDimensions);
                    const nextCell = clampSpreadsheetCell(selectedCellRef.current, nextBounds);
                    selectSpreadsheetCell(nextCell, false, nextBounds);
                  }
                  focusSpreadsheetGrid();
                }}
                onDoubleClick={() => {
                  if (canRenameSheet) {
                    setRenamePrompt({ sheetName, value: sheetName });
                  }
                }}
                title={canRenameSheet ? "Double-click to rename" : sheetName}
                style={spreadsheetTabButtonStyle(active)}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{sheetName}</span>
                {active ? <span style={spreadsheetActiveTabDotStyle} /> : null}
              </button>
            );
          })}
        </div>
        <div style={spreadsheetTabHintStyle}>
          <span>{activeSpreadsheetMessage}</span>
          <span>
            {sheetNames.length} sheet{sheetNames.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div style={spreadsheetGridShellStyle}>
        <DataEditor
          ref={dataEditorRef}
          width="100%"
          height="100%"
          columns={columns}
          rows={viewRowCount}
          getCellContent={getCellContent}
          getCellsForSelection={true}
          onCellsEdited={handleCellEdit}
          onDelete={handleDelete}
          onPaste={handlePaste}
          onGridSelectionChange={handleSelectionChange}
          gridSelection={gridSelection}
          rowMarkers="number"
          copyHeaders={false}
          editOnType={true}
          rowHeight={SPREADSHEET_ROW_HEIGHT}
          headerHeight={SPREADSHEET_HEADER_HEIGHT}
          minColumnWidth={72}
          maxColumnWidth={240}
          theme={SPREADSHEET_GRID_THEME}
          trailingRowOptions={{ sticky: true, hint: "New row" }}
          allowedFillDirections="orthogonal"
        />
      </div>

      <div style={spreadsheetFooterStyle}>
        <span>
          {activeSheetLabel} · {activeCellLabel}
        </span>
          <span style={{ color: activeSpreadsheetMessageTone }}>
            {isSaving ? "Saving..." : isDirty ? "Pending save" : "Saved"}
          </span>
      </div>

      {showCloseDialog && (
        <AppDialogFrame
          title="Unsaved spreadsheet changes"
          description="This spreadsheet has unsaved edits. Save before closing the preview?"
          icon={<AlertTriangle size={18} />}
          onClose={() => resolveCloseDialog(false)}
          closeOnBackdrop={false}
          actions={
            <>
              <button
                type="button"
                onClick={() => {
                  if (saveTimerRef.current != null) {
                    window.clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = null;
                  }
                  resolveCloseDialog(false);
                }}
                style={spreadsheetSecondaryButtonStyle()}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (saveTimerRef.current != null) {
                    window.clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = null;
                  }
                  setIsDirty(false);
                  resolveCloseDialog(true);
                }}
                style={spreadsheetSecondaryButtonStyle()}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => {
                  void flushSpreadsheetSave().then((saved) => {
                    if (saved) {
                      resolveCloseDialog(true);
                    }
                  });
                }}
                style={spreadsheetPrimaryButtonStyle(false)}
              >
                Save
              </button>
            </>
          }
        />
      )}

      <AppPromptDialog
        open={Boolean(renamePrompt)}
        title="Rename sheet"
        description="Give the active sheet a new name."
        icon={<Pencil size={18} />}
        value={renamePrompt?.value ?? ""}
        placeholder="Sheet name"
        submitLabel="Rename"
        onChange={(value) =>
          setRenamePrompt((current) => (current ? { ...current, value } : current))
        }
        onSubmit={() => {
          submitRenamePrompt();
        }}
        onCancel={() => setRenamePrompt(null)}
      />

      <AppConfirmDialog
        open={Boolean(deletePrompt)}
        title={sheetNames.length > 1 ? "Delete sheet" : "Clear sheet"}
        description={
          sheetNames.length > 1
            ? `Delete ${deletePrompt?.sheetName ?? "the current sheet"}?`
            : `Clear all cells on ${deletePrompt?.sheetName ?? "the current sheet"}?`
        }
        icon={<Trash2 size={18} />}
        confirmLabel={sheetNames.length > 1 ? "Delete" : "Clear"}
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => {
          void submitDeletePrompt();
        }}
        onCancel={() => setDeletePrompt(null)}
      />
    </div>
  );
}

function SpreadsheetShellFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100%",
        height: "100%",
        background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
      }}
    >
      {children}
    </div>
  );
}

function SpreadsheetStatusCard({
  icon,
  title,
  detail,
  actions,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <div
      style={{
        width: "min(560px, calc(100vw - 48px))",
        borderRadius: 18,
        border: "1px solid rgba(148, 163, 184, 0.18)",
        background: "rgba(15, 23, 42, 0.96)",
        boxShadow: "0 28px 80px rgba(0,0,0,0.35)",
        padding: 20,
        color: "#e2e8f0",
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background: "rgba(59, 130, 246, 0.14)",
            color: "#93c5fd",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: "#94a3b8" }}>{detail}</div>
        </div>
      </div>
      {actions ? <div style={{ display: "flex", gap: 8 }}>{actions}</div> : null}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "muted" | "error";
  children: ReactNode;
}) {
  const colors: Record<"success" | "warning" | "muted" | "error", { fg: string; bg: string; border: string }> = {
    success: {
      fg: "#86efac",
      bg: "rgba(22, 101, 52, 0.22)",
      border: "rgba(34, 197, 94, 0.3)",
    },
    warning: {
      fg: "#fbbf24",
      bg: "rgba(180, 83, 9, 0.22)",
      border: "rgba(245, 158, 11, 0.3)",
    },
    muted: {
      fg: "#cbd5e1",
      bg: "rgba(71, 85, 105, 0.24)",
      border: "rgba(148, 163, 184, 0.2)",
    },
    error: {
      fg: "#fca5a5",
      bg: "rgba(153, 27, 27, 0.24)",
      border: "rgba(248, 113, 113, 0.3)",
    },
  };

  const colorsForTone = colors[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${colorsForTone.border}`,
        background: colorsForTone.bg,
        color: colorsForTone.fg,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.2,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function createSpreadsheetSelection(cell: SpreadsheetCellAddress): GridSelection {
  return {
    current: {
      cell: [cell.col, cell.row] as Item,
      range: { x: cell.col, y: cell.row, width: 1, height: 1 },
      rangeStack: [],
    },
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  };
}

function clampSpreadsheetCell(
  cell: SpreadsheetCellAddress,
  dimensions: { width: number; height: number },
): SpreadsheetCellAddress {
  return {
    col: Math.max(0, Math.min(cell.col, Math.max(0, dimensions.width - 1))),
    row: Math.max(0, Math.min(cell.row, Math.max(0, dimensions.height - 1))),
  };
}

function getSpreadsheetViewportBounds(dimensions: { width: number; height: number }): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(dimensions.width + 6, SPREADSHEET_MIN_COLUMNS),
    height: Math.max(dimensions.height + 24, SPREADSHEET_MIN_ROWS),
  };
}

function getSpreadsheetColumnLabel(index: number): string {
  let remaining = Math.max(0, index);
  let label = "";
  do {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return label;
}

function getSpreadsheetCellLabel(cell: SpreadsheetCellAddress): string {
  return `${getSpreadsheetColumnLabel(cell.col)}${cell.row + 1}`;
}

function stripDataUriPrefix(dataUri: string): string {
  const commaIndex = dataUri.indexOf(",");
  return commaIndex >= 0 ? dataUri.slice(commaIndex + 1) : dataUri;
}

function convertEditableGridCellToRawContent(cell: EditableGridCell): RawCellContent {
  switch (cell.kind) {
    case GridCellKind.Text:
      return parseSpreadsheetInput(cell.data);
    case GridCellKind.Number:
      return typeof cell.data === "number" ? cell.data : null;
    case GridCellKind.Boolean:
      return typeof cell.data === "boolean" ? cell.data : null;
    case GridCellKind.Markdown:
    case GridCellKind.Uri:
      return cell.data;
    case GridCellKind.Image:
      return cell.data[0] ?? null;
    case GridCellKind.Custom:
      return cell.copyData;
    default:
      return null;
  }
}

function spreadsheetPrimaryButtonStyle(disabled = false): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: "none",
    borderRadius: 12,
    padding: "8px 12px",
    background: disabled ? "rgba(59, 130, 246, 0.16)" : "rgba(59, 130, 246, 0.94)",
    color: disabled ? "#bfdbfe" : "#eff6ff",
    fontSize: 11,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function spreadsheetSecondaryButtonStyle(disabled = false): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    border: "1px solid rgba(148, 163, 184, 0.18)",
    borderRadius: 12,
    padding: "8px 12px",
    background: "rgba(15, 23, 42, 0.9)",
    color: disabled ? "#94a3b8" : "#e2e8f0",
    fontSize: 11,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

function spreadsheetDangerButtonStyle(disabled = false): CSSProperties {
  return {
    ...spreadsheetSecondaryButtonStyle(disabled),
    border: "1px solid rgba(248, 113, 113, 0.2)",
    background: disabled ? "rgba(127, 29, 29, 0.22)" : "rgba(127, 29, 29, 0.32)",
    color: disabled ? "#fca5a5" : "#fecaca",
  };
}

function spreadsheetHeaderStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 14px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
    background: "rgba(15, 23, 42, 0.86)",
    flexShrink: 0,
  };
}

const spreadsheetHeaderIdentityStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const spreadsheetHeaderTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#f8fafc",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const spreadsheetHeaderSubtitleStyle: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  marginTop: 2,
};

const spreadsheetToolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const spreadsheetFormulaBarStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content minmax(0, 1fr)",
  gap: 10,
  alignItems: "center",
  padding: "10px 14px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
  background: "rgba(2, 6, 23, 0.88)",
  flexShrink: 0,
};

const spreadsheetCellLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 64,
  height: 30,
  padding: "0 10px",
  borderRadius: 10,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(15, 23, 42, 0.9)",
  color: "#cbd5e1",
  fontSize: 11,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
};

const spreadsheetFormulaInputWrapStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "max-content minmax(0, 1fr)",
  alignItems: "center",
  minWidth: 0,
  gap: 8,
  height: SPREADSHEET_FORMULA_BAR_HEIGHT,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background: "rgba(15, 23, 42, 0.9)",
};

const spreadsheetFormulaPrefixStyle: CSSProperties = {
  color: "#60a5fa",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.2,
  textTransform: "uppercase",
};

const spreadsheetFormulaInputStyle: CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#f8fafc",
  fontSize: 12,
  fontFamily: "Inter, system-ui, sans-serif",
  minWidth: 0,
};

const spreadsheetTabBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
  background: "rgba(15, 23, 42, 0.8)",
  flexShrink: 0,
};

const spreadsheetTabScrollerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  overflowX: "auto",
  paddingBottom: 2,
};

function spreadsheetTabButtonStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    border: active ? "1px solid rgba(96, 165, 250, 0.42)" : "1px solid rgba(148, 163, 184, 0.16)",
    background: active ? "rgba(30, 41, 59, 0.96)" : "rgba(15, 23, 42, 0.78)",
    color: active ? "#f8fafc" : "#cbd5e1",
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    maxWidth: 220,
    flexShrink: 0,
    boxShadow: active ? "0 10px 24px rgba(15, 23, 42, 0.28)" : "none",
  };
}

const spreadsheetActiveTabDotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "#60a5fa",
  flexShrink: 0,
};

const spreadsheetTabHintStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  color: "#94a3b8",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const spreadsheetGridShellStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  background: "rgba(2, 6, 23, 0.88)",
};

const spreadsheetFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 14px",
  borderTop: "1px solid rgba(148, 163, 184, 0.12)",
  background: "rgba(15, 23, 42, 0.86)",
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
};
