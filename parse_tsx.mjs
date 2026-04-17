import * as ts from 'typescript';
import * as fs from 'fs';

const filePath = 'src/components/ExplorerAudioWorkbench.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const sourceFile = ts.createSourceFile(
  filePath,
  content,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

const diagnostics = sourceFile.parseDiagnostics;
if (diagnostics.length > 0) {
  diagnostics.forEach(d => {
    if (d.file) {
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      console.log(`${d.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    }
  });
} else {
  console.log("No syntax errors found by TS parser.");
}
