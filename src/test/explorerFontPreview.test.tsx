import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { waitFor, within } from "@testing-library/react";
import {
  createPreviewFontFamilyId,
  ExplorerFontPreview,
} from "../components/ExplorerFontPreview";

const { fsReadFileBase64Mock } = vi.hoisted(() => ({
  fsReadFileBase64Mock: vi.fn(),
}));

vi.mock("../runtime/tauriClient", async () => {
  const actual = await vi.importActual<typeof import("../runtime/tauriClient")>(
    "../runtime/tauriClient",
  );

  return {
    ...actual,
    commands: {
      ...actual.commands,
      fsReadFileBase64: fsReadFileBase64Mock,
    },
  };
});

type MockFontFaceSet = {
  add: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  check: ReturnType<typeof vi.fn>;
  ready: Promise<void>;
};

class MockFontFace {
  readonly family: string;
  readonly source: ArrayBuffer | ArrayBufferView | string;
  readonly descriptors?: Record<string, unknown>;

  load = vi.fn(async () => this);

  constructor(
    family: string,
    source: ArrayBuffer | ArrayBufferView | string,
    descriptors?: Record<string, unknown>,
  ) {
    this.family = family;
    this.source = source;
    this.descriptors = descriptors;
  }
}

const originalFontFace = globalThis.FontFace;
const originalDocumentFonts = Object.getOwnPropertyDescriptor(document, "fonts");

function installFontPreviewTestShims(): void {
  Object.defineProperty(globalThis, "FontFace", {
    configurable: true,
    writable: true,
    value: MockFontFace,
  });

  const fontSet: MockFontFaceSet = {
    add: vi.fn(),
    delete: vi.fn(),
    check: vi.fn(() => true),
    ready: Promise.resolve(),
  };

  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: fontSet,
  });
}

function restoreFontPreviewTestShims(): void {
  if (originalFontFace) {
    Object.defineProperty(globalThis, "FontFace", {
      configurable: true,
      writable: true,
      value: originalFontFace,
    });
  } else {
    Reflect.deleteProperty(globalThis, "FontFace");
  }

  if (originalDocumentFonts) {
    Object.defineProperty(document, "fonts", originalDocumentFonts);
  } else {
    Reflect.deleteProperty(document, "fonts");
  }
}

function renderFontPreview(
  root: Root,
  fontPath: string,
  fontName: string,
  fontSource: string,
): void {
  flushSync(() => {
    root.render(
      <ExplorerFontPreview
        fontPath={fontPath}
        fontName={fontName}
        fontSource={fontSource}
        fontExtension="ttf"
      />,
    );
  });
}

describe("ExplorerFontPreview", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installFontPreviewTestShims();
    fsReadFileBase64Mock.mockReset();
    fsReadFileBase64Mock.mockResolvedValue({
      status: "ok",
      data: "QUJDRA==",
    } as never);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    restoreFontPreviewTestShims();
    fsReadFileBase64Mock.mockReset();
  });

  it("builds stable unique family ids for similarly named paths", () => {
    const first = createPreviewFontFamilyId("/tmp/fonts/Font-A.ttf");
    const second = createPreviewFontFamilyId("/tmp/fonts/Font A.ttf");

    expect(first).not.toBe(second);
    expect(createPreviewFontFamilyId("/tmp/fonts/Font-A.ttf")).toBe(first);
  });

  it("shows a loading state immediately when switching to the next font preview", async () => {
    const harness = within(container);

    renderFontPreview(
      root,
      "/tmp/fonts/Alpha.ttf",
      "Alpha Preview",
      "asset://localhost/tmp/fonts/Alpha.ttf",
    );

    await waitFor(() => {
      expect(harness.getByText("Alpha Preview")).toBeInTheDocument();
    });
    expect(harness.getByPlaceholderText("Type here to test the font...")).toBeInTheDocument();

    renderFontPreview(
      root,
      "/tmp/fonts/Beta.ttf",
      "Beta Preview",
      "asset://localhost/tmp/fonts/Beta.ttf",
    );

    expect(harness.getByRole("status", { name: /loading font preview/i })).toBeInTheDocument();
    expect(harness.queryByPlaceholderText("Type here to test the font...")).toBeNull();

    await waitFor(() => {
      expect(harness.getByText("Beta Preview")).toBeInTheDocument();
    });
    expect(harness.getByPlaceholderText("Type here to test the font...")).toBeInTheDocument();
  });
});
