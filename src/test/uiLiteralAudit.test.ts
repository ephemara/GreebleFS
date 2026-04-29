import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const auditScriptPath = join(process.cwd(), 'scripts', 'audit-ui-literals.mjs');

function createAuditFixture() {
  const root = mkdtempSync(join(tmpdir(), 'gfs-ui-literal-audit-'));
  const sourceRoot = join(root, 'src');
  mkdirSync(sourceRoot, { recursive: true });
  return {
    root,
    sourceRoot,
    baselinePath: join(root, 'baseline.json'),
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}

describe('UI literal audit', () => {
  it('fails when a new UI source hardcodes visual or interaction literals', () => {
    const fixture = createAuditFixture();
    try {
      writeFileSync(fixture.baselinePath, JSON.stringify({ version: 1, fingerprints: [] }));
      writeFileSync(
        join(fixture.sourceRoot, 'HardcodedSurface.tsx'),
        [
          'export function HardcodedSurface() {',
          '  return <div style={{ width: "240px", background: "rgba(1,2,3,0.4)", filter: "blur(12px)", boxShadow: "0 12px 30px rgba(0,0,0,0.32)", transitionDuration: "160ms" }} />;',
          '}',
        ].join('\n'),
      );

      let auditOutput = '';
      try {
        execFileSync(
          process.execPath,
          [auditScriptPath, '--root', fixture.sourceRoot, '--baseline', fixture.baselinePath],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        );
      } catch (error) {
        auditOutput = `${String((error as { stdout?: string }).stdout ?? '')}${String((error as { stderr?: string }).stderr ?? '')}`;
      }
      expect(auditOutput).toContain('UI literal audit found');
      expect(auditOutput).toContain('px-length');
      expect(auditOutput).toContain('functional-color');
      expect(auditOutput).toContain('blur-length');
      expect(auditOutput).toContain('duration-ms');
    } finally {
      fixture.cleanup();
    }
  });

  it('passes after the current source state is intentionally baselined', () => {
    const fixture = createAuditFixture();
    try {
      writeFileSync(
        join(fixture.sourceRoot, 'TokenizedSurface.tsx'),
        [
          'export function TokenizedSurface() {',
          '  return <div style={{ width: "var(--overlay-test-width)", background: "var(--overlay-test-bg)" }} />;',
          '}',
        ].join('\n'),
      );

      execFileSync(
        process.execPath,
        [auditScriptPath, '--root', fixture.sourceRoot, '--baseline', fixture.baselinePath, '--update-baseline'],
        { encoding: 'utf8' },
      );
      const output = execFileSync(
        process.execPath,
        [auditScriptPath, '--root', fixture.sourceRoot, '--baseline', fixture.baselinePath],
        { encoding: 'utf8' },
      );

      expect(output).toContain('UI literal audit passed');
    } finally {
      fixture.cleanup();
    }
  });
});
