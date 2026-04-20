import * as XLSX from "xlsx";
import {
  HyperFormula,
  type CellValue,
  type CellValueDetailedType,
  type RawCellContent,
  type SheetDimensions,
  type SimpleCellAddress,
} from "hyperformula";
import {
  getSpreadsheetExportBookType,
  getSpreadsheetFileKind,
  getSpreadsheetTabularDelimiter,
  normalizeSpreadsheetExtension,
  type SpreadsheetFileKind,
} from "../config/spreadsheet";

export interface SpreadsheetWorkbookDocument {
  workbook: HyperFormula;
  fileKind: SpreadsheetFileKind;
  sourceExtension: string;
}

type SpreadsheetCellErrorValue = {
  value: string;
  type: string;
  message: string;
};

const EXCEL_ERROR_LABEL_BY_CODE: Record<number, string> = {
  0x00: "#NULL!",
  0x07: "#DIV/0!",
  0x0f: "#VALUE!",
  0x17: "#REF!",
  0x1d: "#NAME?",
  0x24: "#NUM!",
  0x2a: "#N/A",
  0x2b: "#GETTING_DATA",
};

const EXCEL_ERROR_CODE_BY_LABEL = Object.fromEntries(
  Object.entries(EXCEL_ERROR_LABEL_BY_CODE).map(([code, label]) => [label, Number(code)]),
) as Record<string, number>;

const DEFAULT_DATE_FORMAT = "yyyy-mm-dd";
const DEFAULT_DATETIME_FORMAT = "yyyy-mm-dd hh:mm";
const DEFAULT_TIME_FORMAT = "hh:mm:ss";
const DEFAULT_PERCENT_FORMAT = "0.00%";
const DEFAULT_CURRENCY_FORMAT = "$#,##0.00";

export function buildSpreadsheetWorkbookDocument(
  sourceWorkbook: XLSX.WorkBook,
  sourceExtension: string,
): SpreadsheetWorkbookDocument {
  const normalizedExtension = normalizeSpreadsheetExtension(sourceExtension);
  const fileKind = getSpreadsheetFileKind(normalizedExtension);
  if (!fileKind) {
    throw new Error(`Unsupported spreadsheet extension: ${sourceExtension}`);
  }

  const workbookSheets = sourceWorkbook.SheetNames.reduce((result, sheetName) => {
    const worksheet = sourceWorkbook.Sheets[sheetName];
    if (!worksheet) {
      return result;
    }

    const normalizedSheetName = normalizeSpreadsheetSheetName(
      sheetName,
      Object.keys(result),
    );
    result[normalizedSheetName] = buildRawSheetFromWorksheet(worksheet);
    return result;
  }, {} as Record<string, RawCellContent[][]>);

  const workbook = HyperFormula.buildFromSheets(workbookSheets, {
    licenseKey: "gpl-v3",
  });

  return {
    workbook,
    fileKind,
    sourceExtension: normalizedExtension,
  };
}

export function getSpreadsheetSheetNames(document: SpreadsheetWorkbookDocument): string[] {
  return document.workbook.getSheetNames();
}

export function getSpreadsheetSheetId(
  document: SpreadsheetWorkbookDocument,
  sheetName: string,
): number | null {
  try {
    return document.workbook.getSheetId(sheetName) ?? null;
  } catch {
    return null;
  }
}

export function getSpreadsheetSheetDimensions(
  document: SpreadsheetWorkbookDocument,
  sheetId: number,
): SheetDimensions {
  return document.workbook.getSheetDimensions(sheetId);
}

export function formatSpreadsheetCellDisplay(
  value: CellValue,
  detailedType: CellValueDetailedType,
): string {
  if (isSpreadsheetDetailedCellError(value)) {
    return (value as SpreadsheetCellErrorValue).value;
  }

  if (value == null) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    const dateFormat = getSpreadsheetDateFormat(detailedType);
    if (dateFormat) {
      return XLSX.SSF.format(dateFormat, value);
    }

    const numberFormat = getSpreadsheetNumberFormat(detailedType);
    if (numberFormat) {
      return XLSX.SSF.format(numberFormat, value);
    }

    return Number.isFinite(value) ? String(value) : "";
  }

  return String(value);
}

export function serializeSpreadsheetCellForClipboard(
  document: SpreadsheetWorkbookDocument,
  sheetId: number,
  row: number,
  col: number,
): string {
  const address: SimpleCellAddress = { sheet: sheetId, row, col };
  const formula = document.workbook.getCellFormula(address);
  if (formula) {
    return formula;
  }

  const value = document.workbook.getCellValue(address);
  const detailedType = document.workbook.getCellValueDetailedType(address);
  return formatSpreadsheetCellDisplay(value, detailedType);
}

