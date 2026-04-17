import fs from 'fs';
import * as parser from '@babel/parser';

const code = fs.readFileSync('src/components/ExplorerAudioWorkbench.tsx', 'utf-8');

try {
  parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript']
  });
  console.log("No error");
} catch (e) {
  console.log(e.message);
  console.log(e.loc);
}
