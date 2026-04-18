import type {
  PdfColorValue,
  PdfFormFieldDescriptor,
  PdfFormFieldKind,
  PdfFormFieldOptionDescriptor,
  PdfFormValueUpdate,
  PdfOverlayAnnotation,
  PdfOverlayAnnotationKind,
  PdfPageOverlayEdits,
  PdfPageRect,
  PdfPageRenderFitMode,
  PdfPageRenderRequest,
  PdfPageRenderResult,
  PdfPoint,
  PdfPreviewDocument,
  PdfPreviewPageDescriptor,
  PdfSaveEditsRequest,
  PdfSaveEditsResult,
} from '../generated/tauri';
import { commands, unwrapTauriResult } from './tauriClient';

export type ExplorerPdfPreviewDocument = PdfPreviewDocument;
export type ExplorerPdfPreviewPageDescriptor = PdfPreviewPageDescriptor;
export type ExplorerPdfPageRenderFitMode = PdfPageRenderFitMode;
export type ExplorerPdfPageRenderInput = PdfPageRenderRequest;
export type ExplorerPdfPageRenderOutput = PdfPageRenderResult;
export type ExplorerPdfFormFieldKind = PdfFormFieldKind;
export type ExplorerPdfFormFieldDescriptor = PdfFormFieldDescriptor;
export type ExplorerPdfFormFieldOptionDescriptor = PdfFormFieldOptionDescriptor;
export type ExplorerPdfFormValueUpdate = PdfFormValueUpdate;
export type ExplorerPdfPageOverlayEdits = PdfPageOverlayEdits;
export type ExplorerPdfOverlayAnnotationKind = PdfOverlayAnnotationKind;
export type ExplorerPdfOverlayAnnotation = PdfOverlayAnnotation;
export type ExplorerPdfPageRect = PdfPageRect;
export type ExplorerPdfPoint = PdfPoint;
export type ExplorerPdfColorValue = PdfColorValue;
export type ExplorerPdfSaveEditsInput = PdfSaveEditsRequest;
export type ExplorerPdfSaveEditsOutput = PdfSaveEditsResult;

export async function openExplorerPdfPreviewDocument(
  inputPath: string,
): Promise<ExplorerPdfPreviewDocument> {
  return unwrapTauriResult(await commands.pdfOpenPreviewDocument(inputPath));
}

export async function renderExplorerPdfPreviewPage(
  request: ExplorerPdfPageRenderInput,
): Promise<ExplorerPdfPageRenderOutput> {
  return unwrapTauriResult(await commands.pdfRenderPreviewPage(request));
}

export async function saveExplorerPdfPreviewEdits(
  request: ExplorerPdfSaveEditsInput,
): Promise<ExplorerPdfSaveEditsOutput> {
  return unwrapTauriResult(await commands.pdfSavePreviewEdits(request));
}

export async function closeExplorerPdfPreviewDocument(sessionId: string): Promise<void> {
  await unwrapTauriResult(await commands.pdfClosePreviewDocument(sessionId));
}