export function parseSpreadsheetInput(value: string): RawCellContent {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (value.startsWith("'")) {
    return value.slice(1);
  }

  if (trimmed.startsWith("=")) {
    return trimmed;
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true";
  }

  if (isIsoLikeDateInput(trimmed)) {
    const parsedDate = new Date(trimmed);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  if (isNumericSpreadsheetInput(trimmed)) {
    return Number(trimmed);
  }

  return value;
}

export function validateSpreadsheetRawCellContent(
  value: RawCellContent,
): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("=") && trimmed.slice(1).trim().length === 0) {
      return "Formulas must include an expression after =.";
    }
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return "Spreadsheet cells cannot contain non-finite numbers.";
  }

  if (value instanceof Date && Number.isNaN(value.getTime())) {
    return "Spreadsheet cells cannot contain invalid dates.";
  }

  return null;
}

export function exportSpreadsheetWorkbook(
  document: SpreadsheetWorkbookDocument,
  activeSheetName: string,
): string | number[] {
  const sheetId = document.workbook.getSheetId(activeSheetName);
  if (sheetId == null) {
    throw new Error(`Unknown spreadsheet sheet: ${activeSheetName}`);
  }
  if (document.fileKind === "tabular") {
    return exportSpreadsheetTabularSheet(document.workbook, sheetId, document.sourceExtension);
  }

  return exportSpreadsheetWorkbookBytes(document.workbook, document.sourceExtension);
}

export function renameSpreadsheetSheet(
  document: SpreadsheetWorkbookDocument,
  sheetName: string,
  nextName: string,
): string {
  const sheetId = document.workbook.getSheetId(sheetName);
  if (sheetId == null) {
    throw new Error(`Unknown spreadsheet sheet: ${sheetName}`);
  }
  const normalizedName = normalizeSpreadsheetSheetName(nextName, document.workbook.getSheetNames());
  document.workbook.renameSheet(sheetId, normalizedName);
  return normalizedName;
}

export function addSpreadsheetSheet(
  document: SpreadsheetWorkbookDocument,
  requestedName?: string,
): string {
  const normalizedName = requestedName
    ? normalizeSpreadsheetSheetName(requestedName, document.workbook.getSheetNames())
    : undefined;
  return document.workbook.addSheet(normalizedName);
}

export function deleteSpreadsheetSheet(
  document: SpreadsheetWorkbookDocument,
  sheetName: string,
): void {
  const sheetId = document.workbook.getSheetId(sheetName);
  if (sheetId == null) {
    throw new Error(`Unknown spreadsheet sheet: ${sheetName}`);
  }
  document.workbook.removeSheet(sheetId);
}

export function clearSpreadsheetSheet(
  document: SpreadsheetWorkbookDocument,
  sheetName: string,
): void {
  const sheetId = document.workbook.getSheetId(sheetName);
  if (sheetId == null) {
    throw new Error(`Unknown spreadsheet sheet: ${sheetName}`);
  }
  document.workbook.clearSheet(sheetId);
}

export function normalizeSpreadsheetSheetName(
  requestedName: string,
  existingNames: string[] = [],
): string {
  const trimmed = requestedName.trim().replace(/[\[\]\*\?\/\\:]/g, " ").replace(/\s+/g, " ");
  const baseName = trimmed.replace(/^'+|'+$/g, "").trim() || "Sheet";
  const truncatedBaseName = baseName.slice(0, 31);
  const existingNameSet = new Set(existingNames.map((name) => name.toLowerCase()));

  if (!existingNameSet.has(truncatedBaseName.toLowerCase())) {
    return truncatedBaseName;
  }

  for (let suffixIndex = 2; suffixIndex < 1000; suffixIndex += 1) {
    const suffix = ` (${suffixIndex})`;
    const candidate = `${truncatedBaseName.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    if (!existingNameSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${truncatedBaseName.slice(0, 24)} (${Date.now().toString().slice(-4)})`;
}

function buildRawSheetFromWorksheet(worksheet: XLSX.WorkSheet): RawCellContent[][] {
  const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
  if (!range) {
    return [[]];
  }

  const rows: RawCellContent[][] = Array.from(
    { length: range.e.r + 1 },
    () => [],
  );

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row = rows[rowIndex] ?? (rows[rowIndex] = []);
    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[cellRef] as XLSX.CellObject | undefined;
      if (!cell) {
        continue;
      }
      row[colIndex] = convertWorksheetCellToRawContent(cell);
    }
  }

  return rows.length > 0 ? rows : [[]];
}

