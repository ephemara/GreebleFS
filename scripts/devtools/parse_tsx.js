const ts = require('typescript');
const fs = require('fs');

const file = fs.readFileSync('src/components/ExplorerAudioWorkbench.tsx', 'utf8');
const sf = ts.createSourceFile('src/components/ExplorerAudioWorkbench.tsx', file, ts.ScriptTarget.Latest, true);

let unclosed = null;

function visit(node) {
  // We can just dump any node that has syntax errors attached
  if (node.flags & ts.NodeFlags.Synthesized) return;
  ts.forEachChild(node, visit);
}
visit(sf);
