const GALLERY_LIMIT = 120;
const DEFAULT_GALLERY_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "avif",
  "tiff",
  "tif",
];

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

function formatCount(count) {
  return `${count.toLocaleString()} ${count === 1 ? "picture" : "pictures"}`;
}

function parseTextList(value, splitPattern) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => parseTextList(entry, splitPattern));
  }
  if (typeof value !== "string") {
    return [];
  }
  return value
    .split(splitPattern)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseRootPaths(value) {
  return [...new Set(parseTextList(value, /[\n\r;]+/g))];
}

function parseExtensions(value) {
  const parsed = parseTextList(value, /[\n\r,;\s]+/g)
    .map((extension) => extension.replace(/^\.+/, "").toLowerCase())
    .filter((extension) => /^[a-z0-9]{1,24}$/.test(extension));
  const unique = [...new Set(parsed)];
  return unique.length > 0 ? unique : DEFAULT_GALLERY_EXTENSIONS;
}

function readNumberSetting(value, fallback, min, max) {
  const candidate = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : fallback;
  if (!Number.isFinite(candidate)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(candidate)));
}

function readGallerySettings(api) {
  const settings = api.settings;
  return {
    rootPaths: parseRootPaths(settings?.getValue("rootPaths", "") ?? ""),
    extensions: parseExtensions(
      settings?.getValue(
        "fileExtensions",
        DEFAULT_GALLERY_EXTENSIONS.join(", "),
      ) ?? DEFAULT_GALLERY_EXTENSIONS.join(", "),
    ),
    resultLimit: readNumberSetting(
      settings?.getValue("resultLimit", GALLERY_LIMIT),
      GALLERY_LIMIT,
      24,
      240,
    ),
    includeHidden: settings?.getValue("includeHidden", false) === true,
  };
}

function serializeGallerySettings(settings) {
  return JSON.stringify(settings);
}

function buildPictureUrl(api, picture) {
  return (
    picture.thumbnailUrl ||
    picture.fileUrl ||
    api.files.buildThumbnailUrl(picture.relativePath, 220, 220)
  );
}

export function mount(container, api) {
  let currentApi = api;
  let query = "";
  let pictures = [];
  let status = null;
  let gallerySettings = readGallerySettings(api);
  let loading = true;
  let error = null;
  let disposed = false;

  container.classList.add("gfs-mobile-gallery");

  async function refresh() {
    loading = true;
    error = null;
    render();
    try {
      const [nextStatus, response] = await Promise.all([
        currentApi.index.global.getStatus(),
        currentApi.index.media.findPictures({
          query: query.trim() || null,
          limit: gallerySettings.resultLimit,
          rootPaths: gallerySettings.rootPaths,
          extensions: gallerySettings.extensions,
          showHiddenFiles: gallerySettings.includeHidden,
        }),
      ]);
      if (disposed) {
        return;
      }
      status = nextStatus.status;
      pictures = response.entries;
    } catch (caught) {
      if (!disposed) {
        error = String(caught);
      }
    } finally {
      if (!disposed) {
        loading = false;
        render();
      }
    }
  }

  async function startScan() {
    error = null;
    render();
    try {
      await currentApi.index.global.startScan();
      await refresh();
    } catch (caught) {
      if (!disposed) {
        error = String(caught);
        render();
      }
    }
  }

  function renderHeader(root) {
    const header = createElement("header", "gfs-mobile-gallery__header");
    const titleRow = createElement("div", "gfs-mobile-gallery__title-row");
    titleRow.append(
      createElement("div", "gfs-mobile-gallery__title", "Index Photo Gallery"),
    );

    const refreshButton = createElement("button", "gfs-mobile-gallery__icon-button", "Refresh");
    refreshButton.type = "button";
    refreshButton.addEventListener("click", () => {
      void refresh();
    });
    titleRow.append(refreshButton);
    header.append(titleRow);

    const toolbar = createElement("div", "gfs-mobile-gallery__toolbar");
    const input = document.createElement("input");
    input.className = "gfs-mobile-gallery__search";
    input.placeholder = "Search pictures";
    input.value = query;
    input.addEventListener("input", (event) => {
      query = event.currentTarget.value;
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        void refresh();
      }
    });
    toolbar.append(input);

    const searchButton = createElement("button", "gfs-mobile-gallery__button", "Search");
    searchButton.type = "button";
    searchButton.addEventListener("click", () => {
      void refresh();
    });
    toolbar.append(searchButton);
    header.append(toolbar);

    const meta = createElement("div", "gfs-mobile-gallery__meta");
    meta.append(
      createElement(
        "span",
        "",
        loading ? "Loading index" : error || formatCount(pictures.length),
      ),
    );
    meta.append(
      createElement(
        "span",
        "",
        status?.isIndexValid
          ? `${status.indexedItemCount.toLocaleString()} indexed`
          : "Index not ready",
      ),
    );
    meta.append(
      createElement(
        "span",
        "",
        gallerySettings.rootPaths.length > 0
          ? `${gallerySettings.rootPaths.length} scoped folders`
          : "Share scope",
      ),
    );
    meta.append(
      createElement("span", "", `${gallerySettings.extensions.length} types`),
    );
    header.append(meta);
    root.append(header);
  }

  function renderPictures(root) {
    if (!loading && pictures.length === 0) {
      const empty = createElement("div", "gfs-mobile-gallery__empty");
      empty.append(createElement("strong", "", "No indexed pictures"));
      empty.append(
        createElement(
          "span",
          "",
          error || "Start a share-root scan or try a different search.",
        ),
      );
      const scanButton = createElement("button", "gfs-mobile-gallery__button", "Start Scan");
      scanButton.type = "button";
      scanButton.addEventListener("click", () => {
        void startScan();
      });
      empty.append(scanButton);
      root.append(empty);
      return;
    }

    const grid = createElement("div", "gfs-mobile-gallery__grid");
    for (const picture of pictures) {
      const tile = createElement("button", "gfs-mobile-gallery__tile");
      tile.type = "button";
      tile.title = picture.relativePath;
      tile.addEventListener("click", () => {
        void currentApi.files.openPreview(picture.relativePath);
      });

      const image = document.createElement("img");
      image.className = "gfs-mobile-gallery__image";
      image.alt = picture.name;
      image.src = buildPictureUrl(currentApi, picture);
      image.loading = "lazy";
      tile.append(image);

      const caption = createElement("span", "gfs-mobile-gallery__caption");
      caption.append(createElement("span", "gfs-mobile-gallery__name", picture.name));
      caption.append(
        createElement("span", "gfs-mobile-gallery__path", picture.relativePath),
      );
      tile.append(caption);
      grid.append(tile);
    }
    root.append(grid);
  }

  function render() {
    container.innerHTML = "";
    const root = createElement("section", "gfs-mobile-gallery__root");
    renderHeader(root);
    renderPictures(root);
    container.append(root);
  }

  void refresh();

  return {
    update(nextApi) {
      const previousSettings = serializeGallerySettings(gallerySettings);
      currentApi = nextApi;
      gallerySettings = readGallerySettings(nextApi);
      if (serializeGallerySettings(gallerySettings) !== previousSettings) {
        void refresh();
      }
    },
    dispose() {
      disposed = true;
      container.innerHTML = "";
    },
  };
}