function convertWorksheetCellToRawContent(cell: XLSX.CellObject): RawCellContent {
  if (cell.f) {
    return `=${cell.f}`;
  }

  switch (cell.t) {
    case "b":
      return Boolean(cell.v);
    case "n":
      return typeof cell.v === "number" ? cell.v : null;
    case "d":
      return cell.v instanceof Date ? cell.v : null;
    case "e":
      return errorLabelFromWorksheetCell(cell);
    case "s":
      return typeof cell.v === "string" ? cell.v : cell.w ?? "";
    case "z":
    default:
      return null;
  }
}

function errorLabelFromWorksheetCell(cell: XLSX.CellObject): string {
  if (typeof cell.w === "string" && cell.w.trim()) {
    return cell.w.trim();
  }

  const errorCode = typeof cell.v === "number" ? cell.v : 0x07;
  return EXCEL_ERROR_LABEL_BY_CODE[errorCode] ?? "#DIV/0!";
}

function exportSpreadsheetWorkbookBytes(
  workbook: HyperFormula,
  sourceExtension: string,
): number[] {
  const sheetNames = workbook.getSheetNames();
  const nextWorkbook = XLSX.utils.book_new();
  const exportedSheetNames: string[] = [];
  const bookType =
    getSpreadsheetExportBookType(sourceExtension) ?? "xlsx";

  for (const sheetName of sheetNames) {
    const sheetId = workbook.getSheetId(sheetName);
    if (sheetId == null) {
      continue;
    }
    const worksheet = buildWorksheetFromHyperFormula(workbook, sheetId, "raw");
    const exportedSheetName = normalizeSpreadsheetSheetName(
      sheetName,
      exportedSheetNames,
    );
    exportedSheetNames.push(exportedSheetName);
    XLSX.utils.book_append_sheet(nextWorkbook, worksheet, exportedSheetName);
  }

  const workbookBytes = XLSX.write(nextWorkbook, {
    bookType,
    type: "array",
    cellDates: true,
  });

  return Array.from(new Uint8Array(workbookBytes as ArrayBuffer));
}

function exportSpreadsheetTabularSheet(
  workbook: HyperFormula,
  sheetId: number,
  sourceExtension: string,
): string {
  const worksheet = buildWorksheetFromHyperFormula(workbook, sheetId, "values");
  const delimiter = getSpreadsheetTabularDelimiter(sourceExtension) ?? ",";
  return XLSX.utils.sheet_to_csv(worksheet, {
    FS: delimiter,
    RS: "\n",
    blankrows: true,
    rawNumbers: false,
    forceQuotes: false,
    strip: false,
  });
}

function buildWorksheetFromHyperFormula(
  workbook: HyperFormula,
  sheetId: number,
  mode: "raw" | "values",
): XLSX.WorkSheet {
  const dimensions = workbook.getSheetDimensions(sheetId);
  const rowCount = Math.max(dimensions.height, 1);
  const columnCount = Math.max(dimensions.width, 1);
  const rows: Array<Array<XLSX.CellObject | string | number | boolean | Date | null>> =
    Array.from({ length: rowCount }, () => Array(columnCount).fill(null));

  for (let row = 0; row < dimensions.height; row += 1) {
    for (let col = 0; col < dimensions.width; col += 1) {
      const address: SimpleCellAddress = { sheet: sheetId, row, col };
      const rawValue = workbook.getCellSerialized(address);
      const value = workbook.getCellValue(address);
      const detailedType = workbook.getCellValueDetailedType(address);
      rows[row]![col] =
        mode === "raw"
          ? convertSerializedCellToWorksheetCell(rawValue, value, detailedType)
          : convertValueToWorksheetCell(value, detailedType);
    }
  }

  return XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
}

