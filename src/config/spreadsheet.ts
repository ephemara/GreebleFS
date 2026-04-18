import type { BookType } from "xlsx";

export type SpreadsheetFileKind = "workbook" | "tabular";

const SPREADSHEET_WORKBOOK_EXTENSIONS = [
  "xlsx",
  "xlsm",
  "xlsb",
  "xls",
  "ods",
] as const;

const SPREADSHEET_TABULAR_TEXT_EXTENSIONS = [
  "csv",
  "tsv",
] as const;

const SPREADSHEET_EXPORT_BOOK_TYPE_BY_EXTENSION: Record<string, BookType> = {
  csv: "csv",
  xls: "xls",
  xlsb: "xlsb",
  xlsm: "xlsm",
  xlsx: "xlsx",
  ods: "ods",
  tsv: "txt",
};

const SPREADSHEET_TABULAR_DELIMITER_BY_EXTENSION: Record<string, string> = {
  csv: ",",
  tsv: "\t",
};

const SPREADSHEET_PREVIEW_EXTENSIONS = new Set<string>([
  ...SPREADSHEET_WORKBOOK_EXTENSIONS,
  ...SPREADSHEET_TABULAR_TEXT_EXTENSIONS,
]);

const SPREADSHEET_WORKBOOK_EXTENSION_SET = new Set<string>(
  SPREADSHEET_WORKBOOK_EXTENSIONS,
);

const SPREADSHEET_TABULAR_TEXT_EXTENSION_SET = new Set<string>(
  SPREADSHEET_TABULAR_TEXT_EXTENSIONS,
);

export function isSpreadsheetPreviewExtension(extension: string): boolean {
  return SPREADSHEET_PREVIEW_EXTENSIONS.has(normalizeSpreadsheetExtension(extension));
}

export function isSpreadsheetWorkbookExtension(extension: string): boolean {
  return SPREADSHEET_WORKBOOK_EXTENSION_SET.has(normalizeSpreadsheetExtension(extension));
}

export function isSpreadsheetTabularTextExtension(extension: string): boolean {
  return SPREADSHEET_TABULAR_TEXT_EXTENSION_SET.has(normalizeSpreadsheetExtension(extension));
}

export function getSpreadsheetFileKind(extension: string): SpreadsheetFileKind | null {
  const normalizedExtension = normalizeSpreadsheetExtension(extension);
  if (isSpreadsheetWorkbookExtension(normalizedExtension)) {
    return "workbook";
  }
  if (isSpreadsheetTabularTextExtension(normalizedExtension)) {
    return "tabular";
  }
  return null;
}

export function getSpreadsheetExportBookType(extension: string): BookType | null {
  return SPREADSHEET_EXPORT_BOOK_TYPE_BY_EXTENSION[normalizeSpreadsheetExtension(extension)] ?? null;
}

export function getSpreadsheetTabularDelimiter(extension: string): string | null {
  return (
    SPREADSHEET_TABULAR_DELIMITER_BY_EXTENSION[
      normalizeSpreadsheetExtension(extension)
    ] ?? null
  );
}

export function normalizeSpreadsheetExtension(extension: string): string {
  return extension.trim().replace(/^\./, "").toLowerCase();
}
