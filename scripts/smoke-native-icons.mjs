import { chromium } from "playwright";

const cdpUrl = process.env.GREEBLEFS_CDP_URL ?? "http://127.0.0.1:9222";
const desktopPath = "C:\\Users\\Admin\\Desktop";
const proofEntryPatterns = [
  /Google Chrome\.lnk$/i,
  /Discord\.lnk$/i,
  /FPilot\.exe$/i,
  /Crosshair V2\.url$/i,
];

function isNativeIconSrc(src) {
  return typeof src === "string" && src.startsWith("data:image/png;base64,");
}

async function navigateToDesktop(page) {
  const currentDirectory = await page.evaluate(async () => {
    const snapshot = await window.__GREEBLEFS_DEV_MCP__?.getSnapshot?.();
    return snapshot?.selectionSnapshot?.activeDirectory ?? "";
  });
  if (currentDirectory === desktopPath) {
    return;
  }

  await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button"));
    const driveButton = candidates.find((button) => {
      const text = button.textContent?.replace(/\s+/g, " ").trim() ?? "";
      return text.includes("C:\\") || /windows\s+C:/i.test(text);
    });
    if (!driveButton) {
      throw new Error("Could not find the C: drive button in Explorer");
    }
    driveButton.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
    );
  });
  await page.waitForTimeout(1_500);

  for (const segment of ["Users", "Admin", "Desktop"]) {
    await page.evaluate((targetSegment) => {
      const entry = Array.from(document.querySelectorAll("[data-entry-path]")).find(
        (element) => {
          const path = element.getAttribute("data-entry-path") ?? "";
          const leaf = path.split(/[\\/]/).filter(Boolean).at(-1) ?? "";
          return leaf.toLowerCase() === targetSegment.toLowerCase();
        },
      );
      if (!entry) {
        throw new Error(`Could not find ${targetSegment} in Explorer`);
      }
      entry.dispatchEvent(
        new MouseEvent("dblclick", {
          bubbles: true,
          cancelable: true,
          detail: 2,
          view: window,
        }),
      );
    }, segment);
    await page.waitForTimeout(1_000);
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const activeDirectory = await page.evaluate(async () => {
      const snapshot = await window.__GREEBLEFS_DEV_MCP__?.getSnapshot?.();
      return snapshot?.selectionSnapshot?.activeDirectory ?? "";
    });
    if (activeDirectory === desktopPath) {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Explorer did not navigate to ${desktopPath}`);
}

async function collectAppIconEntries(page) {
  return page.evaluate((patternSources) => {
    const patterns = patternSources.map(
      (source) => new RegExp(source.source, source.flags),
    );
    return Array.from(document.querySelectorAll("[data-entry-path]"))
      .map((element) => {
        const path = element.getAttribute("data-entry-path") ?? "";
        const image = element.querySelector("img");
        return {
          path,
          text: element.textContent?.trim().slice(0, 120) ?? "",
          src: image?.getAttribute("src") ?? "",
          shortcutBadge: Boolean(
            element.querySelector('[data-overlay-explorer-shortcut-badge="true"]'),
          ),
        };
      })
      .filter((entry) => patterns.some((pattern) => pattern.test(entry.path)));
  }, proofEntryPatterns.map((pattern) => ({
    source: pattern.source,
    flags: pattern.flags,
  })));
}

async function main() {
  const browser = await chromium.connectOverCDP(cdpUrl);
  try {
    const context = browser.contexts()[0];
    const page = context?.pages()[0];
    if (!page) {
      throw new Error(`No WebView page is attached at ${cdpUrl}`);
    }

    await page.waitForFunction(() => Boolean(window.__TAURI_INTERNALS__), null, {
      timeout: 10_000,
    });

    const directResolverResult = await page.evaluate(async (path) => {
      const response = await window.__TAURI_INTERNALS__.invoke(
        "fs_resolve_native_icons",
        { requests: [{ path, size: 96 }] },
      );
      return response?.[0]?.src ?? "";
    }, `${desktopPath}\\Google Chrome.lnk`);

    if (!isNativeIconSrc(directResolverResult)) {
      throw new Error("Native command did not return a PNG icon for Google Chrome.lnk");
    }

    await navigateToDesktop(page);
    await page.waitForTimeout(5_000);

    const viewport = page.locator('[data-overlay-explorer="true"]').first();
    let entries = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      entries = await collectAppIconEntries(page);
      if (entries.length > 0) {
        break;
      }
      await viewport.hover({ force: true }).catch(() => {});
      await page.mouse.wheel(0, 1_800);
      await page.waitForTimeout(700);
    }
    const missingEntries = proofEntryPatterns
      .map((pattern) => entries.find((entry) => pattern.test(entry.path)))
      .filter((entry) => !entry);
    if (missingEntries.length > 0 || entries.length === 0) {
      throw new Error("Desktop app entries were not rendered in Explorer");
    }

    const unresolvedEntries = entries.filter((entry) => !isNativeIconSrc(entry.src));
    if (unresolvedEntries.length > 0) {
      throw new Error(
        `Explorer rendered managed placeholders for app icons: ${unresolvedEntries
          .map((entry) => entry.path)
          .join(", ")}`,
      );
    }

    const shortcutPresentationFailures = entries.filter((entry) => {
      if (!/\.lnk$/i.test(entry.path)) {
        return false;
      }
      return (
        /\.lnk\b/i.test(entry.text) ||
        !entry.text.toLowerCase().includes("shortcut") ||
        !entry.shortcutBadge
      );
    });
    if (shortcutPresentationFailures.length > 0) {
      throw new Error(
        `Explorer exposed raw shortcut presentation: ${shortcutPresentationFailures
          .map((entry) => `${entry.path} => ${entry.text}`)
          .join(", ")}`,
      );
    }

    console.log(
      JSON.stringify(
        {
          status: "ok",
          cdpUrl,
          checkedEntries: entries.map((entry) => entry.path),
          directResolver: "ok",
          uiResolver: "ok",
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        status: "error",
        cdpUrl,
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
