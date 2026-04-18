import {
  AlertTriangle,
  ArrowRight,
  Edit3,
  Highlighter,
  Loader,
  MousePointer2,
  Save,
  Square,
  Signature,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { matchesKeybinding } from '../config/hotkeys';
import {
  cancelPendingExplorerPdfPreviewDocumentClose,
  renderExplorerPdfPreviewPage,
  scheduleExplorerPdfPreviewDocumentClose,
  saveExplorerPdfPreviewEdits,
  type ExplorerPdfColorValue,
  type ExplorerPdfFormFieldDescriptor,
  type ExplorerPdfOverlayAnnotation,
  type ExplorerPdfOverlayAnnotationKind,
  type ExplorerPdfPageRect,
  type ExplorerPdfPageRenderFitMode,
  type ExplorerPdfPreviewDocument,
  type ExplorerPdfSaveEditsOutput,
} from '../runtime/pdfPreviewBackend';
import { useSettingsStore } from '../store/settingsStore';
import { AppDialogFrame, AppPromptDialog } from './AppModal';

type ExplorerPdfWorkbenchProps = {
  document: ExplorerPdfPreviewDocument;
  onSaved?: (output: ExplorerPdfSaveEditsOutput) => Promise<void> | void;
  onDocumentChange?: (document: ExplorerPdfPreviewDocument) => void;
  onChromeStateChange?: (state: ExplorerPdfWorkbenchChromeState) => void;
  onControllerChange?: (controller: ExplorerPdfWorkbenchController | null) => void;
  onRegisterCloseGuard?: (guard: (() => Promise<boolean>) | null) => void;
};

export interface ExplorerPdfWorkbenchController {
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  goToPage: (pageIndex: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setFitMode: (mode: ExplorerPdfPageRenderFitMode) => void;
  toggleEditMode: () => void;
  save: () => Promise<boolean>;
}

export interface ExplorerPdfWorkbenchChromeState {
  activePageIndex: number;
  pageCount: number;
  zoomScale: number;
  fitMode: ExplorerPdfPageRenderFitMode;
  isEditMode: boolean;
  isDirty: boolean;
  isSaving: boolean;
  error: string | null;
}

type PdfAnnotationTool =
  | 'select'
  | 'text'
  | 'rect'
  | 'highlight'
  | 'arrow'
  | 'signature';

type PdfFormValueDraft = {
  stringValue: string | null;
  boolValue: boolean | null;
  selectedValues: string[];
};

type PdfPointerDraft =
  | {
      tool: 'rect' | 'highlight' | 'arrow';
      pointerId: number;
      startPoint: { x: number; y: number };
      currentPoint: { x: number; y: number };
    }
  | {
      tool: 'signature';
      pointerId: number;
      points: Array<{ x: number; y: number }>;
    };

type PendingCloseResolution = {
  resolve: (shouldClose: boolean) => void;
};

const PDF_WORKBENCH_PADDING_PX = 24;
const PDF_MIN_RENDER_VIEWPORT_PX = 280;
const PDF_MIN_ZOOM_SCALE = 0.3;
const PDF_MAX_ZOOM_SCALE = 4;
const PDF_ZOOM_STEP = 0.15;
const PDF_DEFAULT_COLOR: ExplorerPdfColorValue = {
  red: 245,
  green: 158,
  blue: 11,
  alpha: 255,
};
const PDF_HIGHLIGHT_COLOR: ExplorerPdfColorValue = {
  red: 250,
  green: 204,
  blue: 21,
  alpha: 150,
};
const PDF_SIGNATURE_COLOR: ExplorerPdfColorValue = {
  red: 37,
  green: 99,
  blue: 235,
  alpha: 255,
};

const toolDefinitions: Array<{
  id: PdfAnnotationTool;
  label: string;
  icon: typeof MousePointer2;
}> = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'text', label: 'Text', icon: Edit3 },
  { id: 'rect', label: 'Rect', icon: Square },
  { id: 'highlight', label: 'Highlight', icon: Highlighter },
  { id: 'arrow', label: 'Arrow', icon: ArrowRight },
  { id: 'signature', label: 'Signature', icon: Signature },
];

function createInitialPdfFormDrafts(
  document: ExplorerPdfPreviewDocument,
): Record<string, PdfFormValueDraft> {
  return Object.fromEntries(
    document.formFields.map((field) => [
      field.fieldId,
      {
        stringValue: field.stringValue ?? null,
        boolValue: field.boolValue ?? null,
        selectedValues:
          field.selectedValues.length > 0
            ? [...field.selectedValues]
            : field.stringValue
              ? [field.stringValue]
              : [],
      },
    ]),
  );
}

function isEditableElement(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) {
    return false;
  }

  return (
    element.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON'].includes(element.tagName)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeRect(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number },
): ExplorerPdfPageRect {
  const x = Math.min(startPoint.x, endPoint.x);
  const y = Math.min(startPoint.y, endPoint.y);
  return {
    x,
    y,
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y),
  };
}