function convertSerializedCellToWorksheetCell(
  rawValue: RawCellContent,
  value: CellValue,
  detailedType: CellValueDetailedType,
): XLSX.CellObject | string | number | boolean | Date | null {
  if (rawValue == null) {
    return null;
  }

  if (typeof rawValue === "string" && rawValue.startsWith("=")) {
    const formula = rawValue.slice(1);
    if (isSpreadsheetDetailedCellError(value)) {
      const errorValue = value as SpreadsheetCellErrorValue;
      return {
        f: formula,
        t: "e",
        v: spreadsheetErrorCodeFromLabel(errorValue.value),
        w: errorValue.value,
      };
    }

    const exportedValue = convertValueToWorksheetCell(value, detailedType);
    if (isCellObject(exportedValue)) {
      return {
        ...exportedValue,
        f: formula,
      };
    }

    const primitiveFormulaCell = buildFormulaCellFromPrimitiveValue(
      exportedValue as string | number | boolean | Date | null,
      detailedType,
      formula,
    );
    return primitiveFormulaCell;
  }

  if (isSpreadsheetDetailedCellError(value)) {
    const errorValue = value as SpreadsheetCellErrorValue;
    return {
      t: "e",
      v: spreadsheetErrorCodeFromLabel(errorValue.value),
      w: errorValue.value,
    };
  }

  return buildCellObjectFromPrimitiveValue(rawValue, detailedType);
}

function convertValueToWorksheetCell(
  value: CellValue,
  detailedType: CellValueDetailedType,
): XLSX.CellObject | string | number | boolean | Date | null {
  if (isSpreadsheetDetailedCellError(value)) {
    const errorValue = value as SpreadsheetCellErrorValue;
    return {
      t: "e",
      v: spreadsheetErrorCodeFromLabel(errorValue.value),
      w: errorValue.value,
    };
  }

  return buildCellObjectFromPrimitiveValue(value as string | number | boolean | Date | null, detailedType);
}

function buildCellObjectFromPrimitiveValue(
  value: string | number | boolean | Date | null,
  detailedType: CellValueDetailedType,
): XLSX.CellObject | string | number | boolean | Date | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return {
      t: "d",
      v: value,
      z: getSpreadsheetDateFormat(detailedType) ?? DEFAULT_DATE_FORMAT,
    };
  }

  if (typeof value === "number") {
    const format = getSpreadsheetDateFormat(detailedType) ?? getSpreadsheetNumberFormat(detailedType);
    if (format) {
      return {
        t: "n",
        v: value,
        z: format,
      };
    }
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return value;
}

function buildFormulaCellFromPrimitiveValue(
  value: string | number | boolean | Date | null,
  detailedType: CellValueDetailedType,
  formula: string,
): XLSX.CellObject {
  const primitiveCell = buildCellObjectFromPrimitiveValue(value, detailedType);
  if (primitiveCell == null) {
    return {
      f: formula,
      t: "z",
    };
  }

  if (isCellObject(primitiveCell)) {
    return {
      ...primitiveCell,
      f: formula,
    };
  }

  if (primitiveCell instanceof Date) {
    return {
      f: formula,
      t: "d",
      v: primitiveCell,
      z: getSpreadsheetDateFormat(detailedType) ?? DEFAULT_DATE_FORMAT,
    };
  }

  if (typeof primitiveCell === "number") {
    return {
      f: formula,
      t: "n",
      v: primitiveCell,
      z: getSpreadsheetDateFormat(detailedType) ?? getSpreadsheetNumberFormat(detailedType) ?? undefined,
    };
  }

  if (typeof primitiveCell === "boolean") {
    return {
      f: formula,
      t: "b",
      v: primitiveCell,
    };
  }

  return {
    f: formula,
    t: "s",
    v: primitiveCell,
  };
}

function getSpreadsheetDateFormat(detailedType: CellValueDetailedType): string | null {
  switch (detailedType) {
    case "NUMBER_DATE":
      return DEFAULT_DATE_FORMAT;
    case "NUMBER_DATETIME":
      return DEFAULT_DATETIME_FORMAT;
    case "NUMBER_TIME":
      return DEFAULT_TIME_FORMAT;
    default:
      return null;
  }
}

function getSpreadsheetNumberFormat(detailedType: CellValueDetailedType): string | null {
  switch (detailedType) {
    case "NUMBER_PERCENT":
      return DEFAULT_PERCENT_FORMAT;
    case "NUMBER_CURRENCY":
      return DEFAULT_CURRENCY_FORMAT;
    default:
      return null;
  }
}

function isSpreadsheetDetailedCellError(value: CellValue): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      "value" in value &&
      "type" in value &&
      typeof (value as { value?: unknown }).value === "string",
  );
}

function spreadsheetErrorCodeFromLabel(label: string): number {
  return EXCEL_ERROR_CODE_BY_LABEL[label] ?? 0x07;
}

function isCellObject(
  value: XLSX.CellObject | string | number | boolean | Date | null,
): value is XLSX.CellObject {
  return Boolean(value && typeof value === "object" && "t" in value);
}

function isNumericSpreadsheetInput(value: string): boolean {
  return /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(value);
}

function isIsoLikeDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.+-Z]+)?$/.test(value);
}
