import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const iconSyncScriptPath = path.join(projectRoot, "scripts", "sync-canonical-icons.mjs");
const viteCliEntryPath = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");

function runNodeScript(scriptPath, forwardedArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...forwardedArgs], {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${path.basename(scriptPath)} exited from signal ${signal}`));
        return;
      }

      resolve(code ?? 0);
    });
  });
}

async function main() {
  const syncExitCode = await runNodeScript(iconSyncScriptPath);
  if (syncExitCode !== 0) {
    process.exit(syncExitCode);
  }

  const viteExitCode = await runNodeScript(viteCliEntryPath, process.argv.slice(2));
  process.exit(viteExitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
