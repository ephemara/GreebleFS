import fs from 'fs';
import * as parser from '@babel/parser';

const code = fs.readFileSync('src/components/ExplorerAudioWorkbench.tsx', 'utf-8');
const lines = code.split('\n');

for (let i = 500; i < lines.length; i++) {
  const segment = lines.slice(470, i).join('\n') + "\n    </>\n  );\n}";
  try {
    parser.parse(segment, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  } catch (e) {
    if (!e.message.includes("Unexpected token, expected \",\"")) {
      // Different error means it's structurally incomplete but not our unclosed paren
    } else {
      console.log(`Failed around line ${i}: ${lines[i-1]}`);
      break;
    }
  }
}