function getPdfColorCss(color: ExplorerPdfColorValue, alphaOverride?: number): string {
  const alpha =
    alphaOverride != null ? clamp(alphaOverride, 0, 1) : color.alpha / 255;
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${alpha})`;
}

function measureTextAnnotationBounds(
  x: number,
  y: number,
  text: string,
): ExplorerPdfPageRect {
  const lineCount = text.split('\n').length;
  const longestLine = text.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  return {
    x,
    y,
    width: Math.max(72, longestLine * 7.5),
    height: Math.max(18, lineCount * 16),
  };
}

function buildPdfAnnotationId(prefix: string, counter: number): string {
  return `${prefix}-${counter}`;
}

function computeAnnotationBoundsFromPoints(
  points: Array<{ x: number; y: number }>,
): ExplorerPdfPageRect {
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const left = Math.min(...xValues);
  const right = Math.max(...xValues);
  const top = Math.min(...yValues);
  const bottom = Math.max(...yValues);
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function annotationToolToOverlayKind(
  tool: Exclude<PdfAnnotationTool, 'select' | 'signature'> | 'signature',
): ExplorerPdfOverlayAnnotationKind {
  switch (tool) {
    case 'text':
      return 'text';
    case 'rect':
      return 'rect';
    case 'highlight':
      return 'highlight';
    case 'arrow':
      return 'arrow';
    case 'signature':
      return 'signature';
  }
}

export function ExplorerPdfWorkbench({
  document,
  onSaved,
  onDocumentChange,
  onChromeStateChange,
  onControllerChange,
  onRegisterCloseGuard,
}: ExplorerPdfWorkbenchProps) {
  const keybindings = useSettingsStore((state) => state.settings.keybindings);
  const [pdfDocument, setPdfDocument] = useState(document);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [fitMode, setFitMode] = useState<ExplorerPdfPageRenderFitMode>('fitWidth');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderImageDataUrl, setRenderImageDataUrl] = useState<string | null>(null);
  const [renderedWidthPx, setRenderedWidthPx] = useState(0);
  const [renderedHeightPx, setRenderedHeightPx] = useState(0);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [activeTool, setActiveTool] = useState<PdfAnnotationTool>('select');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [formValuesByFieldId, setFormValuesByFieldId] = useState<
    Record<string, PdfFormValueDraft>
  >(() => createInitialPdfFormDrafts(document));
  const [pageOverlaysByIndex, setPageOverlaysByIndex] = useState<
    Record<number, ExplorerPdfOverlayAnnotation[]>
  >({});
  const [pointerDraft, setPointerDraft] = useState<PdfPointerDraft | null>(null);
  const [textPromptState, setTextPromptState] = useState<{
    x: number;
    y: number;
    value: string;
  } | null>(null);
  const [showDirtyExitDialog, setShowDirtyExitDialog] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const annotationCounterRef = useRef(0);
  const renderRequestIdRef = useRef(0);
  const pendingCloseResolutionRef = useRef<PendingCloseResolution | null>(null);

  useEffect(() => {
    setPdfDocument(document);
    setActivePageIndex(0);
    setZoomScale(1);
    setFitMode('fitWidth');
    setIsEditMode(false);
    setIsDirty(false);
    setIsSaving(false);
    setError(null);
    setSelectedAnnotationId(null);
    setPointerDraft(null);
    setTextPromptState(null);
    setFormValuesByFieldId(createInitialPdfFormDrafts(document));
    setPageOverlaysByIndex({});
  }, [document]);

  useEffect(() => {
    const viewportElement = viewportRef.current;
    if (!viewportElement) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) {
        return;
      }
      setViewportSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    });

    observer.observe(viewportElement);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sessionId = pdfDocument.sessionId;
    cancelPendingExplorerPdfPreviewDocumentClose(sessionId);
    rootRef.current?.focus();

    return () => {
      pendingCloseResolutionRef.current?.resolve(false);
      pendingCloseResolutionRef.current = null;
      scheduleExplorerPdfPreviewDocumentClose(sessionId);
    };
  }, [pdfDocument.sessionId]);

  const activePage =
    pdfDocument.pages[clamp(activePageIndex, 0, Math.max(0, pdfDocument.pages.length - 1))];
  const activePageFormFields = useMemo(
    () => pdfDocument.formFields.filter((field) => field.pageIndex === activePageIndex),
    [activePageIndex, pdfDocument.formFields],
  );
  const activePageOverlays = pageOverlaysByIndex[activePageIndex] ?? [];
  const pageScaleX =
    activePage && renderedWidthPx > 0
      ? renderedWidthPx / activePage.widthPoints
      : 1;
  const pageScaleY =
    activePage && renderedHeightPx > 0
      ? renderedHeightPx / activePage.heightPoints
      : 1;

  const chromeState = useMemo<ExplorerPdfWorkbenchChromeState>(
    () => ({
      activePageIndex,
      pageCount: pdfDocument.pageCount,
      zoomScale,
      fitMode,
      isEditMode,
      isDirty,
      isSaving,
      error,
    }),
    [activePageIndex, error, fitMode, isDirty, isEditMode, isSaving, pdfDocument.pageCount, zoomScale],
  );

  useEffect(() => {
    onChromeStateChange?.(chromeState);
  }, [chromeState, onChromeStateChange]);

  const clearTransientStageState = useCallback(() => {
    setSelectedAnnotationId(null);
    setPointerDraft(null);
    setTextPromptState(null);
  }, []);

  const goToPage = useCallback(
    (pageIndex: number) => {
      setActivePageIndex(clamp(pageIndex, 0, Math.max(0, pdfDocument.pageCount - 1)));
      clearTransientStageState();
    },
    [clearTransientStageState, pdfDocument.pageCount],
  );

  const goToPreviousPage = useCallback(() => {
    goToPage(activePageIndex - 1);
  }, [activePageIndex, goToPage]);

  const goToNextPage = useCallback(() => {
    goToPage(activePageIndex + 1);
  }, [activePageIndex, goToPage]);

  const zoomIn = useCallback(() => {
    setFitMode('none');
    setZoomScale((current) => clamp(current + PDF_ZOOM_STEP, PDF_MIN_ZOOM_SCALE, PDF_MAX_ZOOM_SCALE));
  }, []);

  const zoomOut = useCallback(() => {
    setFitMode('none');
    setZoomScale((current) => clamp(current - PDF_ZOOM_STEP, PDF_MIN_ZOOM_SCALE, PDF_MAX_ZOOM_SCALE));
  }, []);

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setError(null);
  }, []);

  const commitFormValue = useCallback(
    (fieldId: string, nextDraft: PdfFormValueDraft) => {
      setFormValuesByFieldId((current) => ({
        ...current,
        [fieldId]: nextDraft,
      }));
      markDirty();
    },
    [markDirty],
  );

  const replaceActivePageOverlays = useCallback(
    (
      recipe: (
        current: ExplorerPdfOverlayAnnotation[],
      ) => ExplorerPdfOverlayAnnotation[],
    ) => {
      setPageOverlaysByIndex((current) => ({
        ...current,
        [activePageIndex]: recipe(current[activePageIndex] ?? []),
      }));
      markDirty();
    },
    [activePageIndex, markDirty],
  );

  const savePdfEdits = useCallback(async (): Promise<boolean> => {
    if (isSaving) {
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const saveResult = await saveExplorerPdfPreviewEdits({
        sessionId: pdfDocument.sessionId,
        formUpdates: pdfDocument.formFields.map((field) => {
          const draft = formValuesByFieldId[field.fieldId] ?? {
            stringValue: field.stringValue ?? null,
            boolValue: field.boolValue ?? null,
            selectedValues: field.selectedValues,
          };
          return {
            fieldId: field.fieldId,
            stringValue: draft.stringValue,
            boolValue: draft.boolValue,
            selectedValues: draft.selectedValues,
          };
        }),
        pageOverlays: Object.entries(pageOverlaysByIndex).map(([pageIndex, annotations]) => ({
          pageIndex: Number(pageIndex),
          annotations,
        })),
      });

      setPdfDocument(saveResult.document);
      setIsDirty(false);
      setError(null);
      onDocumentChange?.(saveResult.document);
      await onSaved?.(saveResult);
      return true;
    } catch (saveError) {
      setError(String(saveError));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    formValuesByFieldId,
    isSaving,
    onDocumentChange,
    onSaved,
    pageOverlaysByIndex,
    pdfDocument.formFields,
    pdfDocument.sessionId,
  ]);

  const requestCloseGuard = useCallback(async (): Promise<boolean> => {
    if (!isDirty) {
      return true;
    }

    return await new Promise<boolean>((resolve) => {
      pendingCloseResolutionRef.current?.resolve(false);
      pendingCloseResolutionRef.current = { resolve };
      setShowDirtyExitDialog(true);
    });
  }, [isDirty]);

  useEffect(() => {
    onRegisterCloseGuard?.(requestCloseGuard);
  }, [onRegisterCloseGuard, requestCloseGuard]);

  useEffect(
    () => () => {
      onRegisterCloseGuard?.(null);
    },
    [onRegisterCloseGuard],
  );

  const toggleEditMode = useCallback(() => {
    setIsEditMode((current) => !current);
  }, []);

  const controller = useMemo<ExplorerPdfWorkbenchController>(
    () => ({
      goToPreviousPage,
      goToNextPage,
      goToPage,
      zoomIn,
      zoomOut,
      setFitMode,
      toggleEditMode,
      save: savePdfEdits,
    }),
    [
      goToNextPage,
      goToPage,
      goToPreviousPage,
      savePdfEdits,
      toggleEditMode,
      zoomIn,
      zoomOut,
    ],
  );

  useEffect(() => {
    onControllerChange?.(controller);
  }, [controller, onControllerChange]);

  useEffect(
    () => () => {
      onControllerChange?.(null);
    },
    [onControllerChange],
  );

  useEffect(() => {
    if (!activePage || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }

    const requestId = renderRequestIdRef.current + 1;
    renderRequestIdRef.current = requestId;
    setIsRendering(true);
    setError(null);

    void renderExplorerPdfPreviewPage({
      sessionId: pdfDocument.sessionId,
      pageIndex: activePageIndex,
      zoomScale,
      fitMode,
      viewportWidthPx: Math.max(
        PDF_MIN_RENDER_VIEWPORT_PX,
        viewportSize.width - PDF_WORKBENCH_PADDING_PX * 2,
      ),
      viewportHeightPx: Math.max(
        PDF_MIN_RENDER_VIEWPORT_PX,
        viewportSize.height - PDF_WORKBENCH_PADDING_PX * 2,
      ),
    })
      .then((result) => {
        if (renderRequestIdRef.current !== requestId) {
          return;
        }
        setRenderImageDataUrl(result.imageDataUrl);
        setRenderedWidthPx(result.renderedWidthPx);
        setRenderedHeightPx(result.renderedHeightPx);
      })
      .catch((renderError) => {
        if (renderRequestIdRef.current !== requestId) {
          return;
        }
        setError(String(renderError));
      })
      .finally(() => {
        if (renderRequestIdRef.current === requestId) {
          setIsRendering(false);
        }
      });
  }, [
    activePage,
    activePageIndex,
    fitMode,
    pdfDocument.sessionId,
    viewportSize.height,
    viewportSize.width,
    zoomScale,
  ]);

  const pagePointFromPointerEvent = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const stageElement = stageRef.current;
      if (!stageElement || !activePage) {
        return null;
      }

      const rect = stageElement.getBoundingClientRect();
      const localX = clamp(event.clientX - rect.left, 0, rect.width);
      const localY = clamp(event.clientY - rect.top, 0, rect.height);
      return {
        x: localX / pageScaleX,
        y: localY / pageScaleY,
      };
    },
    [activePage, pageScaleX, pageScaleY],
  );

  const annotationStyleFromPageRect = useCallback(
    (rect: ExplorerPdfPageRect): CSSProperties => ({
      left: rect.x * pageScaleX,
      top: rect.y * pageScaleY,
      width: rect.width * pageScaleX,
      height: rect.height * pageScaleY,
    }),
    [pageScaleX, pageScaleY],
  );

  const selectAnnotationAtPoint = useCallback(
    (pageX: number, pageY: number) => {
      const nextSelection =
        [...activePageOverlays]
          .reverse()
          .find((annotation) => {
            const withinX =
              pageX >= annotation.bounds.x &&
              pageX <= annotation.bounds.x + annotation.bounds.width;
            const withinY =
              pageY >= annotation.bounds.y &&
              pageY <= annotation.bounds.y + annotation.bounds.height;
            return withinX && withinY;
          })?.id ?? null;
      setSelectedAnnotationId(nextSelection);
    },
    [activePageOverlays],
  );

  const pushOverlayAnnotation = useCallback(
    (annotation: ExplorerPdfOverlayAnnotation) => {
      replaceActivePageOverlays((current) => [...current, annotation]);
      setSelectedAnnotationId(annotation.id);
    },
    [replaceActivePageOverlays],
  );

  const handleStagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isEditMode || !activePage || isEditableElement(event.target)) {
        return;
      }

      const pagePoint = pagePointFromPointerEvent(event);
      if (!pagePoint) {
        return;
      }

      if (activeTool === 'select') {
        selectAnnotationAtPoint(pagePoint.x, pagePoint.y);
        return;
      }

      if (activeTool === 'text') {
        setTextPromptState({ x: pagePoint.x, y: pagePoint.y, value: '' });
        return;
      }

      event.preventDefault();
      if (activeTool === 'signature') {
        setPointerDraft({
          tool: 'signature',
          pointerId: event.pointerId,
          points: [pagePoint],
        });
      } else {
        setPointerDraft({
          tool: activeTool,
          pointerId: event.pointerId,
          startPoint: pagePoint,
          currentPoint: pagePoint,
        });
      }
    },
    [
      activePage,
      activeTool,
      isEditMode,
      pagePointFromPointerEvent,
      selectAnnotationAtPoint,
    ],
  );

  const handleStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointerDraft || pointerDraft.pointerId !== event.pointerId) {
        return;
      }

      const pagePoint = pagePointFromPointerEvent(event);
      if (!pagePoint) {
        return;
      }

      if (pointerDraft.tool === 'signature') {
        setPointerDraft({
          ...pointerDraft,
          points: [...pointerDraft.points, pagePoint],
        });
        return;
      }

      setPointerDraft({
        ...pointerDraft,
        currentPoint: pagePoint,
      });
    },
    [pagePointFromPointerEvent, pointerDraft],
  );

  const handleStagePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pointerDraft || pointerDraft.pointerId !== event.pointerId) {
        return;
      }

      if (pointerDraft.tool === 'signature') {
        if (pointerDraft.points.length >= 2) {
          annotationCounterRef.current += 1;
          pushOverlayAnnotation({
            id: buildPdfAnnotationId('signature', annotationCounterRef.current),
            kind: 'signature',
            bounds: computeAnnotationBoundsFromPoints(pointerDraft.points),
            points: pointerDraft.points,
            text: null,
            color: PDF_SIGNATURE_COLOR,
            strokeWidth: 2.5,
            opacity: 1,
          });
        }
        setPointerDraft(null);
        return;
      }

      const draftBounds = normalizeRect(
        pointerDraft.startPoint,
        pointerDraft.currentPoint,
      );
      setPointerDraft(null);

      if (draftBounds.width < 2 && draftBounds.height < 2) {
        return;
      }

      annotationCounterRef.current += 1;
      pushOverlayAnnotation({
        id: buildPdfAnnotationId(pointerDraft.tool, annotationCounterRef.current),
        kind: annotationToolToOverlayKind(pointerDraft.tool),
        bounds: draftBounds,
        points:
          pointerDraft.tool === 'arrow'
            ? [pointerDraft.startPoint, pointerDraft.currentPoint]
            : [],
        text: null,
        color:
          pointerDraft.tool === 'highlight'
            ? PDF_HIGHLIGHT_COLOR
            : PDF_DEFAULT_COLOR,
        strokeWidth: pointerDraft.tool === 'highlight' ? 1 : 2,
        opacity: pointerDraft.tool === 'highlight' ? 0.4 : 1,
      });
    },
    [pointerDraft, pushOverlayAnnotation],
  );

  const handleTextPromptSubmit = useCallback(() => {
    if (!textPromptState?.value.trim()) {
      setTextPromptState(null);
      return;
    }

    annotationCounterRef.current += 1;
    const textValue = textPromptState.value.trim();
    pushOverlayAnnotation({
      id: buildPdfAnnotationId('text', annotationCounterRef.current),
      kind: 'text',
      bounds: measureTextAnnotationBounds(
        textPromptState.x,
        textPromptState.y,
        textValue,
      ),
      points: [],
      text: textValue,
      color: PDF_DEFAULT_COLOR,
      strokeWidth: 0,
      opacity: 1,
    });
    setTextPromptState(null);
  }, [pushOverlayAnnotation, textPromptState]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (showDirtyExitDialog) {
        return;
      }

      if (
        matchesKeybinding(event.nativeEvent, keybindings.saveFile) &&
        (isDirty || isEditMode)
      ) {
        event.preventDefault();
        void savePdfEdits();
        return;
      }

      if (isEditableElement(event.target)) {
        return;
      }

      if (matchesKeybinding(event.nativeEvent, keybindings.pdfWorkbenchPreviousPage)) {
        event.preventDefault();
        goToPreviousPage();
        return;
      }
      if (matchesKeybinding(event.nativeEvent, keybindings.pdfWorkbenchNextPage)) {
        event.preventDefault();
        goToNextPage();
        return;
      }
      if (matchesKeybinding(event.nativeEvent, keybindings.pdfWorkbenchZoomIn)) {
        event.preventDefault();
        zoomIn();
        return;
      }
      if (matchesKeybinding(event.nativeEvent, keybindings.pdfWorkbenchZoomOut)) {
        event.preventDefault();
        zoomOut();
        return;
      }
      if (matchesKeybinding(event.nativeEvent, keybindings.pdfWorkbenchToggleEditMode)) {
        event.preventDefault();
        toggleEditMode();
        return;
      }

      if (
        selectedAnnotationId &&
        (event.key === 'Delete' || event.key === 'Backspace')
      ) {
        event.preventDefault();
        replaceActivePageOverlays((current) =>
          current.filter((annotation) => annotation.id !== selectedAnnotationId),
        );
        setSelectedAnnotationId(null);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedAnnotationId(null);
        setPointerDraft(null);
        setTextPromptState(null);
      }
    },
    [
      goToNextPage,
      goToPreviousPage,
      isDirty,
      isEditMode,
      keybindings.pdfWorkbenchNextPage,
      keybindings.pdfWorkbenchPreviousPage,
      keybindings.pdfWorkbenchToggleEditMode,
      keybindings.pdfWorkbenchZoomIn,
      keybindings.pdfWorkbenchZoomOut,
      keybindings.saveFile,
      replaceActivePageOverlays,
      savePdfEdits,
      selectedAnnotationId,
      showDirtyExitDialog,
      toggleEditMode,
      zoomIn,
      zoomOut,
    ],
  );

  const liveDraftAnnotation = useMemo<ExplorerPdfOverlayAnnotation | null>(() => {
    if (!pointerDraft) {
      return null;
    }

    if (pointerDraft.tool === 'signature') {
      if (pointerDraft.points.length < 2) {
        return null;
      }
      return {
        id: '__draft-signature__',
        kind: 'signature',
        bounds: computeAnnotationBoundsFromPoints(pointerDraft.points),
        points: pointerDraft.points,
        text: null,
        color: PDF_SIGNATURE_COLOR,
        strokeWidth: 2.5,
        opacity: 1,
      };
    }

    const bounds = normalizeRect(pointerDraft.startPoint, pointerDraft.currentPoint);
    if (bounds.width < 1 && bounds.height < 1) {
      return null;
    }

    return {
      id: '__draft-overlay__',
      kind: annotationToolToOverlayKind(pointerDraft.tool),
      bounds,
      points:
        pointerDraft.tool === 'arrow'
          ? [pointerDraft.startPoint, pointerDraft.currentPoint]
          : [],
      text: null,
      color: pointerDraft.tool === 'highlight' ? PDF_HIGHLIGHT_COLOR : PDF_DEFAULT_COLOR,
      strokeWidth: pointerDraft.tool === 'highlight' ? 1 : 2,
      opacity: pointerDraft.tool === 'highlight' ? 0.4 : 1,
    };
  }, [pointerDraft]);

  const allVisibleAnnotations = useMemo(
    () => (liveDraftAnnotation ? [...activePageOverlays, liveDraftAnnotation] : activePageOverlays),
    [activePageOverlays, liveDraftAnnotation],
  );

  const renderFormField = useCallback(
    (field: ExplorerPdfFormFieldDescriptor) => {
      const fieldStyle = annotationStyleFromPageRect(field.rect);
      const currentValue = formValuesByFieldId[field.fieldId] ?? {
        stringValue: field.stringValue ?? null,
        boolValue: field.boolValue ?? null,
        selectedValues: field.selectedValues,
      };
      const commonStyle: CSSProperties = {
        position: 'absolute',
        ...fieldStyle,
        fontSize: 12,
        padding: field.kind === 'checkbox' || field.kind === 'radio' ? 0 : '2px 4px',
        borderRadius: 4,
        border: isEditMode
          ? '1px solid rgba(250, 204, 21, 0.8)'
          : '1px solid rgba(255,255,255,0.1)',
        background: isEditMode
          ? 'rgba(15,23,42,0.7)'
          : 'rgba(15,23,42,0.45)',
        color: 'rgba(255,255,255,0.92)',
        outline: 'none',
        boxSizing: 'border-box',
      };

      if (field.kind === 'checkbox') {
        return (
          <input
            data-pdf-form-field="true"
            key={field.fieldId}
            type="checkbox"
            checked={Boolean(currentValue.boolValue)}
            disabled={!isEditMode || field.readOnly}
            title={field.fieldName}
            onChange={(event) =>
              commitFormValue(field.fieldId, {
                stringValue:
                  event.target.checked
                    ? field.widgetExportValue ?? field.fieldName
                    : 'Off',
                boolValue: event.target.checked,
                selectedValues: [],
              })
            }
            style={{ ...commonStyle, cursor: isEditMode ? 'pointer' : 'default' }}
          />
        );
      }

      if (field.kind === 'radio') {
        return (
          <input
            data-pdf-form-field="true"
            key={field.fieldId}
            type="radio"
            name={`pdf-radio-${field.fieldName}`}
            checked={Boolean(currentValue.boolValue)}
            disabled={!isEditMode || field.readOnly}
            title={field.fieldName}
            onChange={(event) => {
              if (!event.target.checked) {
                return;
              }

              setFormValuesByFieldId((current) => {
                const next = { ...current };
                for (const siblingField of pdfDocument.formFields) {
                  if (
                    siblingField.kind === 'radio' &&
                    siblingField.fieldName === field.fieldName
                  ) {
                    next[siblingField.fieldId] = {
                      stringValue:
                        siblingField.fieldId === field.fieldId
                          ? field.widgetExportValue ?? field.fieldName
                          : 'Off',
                      boolValue: siblingField.fieldId === field.fieldId,
                      selectedValues: [],
                    };
                  }
                }
                return next;
              });
              markDirty();
            }}
            style={{ ...commonStyle, cursor: isEditMode ? 'pointer' : 'default' }}
          />
        );
      }

      if (field.kind === 'multiline') {
        return (
          <textarea
            data-pdf-form-field="true"
            key={field.fieldId}
            value={currentValue.stringValue ?? ''}
            disabled={!isEditMode || field.readOnly}
            title={field.fieldName}
            onChange={(event) =>
              commitFormValue(field.fieldId, {
                stringValue: event.target.value,
                boolValue: null,
                selectedValues: event.target.value ? [event.target.value] : [],
              })
            }
            style={{ ...commonStyle, resize: 'none' }}
          />
        );
      }

      if (field.kind === 'dropdown' || field.kind === 'listbox') {
        return (
          <select
            data-pdf-form-field="true"
            key={field.fieldId}
            value={currentValue.stringValue ?? ''}
            size={field.kind === 'listbox' ? Math.min(4, Math.max(2, field.options.length)) : undefined}
            disabled={!isEditMode || field.readOnly}
            title={field.fieldName}
            onChange={(event) =>
              commitFormValue(field.fieldId, {
                stringValue: event.target.value,
                boolValue: null,
                selectedValues: event.target.value ? [event.target.value] : [],
              })
            }
            style={commonStyle}
          >
            {field.kind === 'dropdown' && <option value="">Select…</option>}
            {field.options.map((option) => (
              <option key={`${field.fieldId}-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }

      return (
        <input
          data-pdf-form-field="true"
          key={field.fieldId}
          type="text"
          value={currentValue.stringValue ?? ''}
          disabled={!isEditMode || field.readOnly}
          title={field.fieldName}
          onChange={(event) =>
            commitFormValue(field.fieldId, {
              stringValue: event.target.value,
              boolValue: null,
              selectedValues: event.target.value ? [event.target.value] : [],
            })
          }
          style={commonStyle}
        />
      );
    },
    [
      annotationStyleFromPageRect,
      commitFormValue,
      formValuesByFieldId,
      isEditMode,
      markDirty,
      pdfDocument.formFields,
    ],
  );

  const resolveDirtyExit = useCallback((shouldClose: boolean) => {
    pendingCloseResolutionRef.current?.resolve(shouldClose);
    pendingCloseResolutionRef.current = null;
    setShowDirtyExitDialog(false);
  }, []);

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(circle at top, rgba(30,41,59,0.72), rgba(2,6,23,0.95) 65%)',
        color: 'rgba(255,255,255,0.92)',
        outline: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(2,6,23,0.38)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              Page {activePageIndex + 1} / {pdfDocument.pageCount}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.56)' }}>
              {fitMode === 'fitWidth'
                ? 'Fit width'
                : fitMode === 'fitPage'
                  ? 'Fit page'
                  : `${Math.round(zoomScale * 100)}%`}
            </span>
            {isSaving ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: '#facc15',
                }}
              >
                <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />
                Saving…
              </span>
            ) : isDirty ? (
              <span style={{ fontSize: 11, color: '#f87171' }}>Unsaved</span>
            ) : (
              <span style={{ fontSize: 11, color: '#34d399' }}>Saved</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.56)' }}>
            {activePage
              ? `${activePage.widthPoints.toFixed(1)} × ${activePage.heightPoints.toFixed(1)} pt`
              : 'Loading page…'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => void savePdfEdits()}
            disabled={!isDirty || isSaving}
            style={toolButtonStyle(isDirty && !isSaving)}
          >
            <Save size={13} />
            Save
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'auto',
          padding: PDF_WORKBENCH_PADDING_PX,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {isEditMode && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 5,
              justifySelf: 'start',
              alignSelf: 'start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: 6,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(15,23,42,0.78)',
              boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(14px)',
            }}
          >
            {toolDefinitions.map((tool) => {
              const Icon = tool.icon;
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  title={tool.label}
                  onClick={() => setActiveTool(tool.id)}
                  style={toolPaletteButtonStyle(active)}
                >
                  <Icon size={13} />
                  {tool.label}
                </button>
              );
            })}
          </div>
        )}

        {!renderImageDataUrl && isRendering ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              gap: 10,
              minHeight: 240,
              color: 'rgba(255,255,255,0.56)',
            }}
          >
            <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Rendering page…
          </div>
        ) : (
          <div
            ref={stageRef}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            style={{
              position: 'relative',
              width: renderedWidthPx || 'auto',
              height: renderedHeightPx || 'auto',
              boxShadow: '0 22px 64px rgba(0,0,0,0.48)',
              borderRadius: 16,
              overflow: 'hidden',
              background: '#fff',
              touchAction: 'none',
            }}
          >
            {renderImageDataUrl ? (
              <img
                src={renderImageDataUrl}
                alt={`${pdfDocument.name} page ${activePageIndex + 1}`}
                style={{
                  display: 'block',
                  width: renderedWidthPx,
                  height: renderedHeightPx,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            ) : null}

            {activePageFormFields.map(renderFormField)}

            <svg
              width={renderedWidthPx}
              height={renderedHeightPx}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              <defs>
                <marker
                  id="pdf-workbench-arrow-head"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L8,4 L0,8 z" fill={getPdfColorCss(PDF_DEFAULT_COLOR)} />
                </marker>
              </defs>
              {allVisibleAnnotations.map((annotation) => {
                const isSelected = annotation.id === selectedAnnotationId;
                const strokeColor = getPdfColorCss(annotation.color);
                const fillColor =
                  annotation.kind === 'highlight'
                    ? getPdfColorCss(annotation.color, annotation.opacity ?? 0.4)
                    : 'transparent';

                if (annotation.kind === 'text') {
                  return (
                    <text
                      key={annotation.id}
                      x={annotation.bounds.x * pageScaleX}
                      y={(annotation.bounds.y + 14) * pageScaleY}
                      fill={strokeColor}
                      fontSize={14}
                      fontWeight={700}
                      stroke={isSelected ? '#facc15' : 'transparent'}
                      strokeWidth={isSelected ? 0.2 : 0}
                    >
                      {annotation.text}
                    </text>
                  );
                }

                if (annotation.kind === 'rect' || annotation.kind === 'highlight') {
                  return (
                    <rect
                      key={annotation.id}
                      x={annotation.bounds.x * pageScaleX}
                      y={annotation.bounds.y * pageScaleY}
                      width={annotation.bounds.width * pageScaleX}
                      height={annotation.bounds.height * pageScaleY}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : annotation.strokeWidth ?? 2}
                    />
                  );
                }

                if (annotation.kind === 'arrow' && annotation.points.length >= 2) {
                  const [startPoint, endPoint] = annotation.points;
                  return (
                    <line
                      key={annotation.id}
                      x1={startPoint.x * pageScaleX}
                      y1={startPoint.y * pageScaleY}
                      x2={endPoint.x * pageScaleX}
                      y2={endPoint.y * pageScaleY}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : annotation.strokeWidth ?? 2}
                      strokeLinecap="round"
                      markerEnd="url(#pdf-workbench-arrow-head)"
                    />
                  );
                }

                if (
                  annotation.kind === 'signature' &&
                  annotation.points.length >= 2
                ) {
                  return (
                    <polyline
                      key={annotation.id}
                      points={annotation.points
                        .map((point) => `${point.x * pageScaleX},${point.y * pageScaleY}`)
                        .join(' ')}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 3 : annotation.strokeWidth ?? 2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                }

                return null;
              })}
            </svg>

            {isEditMode && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  cursor:
                    activeTool === 'select'
                      ? 'default'
                      : activeTool === 'text'
                        ? 'text'
                        : 'crosshair',
                  background:
                    activeTool === 'highlight'
                      ? 'linear-gradient(transparent, transparent)'
                      : 'transparent',
                }}
              />
            )}
          </div>
        )}
      </div>

      {(error || isRendering) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '8px 14px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: 11,
            color: error ? '#fca5a5' : 'rgba(255,255,255,0.56)',
            background: 'rgba(2,6,23,0.48)',
          }}
        >
          <span>
            {error
              ? error
              : isRendering
                ? 'Rendering PDF page…'
                : 'Ready'}
          </span>
          <span>
            {activePageFormFields.length} forms · {activePageOverlays.length} annotations
          </span>
        </div>
      )}

      <AppPromptDialog
        open={Boolean(textPromptState)}
        title="Add PDF Text"
        description="Create a text overlay annotation on the current page."
        value={textPromptState?.value ?? ''}
        placeholder="Annotation text"
        submitLabel="Insert"
        onChange={(value) =>
          setTextPromptState((current) => (current ? { ...current, value } : current))
        }
        onSubmit={handleTextPromptSubmit}
        onCancel={() => setTextPromptState(null)}
      />

      {showDirtyExitDialog && (
        <AppDialogFrame
          title="Unsaved PDF edits"
          description="This PDF has unsaved form changes or annotations. Save before closing the preview?"
          icon={<AlertTriangle size={18} />}
          onClose={() => resolveDirtyExit(false)}
          closeOnBackdrop={false}
          actions={
            <>
              <button
                type="button"
                onClick={() => resolveDirtyExit(false)}
                style={dialogSecondaryButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => resolveDirtyExit(true)}
                style={dialogSecondaryButtonStyle}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => {
                  void savePdfEdits().then((saved) => resolveDirtyExit(saved));
                }}
                style={dialogPrimaryButtonStyle}
              >
                Save
              </button>
            </>
          }
        />
      )}
    </div>
  );
}

function toolButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 999,
    padding: '6px 10px',
    cursor: active ? 'pointer' : 'default',
    background: active ? 'rgba(37,99,235,0.18)' : 'rgba(255,255,255,0.04)',
    color: active ? '#dbeafe' : 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: 700,
  };
}

function toolPaletteButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: active
      ? '1px solid rgba(250,204,21,0.8)'
      : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: '6px 10px',
    cursor: 'pointer',
    background: active ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.03)',
    color: active ? '#fef08a' : 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: 700,
  };
}

const dialogPrimaryButtonStyle: CSSProperties = {
  border: '1px solid rgba(37,99,235,0.78)',
  borderRadius: 10,
  padding: '10px 14px',
  background: '#2563eb',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
};

const dialogSecondaryButtonStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '10px 14px',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.9)',
  cursor: 'pointer',
  fontWeight: 600,
};
