import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function ensureParentDir(path) {
  const parent = dirname(path);
  if (parent && parent !== '.') {
    mkdirSync(parent, { recursive: true });
  }
}

function ppmText(width, height, bytes) {
  let out = `P3\n${width} ${height}\n255\n`;
  for (let index = 0; index < bytes.length; index += 4) {
    out += `${bytes[index]} ${bytes[index + 1]} ${bytes[index + 2]}\n`;
  }
  return out;
}

function canvasScript(id, width, height, bytes) {
  return `
    (() => {
      const width = ${width};
      const height = ${height};
      const bytes = [${bytes.join(',')}];
      const canvas = document.getElementById('${id}');
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(width, height);
      for (let src = 0, dst = 0; src < bytes.length; src += 4, dst += 4) {
        image.data[dst + 0] = bytes[src + 0];
        image.data[dst + 1] = bytes[src + 1];
        image.data[dst + 2] = bytes[src + 2];
        image.data[dst + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
    })();
  `;
}

export function makePpmPayload(name, width, height, bytes, signature) {
  const text = ppmText(width, height, bytes);
  return {
    kind: 'image',
    mime_type: 'image/x-portable-pixmap',
    extension: 'ppm',
    width,
    height,
    channels: 4,
    layout: 'HWC',
    pixel_format: 'rgba8',
    representation: 'encoded',
    text,
    bytes: new TextEncoder().encode(text),
    name,
    signature,
  };
}

export function makeConverterDocument(title, width, height, baseBytes, finalBytes, signature, cSignature, fitWidth, fitHeight) {
  const script = `
    ${canvasScript('base-view', width, height, baseBytes)}
    ${canvasScript('final-view', width, height, finalBytes)}
  `;
  return {
    kind: 'document',
    title,
    mime_type: 'text/html',
    extension: 'html',
    text: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #05070d; color: #f8fbff; font-family: Consolas, "Courier New", monospace; }
    main { width: min(94vw, 1160px); margin: 28px auto; padding: 18px; border: 1px solid rgba(125, 232, 255, 0.26); background: rgba(255,255,255,0.035); }
    h1 { margin: 0 0 8px; font-size: 14px; letter-spacing: 0.18em; text-transform: uppercase; color: #7de8ff; }
    .meta { margin: 0 0 14px; color: #b7cae8; font-size: 12px; }
    .compare { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    canvas { width: 100%; height: auto; display: block; image-rendering: pixelated; background: #02040a; border: 1px solid rgba(255,255,255,0.1); }
    .label { margin: 0 0 8px; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #ffd166; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p class="meta">${signature} / ${cSignature} / fit ${fitWidth}x${fitHeight}</p>
    <div class="compare">
      <section><p class="label">Python Base</p><canvas id="base-view" width="${width}" height="${height}"></canvas></section>
      <section><p class="label">Kain + C Final</p><canvas id="final-view" width="${width}" height="${height}"></canvas></section>
    </div>
  </main>
  <script>${script}</script>
</body>
</html>`,
  };
}

export function writeDocumentPayload(path, payload) {
  ensureParentDir(path);
  writeFileSync(path, payload.text, 'utf8');
  return { path, bytes: Buffer.byteLength(payload.text, 'utf8'), mime_type: payload.mime_type };
}

export function writeImagePayload(path, payload) {
  ensureParentDir(path);
  const bytes = payload.bytes ?? new TextEncoder().encode(payload.text ?? '');
  writeFileSync(path, Buffer.from(bytes));
  return { path, bytes: bytes.length, mime_type: payload.mime_type };
}
