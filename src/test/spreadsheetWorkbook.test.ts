import XLSX from "xlsx";
import { HyperFormula } from "hyperformula";
import { describe, expect, it } from "vitest";
import {
  addSpreadsheetSheet,
  buildSpreadsheetWorkbookDocument,
  clearSpreadsheetSheet,
  deleteSpreadsheetSheet,
  exportSpreadsheetWorkbook,
  getSpreadsheetSheetId,
  getSpreadsheetSheetNames,
  normalizeSpreadsheetSheetName,
  parseSpreadsheetInput,
  renameSpreadsheetSheet,
  serializeSpreadsheetCellForClipboard,
  type SpreadsheetWorkbookDocument,
} from "../runtime/spreadsheetWorkbook";

describe("spreadsheetWorkbook runtime helpers", () => {
  it("imports workbook sheets and preserves formulas on round-trip export", () => {
    const sourceWorkbook = XLSX.utils.book_new();
    const sourceSheet = XLSX.utils.aoa_to_sheet([
      ["Name", "Left", "Right", "Total"],
      ["Alpha", 2, 5, 7],
    ]);

    sourceSheet.D2 = {
      f: "SUM(B2:C2)",
      t: "n",
      v: 7,
      w: "7",
    };
    sourceSheet["!ref"] = "A1:D2";
    XLSX.utils.book_append_sheet(sourceWorkbook, sourceSheet, "Scores");

    const document = buildSpreadsheetWorkbookDocument(sourceWorkbook, "xlsx");
    try {
      expect(document.fileKind).toBe("workbook");
      expect(document.sourceExtension).toBe("xlsx");
      expect(getSpreadsheetSheetNames(document)).toEqual(["Scores"]);

      const sheetId = getSpreadsheetSheetId(document, "Scores");
      expect(sheetId).not.toBeNull();
      expect(serializeSpreadsheetCellForClipboard(document, sheetId!, 1, 3)).toBe(
        "=SUM(B2:C2)",
      );

      const exportedBytes = exportSpreadsheetWorkbook(document, "Scores");
      if (!Array.isArray(exportedBytes)) {
        throw new Error("Expected workbook export bytes");
      }
      const exportedWorkbook = XLSX.read(new Uint8Array(exportedBytes).buffer, {
        cellDates: true,
        type: "array",
      });

      expect(exportedWorkbook.SheetNames).toEqual(["Scores"]);
      expect(exportedWorkbook.Sheets.Scores?.D2?.f).toBe("SUM(B2:C2)");
      expect(exportedWorkbook.Sheets.Scores?.D2?.v).toBe(7);
    } finally {
      document.workbook.destroy();
    }
  });

  it("exports tabular spreadsheets with csv and tsv delimiters", () => {
    const csvDocument = createSpreadsheetDocument(
      {
        Data: [
          ["Name", "Score"],
          ["Ada", 3],
          ["Grace", 4],
        ],
      },
      "tabular",
      "csv",
    );
    const tsvDocument = createSpreadsheetDocument(
      {
        Data: [
          ["Name", "Score"],
          ["Ada", 3],
          ["Grace", 4],
        ],
      },
      "tabular",
      "tsv",
    );

    try {
      const csvExport = exportSpreadsheetWorkbook(csvDocument, "Data");
      const tsvExport = exportSpreadsheetWorkbook(tsvDocument, "Data");

      expect(csvExport).toContain("Name,Score");
      expect(csvExport).toContain("Ada,3");
      expect(csvExport).toContain("Grace,4");
      expect(tsvExport).toContain("Name\tScore");
      expect(tsvExport).toContain("Ada\t3");
      expect(tsvExport).toContain("Grace\t4");
    } finally {
      csvDocument.workbook.destroy();
      tsvDocument.workbook.destroy();
    }
  });

  it("parses spreadsheet inputs and normalizes conflicting sheet names", () => {
    expect(parseSpreadsheetInput("42")).toBe(42);
    expect(parseSpreadsheetInput("true")).toBe(true);
    expect(parseSpreadsheetInput("'0012")).toBe("0012");
    expect(parseSpreadsheetInput("=SUM(A1:A2)")).toBe("=SUM(A1:A2)");

    const parsedDate = parseSpreadsheetInput("2024-01-02");
    expect(parsedDate).toBeInstanceOf(Date);
    expect((parsedDate as Date).toISOString().startsWith("2024-01-02")).toBe(true);
    expect(normalizeSpreadsheetSheetName("  Sheet / 1  ", ["Sheet 1"])).toBe(
      "Sheet 1 (2)",
    );
  });

  it("adds, renames, clears, and deletes sheets in place", () => {
    const document = createSpreadsheetDocument(
      {
        First: [["Alpha"]],
        Second: [["Beta"]],
      },
      "workbook",
      "xlsx",
    );

    try {
      const addedSheetName = addSpreadsheetSheet(document, "Summary");
      expect(document.workbook.getSheetNames()).toContain(addedSheetName);

      const renamedSheetName = renameSpreadsheetSheet(document, addedSheetName, "Overview");
      expect(renamedSheetName).toBe("Overview");
      expect(document.workbook.getSheetNames()).toContain("Overview");

      const overviewSheetId = document.workbook.getSheetId("Overview")!;
      document.workbook.setCellContents({ sheet: overviewSheetId, row: 0, col: 0 }, [["Temp"]]);
      expect(
        serializeSpreadsheetCellForClipboard(document, overviewSheetId, 0, 0),
      ).toBe("Temp");

      clearSpreadsheetSheet(document, "Overview");
      expect(serializeSpreadsheetCellForClipboard(document, overviewSheetId, 0, 0)).toBe("");

      deleteSpreadsheetSheet(document, "Overview");
      expect(document.workbook.getSheetNames()).not.toContain("Overview");
    } finally {
      document.workbook.destroy();
    }
  });
});

function createSpreadsheetDocument(
  sheets: Record<string, Array<Array<string | number | boolean | Date | null>>>,
  fileKind: SpreadsheetWorkbookDocument["fileKind"],
  sourceExtension: string,
): SpreadsheetWorkbookDocument {
  return {
    workbook: HyperFormula.buildFromSheets(sheets, {
      licenseKey: "gpl-v3",
    }),
    fileKind,
    sourceExtension,
  };
}
