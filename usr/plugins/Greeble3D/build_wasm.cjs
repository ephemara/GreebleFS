const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packageRoot = __dirname;
const wasmDir = path.join(packageRoot, 'wasm');
const outDir = path.join(packageRoot, 'src', 'features', 'greeble', 'pkg');
const pkgGitignorePath = path.join(outDir, '.gitignore');

console.log('Building Greeble3D WASM package...');

try {
  execSync(`wasm-pack build --target web --out-dir "${outDir}"`, {
    cwd: wasmDir,
    stdio: 'inherit',
    shell: true,
  });
  if (fs.existsSync(pkgGitignorePath)) {
    fs.rmSync(pkgGitignorePath, { force: true });
  }
  console.log(`WASM build complete: ${outDir}`);
} catch (error) {
  console.error('WASM build failed:', error);
  process.exit(1);
}
