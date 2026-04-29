import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(new URL("..", import.meta.url).pathname.slice(process.platform === "win32" ? 1 : 0));
const targetDir = resolve(repoRoot, "target", "debug", "deps");
const defPath = resolve(targetDir, "api-ms-win-core-synch-l1-2-0.def");
const outPath = resolve(targetDir, "api-ms-win-core-synch-l1-2-0.dll");

const forwarderDefinition = `LIBRARY api-ms-win-core-synch-l1-2-0.dll
EXPORTS
  WaitOnAddress=kernelbase.WaitOnAddress
  WakeByAddressAll=kernelbase.WakeByAddressAll
  WakeByAddressSingle=kernelbase.WakeByAddressSingle
`;

function findLldLink() {
  const names = process.platform === "win32" ? ["lld-link.exe", "lld-link"] : ["lld-link"];
  for (const name of names) {
    const result = spawnSync("where.exe", [name], { encoding: "utf8" });
    if (result.status === 0) {
      const candidate = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      if (candidate) {
        return candidate;
      }
    }
  }
  return null;
}

if (process.platform !== "win32") {
  console.log("Windows Rust API-set shim is not needed on this platform.");
  process.exit(0);
}

await mkdir(dirname(defPath), { recursive: true });
await writeFile(defPath, forwarderDefinition, "utf8");

const lldLink = findLldLink();
if (!lldLink) {
  console.error("lld-link.exe was not found on PATH; install LLVM or Visual Studio Build Tools.");
  process.exit(1);
}

const result = spawnSync(
  lldLink,
  ["/dll", "/noentry", "/machine:x64", `/def:${defPath}`, `/out:${outPath}`],
  { cwd: repoRoot, encoding: "utf8" },
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Prepared Windows Rust test API-set shim: ${outPath}`);
